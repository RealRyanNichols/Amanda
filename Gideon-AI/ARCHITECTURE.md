# Gideon — Architecture

## The model underneath

Gideon runs on **Claude** (Anthropic) today. The default model is
`claude-sonnet-4-6` for balanced cost/quality, with `claude-opus-4-7`
available for premium tiers. The model is commodity — what makes
Gideon Gideon is the prompt, the memory, and the data feed sitting
on top.

## The four layers

```
┌──────────────────────────────────────────┐
│  PRODUCT UI  (Nest / LFP / RepWatcher)   │ ← thin shell, per-product
├──────────────────────────────────────────┤
│  GIDEON CHAT LAYER                       │ ← shared UI, shared voice
│  (js/floating-brain.js + tools/brain.js) │
├──────────────────────────────────────────┤
│  MEMORY LAYER                            │ ← shared across all products
│  • brain_memory table (Supabase)         │
│  • brain-ingest Edge Function            │
│  • brain-query Edge Function             │
├──────────────────────────────────────────┤
│  LLM (Claude via anthropic API)          │ ← swappable
└──────────────────────────────────────────┘
```

## Memory layer — the core of the product

See `supabase/migrations/0006_brain_memory.sql` in The Nest repo. This
same migration runs in every Gideon-integrated product.

### Schema

```sql
brain_memory(
  id              uuid pk,
  project         text NOT NULL,         -- 'nest' | 'lfp' | 'repwatcher' | ...
  source_user_id  uuid references auth.users,
  source_tier     text,                  -- 'free' | 'core' | 'ultra' | 'internal'
  kind            text NOT NULL,         -- tactic | script | story | question | answer | note
  content         text NOT NULL,
  content_hash    text NOT NULL,
  summary         text,
  occurrences     int NOT NULL default 1,
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,
  tags            text[],
  access_tier     text                   -- who can retrieve
);
```

Unique index: `(project, kind, content_hash)`. This is the dedup key.

### Dedup algorithm

When a memory is submitted:
1. **Normalize** the content — lowercase, strip all punctuation, collapse
   whitespace. Aggressive. Near-duplicates should collide.
2. **Hash** the normalized text — SHA-1, 40-char hex. Good enough.
3. **Look up** `(project, kind, content_hash)` in `brain_memory`.
4. **If found**: increment `occurrences`, update `last_seen_at`. No
   new row. Log the source_user_id on a separate `brain_memory_sources`
   table (future) so we can tally who contributed what.
5. **If not found**: insert new row.

### Summarization

When `occurrences >= 3` **and** `length(content) > 500` chars:
- Claude is asked to produce a ≤100-char summary.
- Stored in `summary`. Original `content` kept for now; can be pruned
  later if we need disk.
- Retrieval returns `summary || content` — so we always serve the
  shorter version when it exists.

This is the "note that says I've had it 10 times, 10× shorter than
keeping the double" behavior Ryan described.

### Retrieval

`brain-query` Edge Function:
1. Filter by project (or null = cross-product for Ryan-tier queries).
2. Filter by tags (overlap).
3. ILIKE match on content + summary (pgvector later for semantic).
4. Order by `occurrences DESC, last_seen_at DESC` — so common wisdom
   bubbles up.
5. Enforce `access_tier` via tier-rank hierarchy: ultra sees all, core
   sees core + public, free sees public only.
6. Return array of `{ id, kind, content, tags, occurrences }` — source
   user id is **stripped** before return. We sell aggregated wisdom,
   not individual data points.

### Access tiers

| Tier | What they can retrieve |
|------|------------------------|
| `public` / `free` | Only memories explicitly tagged public. |
| `core` | Everything public + core-contributed knowledge from their own project. |
| `ultra` | Cross-product knowledge base. The whole thing. |
| `internal` | Ryan + his ops team. Includes raw moderation queue. |

## The system prompt

The master prompt lives at `PROMPTS/system-prompt.md`. It gets
concatenated with the product overlay (`PROMPTS/product-overlays/<product>.md`)
at runtime.

Approximate structure:

```
<master system prompt: who Gideon is, voice rules, what he does + doesn't do>

<product overlay: what this specific product is, who its users are, domain vocab>

<per-user context: her name, her roles, her current tab, her subscription tier>

<retrieved memories — top N from brain-query — injected as CONTEXT>

<user's current message>
```

Retrieved memories are injected as a numbered list inside a
`CONTEXT FROM THE NETWORK:` block. The model is instructed to cite by
number when it uses one.

## Ingestion — when does a memory enter the base?

Two modes; Ryan picks per product:

**Mode A — Auto with consent.** Every user message + Gideon response
in a given product is classified (by Gideon, cheaply) as "worth
remembering" or "noise". Worth-remembering gets contributed under the
user's name with their account's current tier. Opt-in required at
signup; one-toggle opt-out in Settings.

**Mode B — Explicit.** User taps a "Contribute to the network" button
on specific messages. Slower growth but zero consent ambiguity.

**Default for The Nest: Mode B.** Slower but respectful of the mom
audience.

**Default for Lead Flow Pro: Mode A with consent.** Faster growth,
the audience (operators) is more transactional.

## Rate limits + cost control

- Per-user message ceiling: free tier 10 messages/day, core tier 100,
  ultra unlimited.
- Per-user voice-minute ceiling (STT): free 30 min/day, core 4 hr,
  ultra unlimited.
- Model routing: free tier → Haiku; core → Sonnet; ultra → Opus.
  Mixed fallback when a cheaper tier suffices.
- Caching: identical user questions within 24h return cached responses
  (unless the user explicitly refreshes).

## Privacy + data boundaries

1. **Memories are stripped of source user id on retrieval.** The model
   sees the content, not who said it.
2. **PII scanning at ingest.** Phone numbers, emails, addresses, SSNs
   get masked before write.
3. **User can delete their contributions.** A "remove all my memories"
   button in Settings calls an Edge Function that soft-deletes all
   memories where `source_user_id = me`.
4. **TOS makes ownership explicit.** Contributions to the Brain are
   licensed (not assigned) to Ryan Nichols' products for the purpose
   of training/retrieval. User retains ownership of their content.

## Observability

Every ingest + query hits a simple `brain_events` log table (future)
with `event_type, project, source_user_id, latency_ms, at`. Ryan's
internal dashboard reads this. No PII in events.
