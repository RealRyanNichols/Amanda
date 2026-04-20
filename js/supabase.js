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

// Basic Google sign-in — email + profile only. Fast, low-friction.
// For Drive/Sheets/YouTube access use signInWithGoogleScoped() instead,
// which adds the scopes she'd actually consent to.
export async function signInWithGoogle() {
  const sb = await getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  return sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

// Request extra OAuth scopes so we can call Drive / Sheets / YouTube APIs
// on her behalf. She'll see a Google consent screen listing exactly what
// we're asking for. We store the access_token in the Supabase session
// (session.provider_token) — short-lived, ~1 hour.
//
// The "access_type=offline" query param asks Google for a refresh token,
// but Supabase only retains it server-side; the browser session still
// only sees a 1-hour access token. Phase 2 will run a server-side refresh.
export async function signInWithGoogleScoped(extraScopes = []) {
  const sb = await getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  const base = ["openid", "email", "profile"];
  const scopes = [...new Set([...base, ...extraScopes])].join(" ");
  return sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      scopes,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
}

// Pull the currently-valid Google access token out of the Supabase session.
// Returns null if she hasn't signed in with Google, or if it's expired.
export async function getGoogleAccessToken() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  // provider_token is present when the user signed in via OAuth in this session.
  return session.provider_token || null;
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
