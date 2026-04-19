// Supabase client wrapper — lazy-loads the official @supabase/supabase-js
// from esm.sh so we don't need a bundler. Provides a thin API the rest of
// the app uses; gracefully no-ops when SUPABASE_ANON_KEY is empty.
//
// Usage:
//   import { getSupabase, isSupabaseConfigured, currentUser } from "./supabase.js";
//   const sb = await getSupabase();
//   const { data, error } = await sb.from("income_deposits").select();

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./supabase-config.js";

let _clientPromise = null;

export { isSupabaseConfigured };

export async function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (_clientPromise) return _clientPromise;
  _clientPromise = (async () => {
    // Pinned to a stable v2 release. CDN-hosted ESM build — no bundler needed.
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // for magic-link / OAuth redirects
        storage: window.localStorage,
        storageKey: "supabase.amanda-toolkit.auth",
      },
    });
  })();
  return _clientPromise;
}

export async function currentUser() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function currentSession() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// Auth helpers — used by tools/account.js
export async function signUpWithEmail(email, password) {
  const sb = await getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  return sb.auth.signUp({ email, password });
}

export async function signInWithEmail(email, password) {
  const sb = await getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  return sb.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  const sb = await getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  return sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function sendMagicLink(email) {
  const sb = await getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  return sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export async function signOut() {
  const sb = await getSupabase();
  if (!sb) return;
  return sb.auth.signOut();
}

export async function onAuthStateChange(callback) {
  const sb = await getSupabase();
  if (!sb) return () => {};
  const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
    callback({ event, session });
  });
  return () => subscription.unsubscribe();
}
