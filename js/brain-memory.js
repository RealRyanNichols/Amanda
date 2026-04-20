// Brain memory — cross-product knowledge base ingestion + retrieval.
//
// Architecture (per PROJECTS.md 2026-04-20):
//   - One table, `brain_memory`, shared across every Ryan Nichols product.
//   - Writes are deduped by (project, kind, content_hash). Duplicate hits
//     increment `occurrences` instead of creating a new row.
//   - Long content that has been seen multiple times gets a short summary
//     so the Brain can return cheap tokens at retrieval time.
//   - RLS is locked down — everything flows through a service-role Edge
//     Function. The browser never reads this table directly.
//
// This module is the browser-side ingestion path: it packages a memory
// and sends it to the `brain-ingest` Edge Function, which runs the
// actual write + dedup + summary logic with the service role key.
//
// Why Edge Function and not direct Supabase write:
//   1. Dedup via unique index is clean, but we also want to increment
//      `occurrences` on collision — that's an UPDATE, and doing it
//      safely from the client would require RLS to allow UPDATE on
//      rows the user doesn't own (this is shared data). Locking to
//      service role is simpler + safer.
//   2. We want the option to run Claude summarization on the server
//      side when we decide to compress.
//   3. Compliance: writes flow through one controlled chokepoint so we
//      can sanitize PII and honor opt-outs.

import { getSupabase, currentUser, isSupabaseConfigured } from "./supabase.js";
import { state } from "./store.js";

// Which product is writing memories. Change this single string when
// copying this module into another Ryan Nichols repo.
const PROJECT = "nest";

// Normalize text so semantically identical content produces the same
// hash. Lowercase, strip punctuation, collapse whitespace. Deliberately
// aggressive — we'd rather over-dedupe small variations than store
// 20 near-copies of "hey, just a reminder :)".
export function normalizeForHash(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Cheap, non-crypto hash — SHA-1 via Web Crypto. 40 hex chars. Plenty
// for dedup; collision probability is astronomically low at our scale.
export async function hashContent(text) {
  const enc = new TextEncoder().encode(normalizeForHash(text));
  const buf = await crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The top-level ingest call. Everything that wants to contribute a
// memory funnels through here. Fire-and-forget by default — the user's
// UI should never block waiting for a Brain write.
export async function contributeMemory({
  kind,               // 'tactic' | 'script' | 'story' | 'question' | 'answer' | 'note'
  content,
  tags = [],
  accessTier = "core",
}) {
  if (!isSupabaseConfigured()) return { skipped: "backend-not-configured" };
  if (!content || content.length < 8) return { skipped: "too-short" };

  // Respect the user's opt-out. `state.brain.contributeToBase = false`
  // means this user has said no. Default is off until the user opts in.
  if (!state.brain?.contributeToBase) return { skipped: "user-opted-out" };

  const user = await currentUser();
  const content_hash = await hashContent(content);
  const tier = state.plan?.tier || "free";

  const payload = {
    project: PROJECT,
    source_user_id: user?.id || null,
    source_tier: tier,
    kind,
    content,
    content_hash,
    tags,
    access_tier: accessTier,
  };

  // We invoke a Supabase Edge Function rather than writing directly.
  // Ryan: deploy `supabase/functions/brain-ingest` (see function stub
  // at supabase/functions/brain-ingest/index.ts). It runs the actual
  // dedup UPSERT with the service role key.
  const sb = await getSupabase();
  try {
    const { error } = await sb.functions.invoke("brain-ingest", {
      body: payload,
    });
    if (error) return { skipped: "edge-function-error", error: error.message };
    return { ok: true };
  } catch (err) {
    return { skipped: "network-error", error: err.message };
  }
}

// Retrieval stub — hits `brain-query` Edge Function, which returns the
// top N memories relevant to a query, scoped by the user's tier. Not
// wired into the chat path yet; first we need the table populated.
export async function queryBrainMemory({
  query,
  tags = [],
  limit = 5,
  crossProject = false,
}) {
  if (!isSupabaseConfigured()) return [];
  const sb = await getSupabase();
  const tier = state.plan?.tier || "free";
  try {
    const { data, error } = await sb.functions.invoke("brain-query", {
      body: {
        project: crossProject ? null : PROJECT,
        query,
        tags,
        limit,
        requester_tier: tier,
      },
    });
    if (error) return [];
    return Array.isArray(data?.memories) ? data.memories : [];
  } catch {
    return [];
  }
}

// Toggle — exposed so Settings can surface the opt-in control.
export function setContributeToBrain(enabled) {
  if (!state.brain) state.brain = {};
  state.brain.contributeToBase = !!enabled;
}
