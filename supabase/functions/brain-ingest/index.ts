// Supabase Edge Function: brain-ingest
//
// Receives a memory payload from any Ryan Nichols product, dedupes by
// (project, kind, content_hash), and either:
//   - inserts a new brain_memory row (first time we've seen it), or
//   - increments `occurrences` + updates `last_seen_at` on the existing row.
//
// Deploy with:
//   supabase functions deploy brain-ingest --project-ref <ref>
//
// Required secrets:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   -- NOT the anon key; this function needs
//                                  service role to bypass RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return new Response("POST only", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const { project, kind, content, content_hash, source_user_id, source_tier, tags, access_tier } = body;

    if (!project || !kind || !content || !content_hash) {
      return new Response(JSON.stringify({ error: "missing required fields" }),
        { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    // Basic length guardrail — refuse absurd payloads, log truncation.
    const MAX = 8000;
    const truncated = content.length > MAX;
    const finalContent = truncated ? content.slice(0, MAX) : content;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Try to increment existing row first (dedup path).
    const { data: existing } = await sb
      .from("brain_memory")
      .select("id, occurrences")
      .eq("project", project)
      .eq("kind", kind)
      .eq("content_hash", content_hash)
      .maybeSingle();

    if (existing) {
      await sb
        .from("brain_memory")
        .update({
          occurrences: (existing.occurrences || 1) + 1,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return new Response(
        JSON.stringify({ ok: true, deduped: true, id: existing.id }),
        { headers: { ...cors, "content-type": "application/json" } },
      );
    }

    // New memory — insert.
    const { data: inserted, error } = await sb
      .from("brain_memory")
      .insert({
        project,
        kind,
        content: finalContent,
        content_hash,
        source_user_id: source_user_id || null,
        source_tier: source_tier || null,
        tags: Array.isArray(tags) ? tags : [],
        access_tier: access_tier || "core",
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...cors, "content-type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ ok: true, deduped: false, id: inserted.id, truncated }),
      { headers: { ...cors, "content-type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }),
      { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
