// Supabase Edge Function: brain-query
//
// Retrieval side of the Brain knowledge base. Given a query + tags,
// returns the top N memories the caller's tier can see. Keyword-only
// for now; pgvector semantic search lands when we add embeddings.
//
// Deploy:
//   supabase functions deploy brain-query --project-ref <ref>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

// Access-tier hierarchy — higher tiers see everything a lower tier sees.
const TIER_RANK: Record<string, number> = {
  public: 0,
  free: 0,
  core: 1,
  ultra: 2,
  internal: 3,
};

function tierAllows(requester: string, memoryTier: string): boolean {
  const req = TIER_RANK[requester] ?? 0;
  const mem = TIER_RANK[memoryTier] ?? 1;
  return req >= mem;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return new Response("POST only", { status: 405, headers: cors });

  try {
    const { project, query, tags, limit, requester_tier } = await req.json();

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let q = sb.from("brain_memory").select("*");
    if (project) q = q.eq("project", project);
    if (Array.isArray(tags) && tags.length) q = q.overlaps("tags", tags);

    // Crude keyword match — replace with pgvector similarity when we
    // add embeddings. ILIKE is fine at <100k rows.
    if (query) {
      const needle = `%${String(query).slice(0, 80).replace(/[%_]/g, "")}%`;
      q = q.or(`content.ilike.${needle},summary.ilike.${needle}`);
    }

    q = q.order("occurrences", { ascending: false })
         .order("last_seen_at", { ascending: false })
         .limit(Math.min(Math.max(Number(limit) || 5, 1), 20));

    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...cors, "content-type": "application/json" } });
    }

    const requester = requester_tier || "free";
    const memories = (data || [])
      .filter((m) => tierAllows(requester, m.access_tier || "core"))
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        content: m.summary || m.content, // prefer summary when present
        tags: m.tags,
        occurrences: m.occurrences,
      }));

    return new Response(JSON.stringify({ memories }),
      { headers: { ...cors, "content-type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }),
      { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
