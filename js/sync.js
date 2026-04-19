// Sync layer — bridges localStorage state ↔ Supabase tables.
//
// Design principles:
//   - Local state is always authoritative for the current session. When she
//     writes, it hits localStorage first, then gets pushed (debounced).
//   - On sign-in, we PULL her remote state and merge it into local.
//     Remote rows for each slice replace local arrays (last-write-wins on
//     updated_at, but for the MVP we just replace since rows carry id).
//   - Debounced push: after each state save, we wait 3s of idle then
//     upsert changed slices to Supabase. Cheap + batches rapid edits.
//   - Offline is handled by the existing localStorage persistence — when
//     she reconnects and signs in, we push whatever's local.
//
// Scope for v1:
//   - profiles (1 row per user)
//   - income_deposits, income_bills
//   - followup_leads
//   - booking_appointments
//   - life_faith_prayers
//   - life_pregnancy (singleton)
//   - life_pregnancy_letters
//   - life_pregnancy_body_log
//   - wishes
//   - habits_items, habits_log
//
// Future: realtime subscriptions for multi-device, conflict resolution,
// server-authoritative safety_flagged (per §20).

import { state, save } from "./store.js";
import { getSupabase, currentUser, onAuthStateChange, isSupabaseConfigured } from "./supabase.js";

let syncing = false;
let pushTimer = null;
let authListenerAttached = false;

