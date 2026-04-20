-- Migration 0002 — Complete schema for remaining tables.
-- Run after 0001_initial.sql succeeds.
--
-- Apply via: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Or via Supabase CLI: supabase db push

-- =============================================================================
-- VAULT (Brain Wallet — document vault)
-- =============================================================================
create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text default 'Other',
  note text default '',
  data_url text,  -- base64 for MVP; move to Supabase Storage in phase 2
  mime text default 'image/jpeg',
  from_capture_id uuid,
  created_at timestamptz default now()
);
alter table public.vault_items enable row level security;
create policy "vault owner" on public.vault_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- MEALS (plan + grocery + recipes)
-- =============================================================================
-- Plan stored as flat rows keyed by date+meal (breakfast/lunch/dinner/snack)
create table if not exists public.meals_plan (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  text text not null default '',
  updated_at timestamptz default now(),
  primary key (user_id, date, meal)
);
alter table public.meals_plan enable row level security;
create policy "meals plan owner" on public.meals_plan for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.meals_grocery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  category text default 'Other',
  done boolean default false,
  from_recipe text,
  created_at timestamptz default now()
);
alter table public.meals_grocery enable row level security;
create policy "grocery owner" on public.meals_grocery for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.meals_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ingredients text[] default '{}',
  steps text default '',
  created_at timestamptz default now()
);
alter table public.meals_recipes enable row level security;
create policy "recipes owner" on public.meals_recipes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- SOCIAL (profiles + planner + hashtag sets)
-- =============================================================================
create table if not exists public.social_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','tiktok')),
  handle text default '',
  url text default '',
  primary key (user_id, platform)
);
alter table public.social_profiles enable row level security;
create policy "social profiles owner" on public.social_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  platforms text[] default '{instagram}',
  status text default 'draft' check (status in ('draft','scheduled','posted')),
  scheduled_for timestamptz,
  photo_data_url text,
  posted_at timestamptz,
  from_capture_id uuid,
  created_at timestamptz default now()
);
alter table public.social_posts enable row level security;
create policy "social posts owner" on public.social_posts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.social_hashtag_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tags text not null,
  created_at timestamptz default now()
);
alter table public.social_hashtag_sets enable row level security;
create policy "hashtag sets owner" on public.social_hashtag_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- ACADEMY (school management — for PDA + white-label RDA schools)
-- =============================================================================
create table if not exists public.academy_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  tuition numeric(10,2) default 0,
  total_hours int default 0,
  created_at timestamptz default now()
);
alter table public.academy_programs enable row level security;
create policy "programs owner" on public.academy_programs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.academy_students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid references public.academy_programs(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text default '',
  email text default '',
  enrolled_date date,
  status text default 'enrolled' check (status in ('prospective','enrolled','graduated','withdrawn')),
  tuition_paid numeric(10,2) default 0,
  hours jsonb default '{"classroom":0,"clinical":0,"externship":0}',
  requirements jsonb default '{}',
  attendance jsonb default '{}',
  notes text default '',
  created_at timestamptz default now()
);
alter table public.academy_students enable row level security;
create policy "students owner" on public.academy_students for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.academy_course_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table public.academy_course_modules enable row level security;
create policy "modules owner" on public.academy_course_modules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.academy_course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_course_modules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  minutes int default 0,
  notes text default '',
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table public.academy_course_lessons enable row level security;
create policy "lessons owner" on public.academy_course_lessons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- CAPTURES (photo → AI → filed record history)
-- =============================================================================
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text default 'auto',
  note text default '',
  summary text default '',
  kind text default 'note',
  raw jsonb default '{}',
  photo_data_url text,
  filed_to text,
  destination_id text,
  created_at timestamptz default now()
);
alter table public.captures enable row level security;
create policy "captures owner" on public.captures for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- FAMILY (kids + supporters — "who loves you" rolodex)
-- =============================================================================
create table if not exists public.life_family_kids (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  grade text default '',
  age int,
  school text default '',
  dropoff text default '',
  pickup text default '',
  fav text default '',
  created_at timestamptz default now()
);
alter table public.life_family_kids enable row level security;
create policy "kids owner" on public.life_family_kids for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.life_family_supporters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relation text default '',
  phone text default '',
  created_at timestamptz default now()
);
alter table public.life_family_supporters enable row level security;
create policy "supporters owner" on public.life_family_supporters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- LOVE NOTES (envelopes with opt-in open state)
-- =============================================================================
create table if not exists public.life_love_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occasion text not null,
  body text default '',
  opened boolean default false,
  created_at timestamptz default now()
);
alter table public.life_love_notes enable row level security;
create policy "love notes owner" on public.life_love_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- BABY YEAR (forward-looking milestones + growth log)
-- =============================================================================
create table if not exists public.baby_year_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_months int default 0,
  completed_at timestamptz,
  note text default '',
  photo_url text default '',
  created_at timestamptz default now()
);
alter table public.baby_year_milestones enable row level security;
create policy "milestones owner" on public.baby_year_milestones for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.baby_year_growth (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  lbs numeric(5,2) default 0,
  oz numeric(5,2) default 0,
  inches numeric(5,2) default 0,
  notes text default '',
  created_at timestamptz default now()
);
alter table public.baby_year_growth enable row level security;
create policy "growth owner" on public.baby_year_growth for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- PROFILE preVisitNotes overflow (body-journal pattern action)
-- =============================================================================
-- Stored in profiles.pre_visit_notes JSONB to avoid a separate table for now.
alter table public.profiles add column if not exists pre_visit_notes jsonb default '[]';
alter table public.profiles add column if not exists ob_phone text default '';
