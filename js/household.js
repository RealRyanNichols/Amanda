// Household / partner-linking helpers — read + write against the households
// and household_members tables. RLS enforces that primary owns her own
// household and members only see/act on rows they belong to.
//
// Flow:
//   1. Primary taps "Invite my partner" → typeHH.ensureHousehold() creates
//      her household if it doesn't exist yet
//   2. Primary types partner's email → inviteMember(email, role, visibility)
//      creates a pending household_members row with pending_email set
//   3. When partner signs up with that email, the attach_pending_invite()
//      trigger (migration 0003) fills in user_id + flips status to 'active'
//   4. Primary sees the member's status change live via realtime subscription

import { getSupabase, currentUser, isSupabaseConfigured } from "./supabase.js";

export async function ensureHousehold() {
  if (!isSupabaseConfigured()) throw new Error("Backend not configured");
  const sb = await getSupabase();
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");

  // Find or create her household
  const { data: existing } = await sb
    .from("households")
    .select("*")
    .eq("primary_user_id", user.id)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await sb
    .from("households")
    .insert({ primary_user_id: user.id, name: "My household" })
    .select()
    .single();
  if (error) throw error;

  // Add herself as the primary member
  await sb.from("household_members").insert({
    household_id: created.id,
    user_id: user.id,
    role: "primary",
    status: "active",
    joined_at: new Date().toISOString(),
  });
  return created;
}

export async function getHousehold() {
  if (!isSupabaseConfigured()) return null;
  const sb = await getSupabase();
  const user = await currentUser();
  if (!user) return null;
  const { data } = await sb
    .from("households")
    .select("*, household_members(*)")
    .eq("primary_user_id", user.id)
    .maybeSingle();
  return data;
}

export async function inviteMember({ email, relation = "", role = "partner", visibility = {} }) {
  const household = await ensureHousehold();
  const sb = await getSupabase();
  const user = await currentUser();

  const row = {
    household_id: household.id,
    user_id: user.id, // placeholder — trigger will replace with invitee's id on their signup
    role,
    relation,
    pending_email: email.toLowerCase().trim(),
    status: "pending",
    invited_by: user.id,
    can_see_calendar: !!visibility.can_see_calendar,
    can_see_baby_year: !!visibility.can_see_baby_year,
    can_see_pregnancy: !!visibility.can_see_pregnancy,
    can_see_kids: !!visibility.can_see_kids,
    can_see_me_time: !!visibility.can_see_me_time,
    alert_on_concerning: !!visibility.alert_on_concerning,
  };
  // Insert with placeholder user_id; our trigger on the invitee's signup
  // will rewrite user_id and flip status.
  const { error } = await sb.from("household_members").insert(row);
  if (error) throw error;

  // Send invitation email via Supabase Auth invite flow — sends a magic-link
  // email with the app URL so they can sign up.
  // NOTE: This requires the SUPABASE_URL redirect to be configured in
  // Authentication → URL Configuration.
  try {
    await sb.auth.admin?.inviteUserByEmail?.(email);
  } catch {
    // admin.inviteUserByEmail requires service_role. Anon key can't. We'll
    // rely on the partner signing up manually with the same email — the
    // trigger attaches them. Ryan: to enable email-sent invites, move this
    // to a Supabase Edge Function with service role.
  }
  return { household, pending_email: email };
}

export async function updateMemberVisibility(memberId, flags) {
  const sb = await getSupabase();
  const { error } = await sb
    .from("household_members")
    .update(flags)
    .eq("id", memberId);
  if (error) throw error;
}

export async function removeMember(memberId) {
  const sb = await getSupabase();
  const { error } = await sb
    .from("household_members")
    .delete()
    .eq("id", memberId);
  if (error) throw error;
}
