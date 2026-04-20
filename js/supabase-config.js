// Supabase configuration — Project URL is committed (it's public), anon key
// is committed once Ryan pastes it (also public-safe via RLS).
//
// To wire the anon key:
//   1. Supabase Dashboard → Settings → API
//   2. Copy "anon / public" key (starts with eyJ...)
//   3. Replace the empty string below
//   4. Commit + push → next deploy lights up auth + sync
//
// Service role key NEVER goes here. That belongs in Supabase Edge Function
// secrets, never in client code.

export const SUPABASE_URL = "https://mccjgijnbstduhyuvwwo.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY2pnaWpuYnN0ZHVoeXV2d3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzU0NTUsImV4cCI6MjA5MjIxMTQ1NX0.kR23wmq9Bkt92hwr8LStZFaCjC1lJ3eula9rGXIWzbc";

export function isSupabaseConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}
