-- 0006 — Brain memory layer.
--
-- Cross-product knowledge base for "The Brain" (Ryan's AI product).
-- Notes taken in one product inform answers in another.
--
-- Dedup: we normalize + hash incoming content; duplicates increment
-- `occurrences` rather than creating new rows. If content is long and
-- seen several times, a background job (or the app itself) generates a
-- short summary that the Brain returns on retrieval.
--
-- Ownership: every row belongs to Ryan as the product owner. RLS denies
-- direct reads from normal users — the Brain service reads on their
-- behalf via a Supabase Edge Function using the service role key.

create table if not exists public.brain_memory (
  id              uuid primary key default gen_random_uuid(),

  -- The product that contributed this memory
  project         text not null,                   -- 'nest' | 'leadflowpro' | 'repwatcher' | 'pda' | 'rrn'

  -- Who contributed it (the end user), and which tier they were on
  -- when they contributed — useful for later filtering.
  source_user_id  uuid references auth.users(id) on delete set null,
  source_tier     text,                            -- 'free' | 'core' | 'ultra' | 'internal'

  -- The actual knowledge
  kind            text not null,                   -- 'tactic' | 'script' | 'story' | 'question' | 'answer' | 'note'
  content         text not null,

  -- Dedup key: lowercase, alnum-only, whitespace-collapsed hash of content
  content_hash    text not null,

  -- Claude-generated short form when the content is long and the same
  -- memory has been seen multiple times. We serve this to the model
  -- at retrieval to save context tokens.
  summary         text,

  -- Occurrence tracking — the whole point of dedup
  occurrences     integer not null default 1,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),

  -- Classification + retrieval
  tags            text[] not null default '{}',
  access_tier     text not null default 'core',    -- who can pull: 'public' | 'core' | 'ultra' | 'internal'

  -- Future: add a pgvector embedding column for semantic dedup + retrieval
  -- embedding    vector(1536),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists brain_memory_dedup_idx
  on public.brain_memory(project, kind, content_hash);

create index if not exists brain_memory_project_idx   on public.brain_memory(project);
create index if not exists brain_memory_tags_gin_idx  on public.brain_memory using gin(tags);
create index if not exists brain_memory_hot_idx       on public.brain_memory(occurrences desc, last_seen_at desc);
create index if not exists brain_memory_access_idx    on public.brain_memory(access_tier);

-- RLS: no direct reads or writes from user-facing clients.
-- All access flows through a service-role Edge Function ("brain-ingest",
-- "brain-query"). This lets us enforce cross-project authorization,
-- sanitize content, and apply Ryan's access-tier policies in one place.
alter table public.brain_memory enable row level security;

-- Nothing else: no SELECT / INSERT / UPDATE / DELETE policies for anon
-- or authenticated users. Only the service role (bypasses RLS) can read
-- or write. Intentional.
