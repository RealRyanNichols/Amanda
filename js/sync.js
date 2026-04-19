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
    }),
    fromRow: (r) => ({
      id: r.id, body: r.body, author: r.author, template: r.template,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "life_pregnancy_visits",
    path: ["life", "pregnancy", "appointments"],
    toRow: (uid, v) => ({
      id: v.id, user_id: uid, date: v.date,
      provider: v.provider || "", weeks: v.weeks || null,
      weight: v.weight || "", notes: v.notes || "",
      photos: v.photos || [],
    }),
    fromRow: (r) => ({
      id: r.id, date: r.date, provider: r.provider, weeks: r.weeks,
      weight: r.weight, notes: r.notes, photos: r.photos || [],
    }),
  },
  {
    table: "life_pregnancy_body_log",
    path: ["life", "pregnancy", "bodyLog"],
    toRow: (uid, e) => ({
      id: e.id, user_id: uid, date: e.date,
      text: e.text || "", tags: e.tags || [],
      severity: e.severity || 2, asked_doctor: !!e.askedDoctor,
    }),
    fromRow: (r) => ({
      id: r.id, date: r.date, text: r.text,
      tags: r.tags || [], severity: r.severity,
      askedDoctor: r.asked_doctor,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "life_gratitude",
    path: ["life", "gratitude", "entries"],
    toRow: (uid, e) => ({ id: e.id, user_id: uid, date: e.date, things: e.things || [] }),
    fromRow: (r) => ({ id: r.id, date: r.date, things: r.things || [] }),
  },
  {
    table: "life_family_kids",
    path: ["life", "family", "kids"],
    toRow: (uid, k) => ({
      id: k.id, user_id: uid, name: k.name,
      grade: k.grade || "", age: k.age ?? null,
      school: k.school || "", dropoff: k.dropoff || "",
      pickup: k.pickup || "", fav: k.fav || "",
    }),
    fromRow: (r) => ({
      id: r.id, name: r.name, grade: r.grade, age: r.age,
      school: r.school, dropoff: r.dropoff, pickup: r.pickup, fav: r.fav,
    }),
  },
  {
    table: "life_family_supporters",
    path: ["life", "family", "supporters"],
    toRow: (uid, s) => ({ id: s.id, user_id: uid, name: s.name, relation: s.relation || "", phone: s.phone || "" }),
    fromRow: (r) => ({ id: r.id, name: r.name, relation: r.relation, phone: r.phone }),
  },
  {
    table: "life_love_notes",
    path: ["life", "loveNotes", "notes"],
    toRow: (uid, n) => ({ id: n.id, user_id: uid, occasion: n.occasion, body: n.body || "", opened: !!n.opened }),
    fromRow: (r) => ({ id: r.id, occasion: r.occasion, body: r.body, opened: r.opened }),
  },
  {
    table: "wishes",
    path: ["wishes"],
    toRow: (uid, w) => ({
      id: w.id, user_id: uid,
      text: w.text, kind: w.kind, notes: w.notes || "",
      status: w.status || "active",
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
    }),
    fromRow: (r) => ({
      id: r.id, label: r.label, emoji: r.emoji,
      category: r.category, schedule: r.schedule,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "metime_sessions",
    path: ["metime", "sessions"],
    toRow: (uid, s) => ({
      id: s.id, user_id: uid,
      started_at: s.startedAt ? new Date(s.startedAt).toISOString() : new Date().toISOString(),
      ended_at: s.endedAt ? new Date(s.endedAt).toISOString() : null,
      minutes: s.minutes || null,
      activity: s.activity || "", activity_label: s.activityLabel || "",
      reflection: s.reflection || "",
    }),
    fromRow: (r) => ({
      id: r.id,
      startedAt: r.started_at ? new Date(r.started_at).getTime() : Date.now(),
      endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
      minutes: r.minutes,
      activity: r.activity, activityLabel: r.activity_label,
      reflection: r.reflection,
    }),
  },
  {
    table: "vault_items",
    path: ["vault", "items"],
    toRow: (uid, v) => ({
      id: v.id, user_id: uid,
      title: v.title, category: v.category || "Other",
      note: v.note || "",
      data_url: v.dataUrl || null,
      mime: v.mime || "image/jpeg",
      from_capture_id: v.fromCaptureId || null,
    }),
    fromRow: (r) => ({
      id: r.id, title: r.title, category: r.category,
      note: r.note, dataUrl: r.data_url, mime: r.mime,
      fromCaptureId: r.from_capture_id,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "meals_grocery",
    path: ["meals", "grocery"],
    toRow: (uid, g) => ({ id: g.id, user_id: uid, item: g.item, category: g.category || "Other", done: !!g.done, from_recipe: g.fromRecipe || null }),
    fromRow: (r) => ({ id: r.id, item: r.item, category: r.category, done: r.done, fromRecipe: r.from_recipe }),
  },
  {
    table: "meals_recipes",
    path: ["meals", "recipes"],
    toRow: (uid, r) => ({ id: r.id, user_id: uid, name: r.name, ingredients: r.ingredients || [], steps: r.steps || "" }),
    fromRow: (r) => ({ id: r.id, name: r.name, ingredients: r.ingredients || [], steps: r.steps }),
  },
  {
    table: "social_posts",
    path: ["social", "posts"],
    toRow: (uid, p) => ({
      id: p.id, user_id: uid,
      body: p.body, platforms: p.platforms || ["instagram"],
      status: p.status || "draft",
      scheduled_for: p.scheduledFor || null,
      photo_data_url: p.photoDataUrl || null,
      from_capture_id: p.fromCaptureId || null,
    }),
    fromRow: (r) => ({
      id: r.id, body: r.body, platforms: r.platforms,
      status: r.status, scheduledFor: r.scheduled_for,
      photoDataUrl: r.photo_data_url,
      fromCaptureId: r.from_capture_id,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "social_hashtag_sets",
    path: ["social", "hashtagSets"],
    toRow: (uid, s) => ({ id: s.id, user_id: uid, name: s.name, tags: s.tags }),
    fromRow: (r) => ({ id: r.id, name: r.name, tags: r.tags }),
  },
  {
    table: "academy_programs",
    path: ["academy", "programs"],
    toRow: (uid, p) => ({
      id: p.id, user_id: uid, name: p.name,
      start_date: p.startDate || null, end_date: p.endDate || null,
      tuition: Number(p.tuition) || 0, total_hours: p.totalHours || 0,
    }),
    fromRow: (r) => ({
      id: r.id, name: r.name,
      startDate: r.start_date, endDate: r.end_date,
      tuition: Number(r.tuition), totalHours: r.total_hours,
    }),
  },
  {
    table: "academy_students",
    path: ["academy", "students"],
    toRow: (uid, s) => ({
      id: s.id, user_id: uid, program_id: s.programId || null,
      first_name: s.firstName, last_name: s.lastName,
      phone: s.phone || "", email: s.email || "",
      enrolled_date: s.enrolledDate || null,
      status: s.status || "enrolled",
      tuition_paid: Number(s.tuitionPaid) || 0,
      hours: s.hours || {}, requirements: s.requirements || {},
      attendance: s.attendance || {}, notes: s.notes || "",
    }),
    fromRow: (r) => ({
      id: r.id, programId: r.program_id,
      firstName: r.first_name, lastName: r.last_name,
      phone: r.phone, email: r.email,
      enrolledDate: r.enrolled_date, status: r.status,
      tuitionPaid: Number(r.tuition_paid),
      hours: r.hours || {}, requirements: r.requirements || {},
      attendance: r.attendance || {}, notes: r.notes || "",
    }),
  },
  {
    table: "captures",
    path: ["captures"],
    toRow: (uid, c) => ({
      id: c.id, user_id: uid,
      intent: c.intent || "auto", note: c.note || "",
      summary: c.summary || "", kind: c.kind || "note",
      raw: c.raw || {},
      photo_data_url: c.photoDataUrl || null,
      filed_to: c.filedTo || null, destination_id: c.destinationId || null,
    }),
    fromRow: (r) => ({
      id: r.id, intent: r.intent, note: r.note,
      summary: r.summary, kind: r.kind, raw: r.raw || {},
      photoDataUrl: r.photo_data_url,
      filedTo: r.filed_to, destinationId: r.destination_id,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    }),
  },
  {
    table: "baby_year_milestones",
    path: ["babyYear", "milestones"],
    toRow: (uid, m) => ({
      id: m.id, user_id: uid, title: m.title,
      due_months: m.dueMonths || 0,
      completed_at: m.completedAt || null,
      note: m.note || "", photo_url: m.photoUrl || "",
    }),
    fromRow: (r) => ({
      id: r.id, title: r.title, dueMonths: r.due_months,
      completedAt: r.completed_at, note: r.note,
      photoUrl: r.photo_url,
    }),
  },
  {
    table: "baby_year_growth",
    path: ["babyYear", "growthLog"],
    toRow: (uid, g) => ({
      id: g.id, user_id: uid, date: g.date,
      lbs: Number(g.lbs) || 0, oz: Number(g.oz) || 0,
      inches: Number(g.inches) || 0, notes: g.notes || "",
    }),
    fromRow: (r) => ({
      id: r.id, date: r.date,
      lbs: Number(r.lbs), oz: Number(r.oz),
      inches: Number(r.inches), notes: r.notes,
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

// ============ REALTIME SUBSCRIPTIONS ============
// When a row changes on ANOTHER device (or from a partner / Edge Function),
// Supabase pushes the event here via postgres_changes. We update local
// state in place and dispatch a re-render so the UI reflects it live.

let _realtimeChannel = null;

async function attachRealtime(userId) {
  if (_realtimeChannel) return;
  const sb = await getSupabase();
  const ch = sb.channel(`user-${userId}-sync`);

  // Subscribe to every synced table, filtered to this user's rows only
  for (const slice of SLICES) {
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: slice.table, filter: `user_id=eq.${userId}` },
      (payload) => applyRealtimeChange(slice, payload)
    );
  }
  // Profile too (no user_id column — the id IS the user)
  ch.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
    (payload) => {
      // Skip our own echo: if the new row matches what's already local, no-op
      const newRow = payload.new;
      if (!newRow) return;
      pullProfileFromRow(newRow);
      save();
      document.dispatchEvent(new CustomEvent("sync:pulled"));
    }
  );
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") console.log("[sync] realtime connected");
  });
  _realtimeChannel = ch;
}

async function detachRealtime() {
  if (!_realtimeChannel) return;
  const sb = await getSupabase();
  await sb.removeChannel(_realtimeChannel);
  _realtimeChannel = null;
}

function applyRealtimeChange(slice, payload) {
  const local = getPath(state, slice.path);
  if (!Array.isArray(local)) return;
  const { eventType, new: newRow, old: oldRow } = payload;
  const id = (newRow || oldRow)?.id;
  if (!id) return;

  if (eventType === "DELETE") {
    const next = local.filter((x) => x.id !== id);
    if (next.length !== local.length) {
      setPath(state, slice.path, next);
      save();
      document.dispatchEvent(new CustomEvent("sync:realtime", { detail: { table: slice.table, event: "delete" } }));
    }
    return;
  }
  if (!newRow) return;
  const mapped = slice.fromRow(newRow);
  const idx = local.findIndex((x) => x.id === id);
  if (idx >= 0) local[idx] = mapped;
  else local.push(mapped);
  save();
  document.dispatchEvent(new CustomEvent("sync:realtime", { detail: { table: slice.table, event: eventType.toLowerCase() } }));
}

// Helper used by realtime profile subscription
function pullProfileFromRow(data) {
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

// Heuristic: after signing in, does this device have barely any local data
// while remote has a lot? If so, she's probably on a new phone — prompt her
// to restore. If local + remote both have data, we already pulled + merged
// in syncPullAll, so nothing to ask.
function localLooksEmpty() {
  const sizes = [
    (state.income?.deposits || []).length,
    (state.income?.bills || []).length,
    (state.followup?.leads || []).length,
    (state.booking?.appointments || []).length,
    (state.life?.pregnancy?.letters || []).length,
    (state.life?.faith?.prayers || []).length,
  ];
  const total = sizes.reduce((a, b) => a + b, 0);
  return total === 0;
}

async function remoteHasData(userId) {
  try {
    const sb = await getSupabase();
    // Check a couple of heavy-use tables for any rows at all
    const checks = ["income_deposits", "followup_leads", "life_pregnancy_letters", "life_faith_prayers"];
    for (const t of checks) {
      const { count } = await sb.from(t).select("id", { count: "exact", head: true }).eq("user_id", userId);
      if ((count || 0) > 0) return true;
    }
    return false;
  } catch { return false; }
}

async function maybePromptRestore(userId) {
  if (!localLooksEmpty()) return;
  const hasRemote = await remoteHasData(userId);
  if (!hasRemote) return;
  // Show a non-blocking restore prompt via event so UI layer handles it
  document.dispatchEvent(new CustomEvent("sync:restore-available"));
}

export async function initSync() {
  if (!isSupabaseConfigured()) return;
  if (authListenerAttached) return;
  authListenerAttached = true;

  // On initial load, if user is already signed in, pull their remote state
  const user = await currentUser();
  if (user) {
    await syncPullAll();
    await attachRealtime(user.id);
  }

  // Listen for future auth changes
  onAuthStateChange(async ({ event, session }) => {
    if (event === "SIGNED_IN") {
      await maybePromptRestore(session.user.id);
      await syncPullAll();
      document.dispatchEvent(new CustomEvent("sync:pulled"));
      if (session?.user?.id) await attachRealtime(session.user.id);
    } else if (event === "SIGNED_OUT") {
      await detachRealtime();
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