const SLICES = [
  {
    table: "income_deposits",
    path: ["income", "deposits"],
    toRow: (uid, d) => ({ id: d.id, user_id: uid, date: d.date, amount: Number(d.amount) || 0, source: d.source || "" }),
    fromRow: (r) => ({ id: r.id, date: r.date, amount: Number(r.amount), source: r.source || "" }),
  },
  {
    table: "income_bills",
    path: ["income", "bills"],
    toRow: (uid, b) => ({ id: b.id, user_id: uid, name: b.name, amount: Number(b.amount) || 0, due: b.due || null, priority: b.priority || 2, paid: !!b.paid, recurring: !!b.recurring, from_capture_id: b.fromCaptureId || null }),
    fromRow: (r) => ({ id: r.id, name: r.name, amount: Number(r.amount), due: r.due, priority: r.priority, paid: r.paid, recurring: r.recurring, fromCaptureId: r.from_capture_id }),
  },
  {
    table: "followup_leads",
    path: ["followup", "leads"],
    toRow: (uid, l) => ({
      id: l.id, user_id: uid,
      name: l.name, phone: l.phone || "", email: l.email || "",
      interest: l.interest || "", source: l.source || "",
      temperature: l.temperature || "warm",
      last_contact: l.lastContact || null, next_contact: l.nextContact || null,
      notes: l.notes || "", closed: !!l.closed, outcome: l.outcome || "",
    }),
    fromRow: (r) => ({
      id: r.id, name: r.name, phone: r.phone, email: r.email,
      interest: r.interest, source: r.source, temperature: r.temperature,
      lastContact: r.last_contact, nextContact: r.next_contact,
      notes: r.notes, closed: r.closed, outcome: r.outcome,
    }),
  },
  {
    table: "booking_appointments",
    path: ["booking", "appointments"],
    toRow: (uid, a) => ({
      id: a.id, user_id: uid,
      client: a.client, phone: a.phone || "", service: a.service || "",
      date: a.date, time: a.time || "",
      price: Number(a.price) || 0, deposit: Number(a.deposit) || 0, paid: Number(a.paid) || 0,
      cancelled: !!a.cancelled, note: a.note || "",
    }),
    fromRow: (r) => ({
      id: r.id, client: r.client, phone: r.phone, service: r.service,
      date: r.date, time: r.time,
      price: Number(r.price), deposit: Number(r.deposit), paid: Number(r.paid),
      cancelled: r.cancelled, note: r.note,
    }),
  },
  {
    table: "life_faith_prayers",
    path: ["life", "faith", "prayers"],
    toRow: (uid, p) => ({
      id: p.id, user_id: uid,
      text: p.text, answered: !!p.answered, answered_at: p.answeredAt || null,
      answer_note: p.answerNote || "",
      created_at: p.createdAt ? (p.createdAt.length === 10 ? p.createdAt + "T00:00:00Z" : p.createdAt) : undefined,
    }),
    fromRow: (r) => ({
      id: r.id, text: r.text, answered: r.answered,
      answeredAt: r.answered_at, answerNote: r.answer_note,
      createdAt: r.created_at ? r.created_at.slice(0, 10) : "",
    }),
  },
  {
    table: "life_pregnancy_letters",
    path: ["life", "pregnancy", "letters"],
    toRow: (uid, l) => ({
      id: l.id, user_id: uid,
      body: l.body, author: l.author || "", template: l.template || "",
      created_at: l.createdAt ? new Date(l.createdAt).toISOString() : undefined,
    }),
    fromRow: (r) => ({
      id: r.id, body: r.body, author: r.author, template: r.template,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "life_pregnancy_body_log",
    path: ["life", "pregnancy", "bodyLog"],
    toRow: (uid, e) => ({
      id: e.id, user_id: uid, date: e.date,
      text: e.text || "", tags: e.tags || [],
      severity: e.severity || 2, asked_doctor: !!e.askedDoctor,
      created_at: e.createdAt ? new Date(e.createdAt).toISOString() : undefined,
    }),
    fromRow: (r) => ({
      id: r.id, date: r.date, text: r.text,
      tags: r.tags || [], severity: r.severity,
      askedDoctor: r.asked_doctor,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "wishes",
    path: ["wishes"],
    toRow: (uid, w) => ({
      id: w.id, user_id: uid,
      text: w.text, kind: w.kind, notes: w.notes || "",
      status: w.status || "active",
      created_at: w.createdAt ? new Date(w.createdAt).toISOString() : undefined,
    }),
    fromRow: (r) => ({
      id: r.id, text: r.text, kind: r.kind, notes: r.notes,
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "habits_items",
    path: ["habits", "items"],
    toRow: (uid, hb) => ({
      id: hb.id, user_id: uid,
      label: hb.label, emoji: hb.emoji || "✨",
      category: hb.category || "custom", schedule: hb.schedule || "daily",
      created_at: hb.createdAt ? new Date(hb.createdAt).toISOString() : undefined,
    }),
    fromRow: (r) => ({
      id: r.id, label: r.label, emoji: r.emoji,
      category: r.category, schedule: r.schedule,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
];

function getPath(obj, path) {
  let cur = obj;
  for (const k of path) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

function setPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] == null) cur[path[i]] = {};
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = value;
}

async function pushSlice(sb, slice, userId) {
  const local = getPath(state, slice.path);
  if (!Array.isArray(local) || !local.length) return { pushed: 0 };
  const rows = local.map((item) => slice.toRow(userId, item));
  const { error } = await sb.from(slice.table).upsert(rows, { onConflict: "id" });
  if (error) {
    console.warn("[sync] push failed", slice.table, error.message);
    return { pushed: 0, error };
  }
  return { pushed: rows.length };
}

async function pullSlice(sb, slice, userId) {
  const { data, error } = await sb.from(slice.table).select("*").eq("user_id", userId);
  if (error) {
    console.warn("[sync] pull failed", slice.table, error.message);
    return { pulled: 0, error };
  }
  const items = (data || []).map(slice.fromRow);
  setPath(state, slice.path, items);
  return { pulled: items.length };
}

// Profile is a singleton (1 row with pk = user.id). Different shape; sync separately.
async function pushProfile(sb, userId) {
  const p = state.profile || {};
  const plan = state.plan || {};
  const row = {
    id: userId,
    first_name: p.firstName || null,
    partner_name: p.partnerName || null,
    business_name: p.businessName || null,
    brand: state.brand || "default",
    roles: p.roles || [],
    interests: p.interests || [],
    setup_done: !!p.setupDone,
    tier: plan.tier || "trial",
    trial_started_at: plan.trialStartedAt ? new Date(plan.trialStartedAt).toISOString() : null,
    brain_tier: plan.brainTier || "haiku",
    voice_unlimited_until: plan.voiceUnlimitedUntil ? new Date(plan.voiceUnlimitedUntil).toISOString() : null,
  };
  const { error } = await sb.from("profiles").upsert(row, { onConflict: "id" });
  if (error) console.warn("[sync] profile push failed", error.message);
}

async function pullProfile(sb, userId) {
  const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error || !data) return;
  if (!state.profile) state.profile = {};
  if (!state.plan) state.plan = {};
  if (data.first_name != null)    state.profile.firstName = data.first_name;
  if (data.partner_name != null)  state.profile.partnerName = data.partner_name;
  if (data.business_name != null) state.profile.businessName = data.business_name;
  if (data.brand)                 state.brand = data.brand;
  if (data.roles)                 state.profile.roles = data.roles;
  if (data.interests)             state.profile.interests = data.interests;
  state.profile.setupDone = !!data.setup_done;
  state.plan.tier = data.tier || "trial";
  if (data.trial_started_at)      state.plan.trialStartedAt = new Date(data.trial_started_at).getTime();
  state.plan.brainTier = data.brain_tier || "haiku";
  if (data.voice_unlimited_until) state.plan.voiceUnlimitedUntil = new Date(data.voice_unlimited_until).getTime();
}

export async function syncPullAll() {
  if (!isSupabaseConfigured() || syncing) return;
  syncing = true;
  try {
    const sb = await getSupabase();
    const user = await currentUser();
    if (!user) return;
    await pullProfile(sb, user.id);
    for (const slice of SLICES) await pullSlice(sb, slice, user.id);
    save();
    console.log("[sync] pull complete");
  } finally {
    syncing = false;
  }
}

export async function syncPushAll() {
  if (!isSupabaseConfigured() || syncing) return;
  syncing = true;
  try {
    const sb = await getSupabase();
    const user = await currentUser();
    if (!user) return;
    await pushProfile(sb, user.id);
    for (const slice of SLICES) await pushSlice(sb, slice, user.id);
    console.log("[sync] push complete");
  } finally {
    syncing = false;
  }
}

export function queueSync(delay = 3000) {
  if (!isSupabaseConfigured()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { syncPushAll().catch(() => {}); }, delay);
}

export async function initSync() {
  if (!isSupabaseConfigured()) return;
  if (authListenerAttached) return;
  authListenerAttached = true;

  // On initial load, if user is already signed in, pull their remote state
  const user = await currentUser();
  if (user) {
    await syncPullAll();
  }

  // Listen for future auth changes
  onAuthStateChange(async ({ event }) => {
    if (event === "SIGNED_IN") {
      await syncPullAll();
      // trigger a re-render if possible
      document.dispatchEvent(new CustomEvent("sync:pulled"));
    } else if (event === "SIGNED_OUT") {
      // Local state stays; just stop syncing
      console.log("[sync] signed out — staying local");
    }
  });
}

// Public helper: when someone signs in for the first time, they might have
// local data from pre-account usage. This merges local into remote instead
// of replacing local with (empty) remote.
export async function syncFirstTimePushLocal() {
  if (!isSupabaseConfigured()) return;
  await syncPushAll();
}
