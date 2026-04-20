-- Amanda's Toolkit — initial database schema
--
-- Apply via: supabase db push    (or paste into Supabase SQL editor)
--
-- Design principles:
--   1. Every table has Row Level Security enabled.
--   2. user_id is the foreign key to auth.users(id) — users only see their own rows.
--   3. created_at + updated_at on every table for sync conflict resolution.
--   4. Schema mirrors the client-side state shape in js/store.js so the sync
--      layer maps 1:1 (tools/sync.js will be added next).
--   5. Subscription state (tier, voice_unlimited_until, etc.) lives on profiles
--      so client gates check one row.
--
-- Future migrations (separate files):
--   0002_partner_links.sql       — household + partner sharing (§17)
--   0003_community_feed.sql      — anonymized tips + thumbs-up (§18)
--   0004_safety_net_alerts.sql   — back-channel crisis alerting (§20)
--   0005_skills_and_baby_year.sql — Texas RDA students + baby first year tables

-- ==========================================================================
-- PROFILES (extends auth.users with our app-specific columns)
-- ==========================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  first_name    text,
  partner_name  text,
  business_name text,
  brand         text default 'default',  -- 'default' | 'pda'
  roles         text[] default '{}',     -- ['mom','pregnant','faith','business','school','student']
  interests     text[] default '{}',     -- ['money','time','family','growth','calm','encouragement']
  setup_done    boolean default false,

  -- Subscription state (synced from Stripe webhook → 0002+ migration)
  tier              text default 'trial',  -- 'trial'|'free'|'core'|'core_annual'|'ultra'|'ultra_annual'
  trial_started_at  timestamptz,
  brain_tier        text default 'haiku',  -- 'haiku'|'pro'|'ultra'
  voice_unlimited_until timestamptz,
  stripe_customer_id text,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "users see own profile"   on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, trial_started_at)
  values (new.id, now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================================================
-- INCOME — deposits + bills (Income Stabilizer)
-- ==========================================================================
create table if not exists public.income_deposits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  amount      numeric(10,2) not null,
  source      text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.income_deposits enable row level security;
create policy "deposits owner" on public.income_deposits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists income_deposits_user_date on public.income_deposits(user_id, date desc);

create table if not exists public.income_bills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  amount      numeric(10,2) not null default 0,
  due         date,
  priority    int default 2 check (priority between 1 and 3),
  paid        boolean default false,
  recurring   boolean default false,
  from_capture_id uuid,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.income_bills enable row level security;
create policy "bills owner" on public.income_bills for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
-- LEADS / FOLLOW-UP CRM
-- ==========================================================================
create table if not exists public.followup_leads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  phone         text default '',
  email         text default '',
  interest      text default '',
  source        text default '',
  temperature   text default 'warm' check (temperature in ('hot','warm','cold')),
  last_contact  date,
  next_contact  date,
  notes         text default '',
  closed        boolean default false,
  outcome       text default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.followup_leads enable row level security;
create policy "leads owner" on public.followup_leads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists followup_leads_user_temp on public.followup_leads(user_id, temperature, next_contact);

-- ==========================================================================
-- BOOKING — appointments
-- ==========================================================================
create table if not exists public.booking_appointments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  client      text not null,
  phone       text default '',
  service     text default '',
  date        date not null,
  time        text default '',
  price       numeric(10,2) default 0,
  deposit     numeric(10,2) default 0,
  paid        numeric(10,2) default 0,
  cancelled   boolean default false,
  note        text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.booking_appointments enable row level security;
create policy "appointments owner" on public.booking_appointments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
-- LIFE — pregnancy data (per-user singleton-ish + child tables)
-- ==========================================================================
create table if not exists public.life_pregnancy (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  baby_name    text default '',
  due_date     date,
  birth_date   date,
  ob_phone     text default '',
  hospital_bag jsonb default '[]',
  updated_at   timestamptz default now()
);
alter table public.life_pregnancy enable row level security;
create policy "pregnancy owner" on public.life_pregnancy for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.life_pregnancy_letters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  author      text default '',
  template    text default '',
  created_at  timestamptz default now()
);
alter table public.life_pregnancy_letters enable row level security;
create policy "letters owner" on public.life_pregnancy_letters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists letters_user_created on public.life_pregnancy_letters(user_id, created_at desc);

create table if not exists public.life_pregnancy_visits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  provider    text default '',
  weeks       int,
  weight      text default '',
  notes       text default '',
  photos      jsonb default '[]',
  created_at  timestamptz default now()
);
alter table public.life_pregnancy_visits enable row level security;
create policy "visits owner" on public.life_pregnancy_visits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.life_pregnancy_body_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  text        text default '',
  tags        text[] default '{}',
  severity    int default 2 check (severity between 1 and 5),
  asked_doctor boolean default false,
  created_at  timestamptz default now()
);
alter table public.life_pregnancy_body_log enable row level security;
create policy "body log owner" on public.life_pregnancy_body_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists body_log_user_date on public.life_pregnancy_body_log(user_id, created_at desc);

-- ==========================================================================
-- LIFE — faith (prayers + answered notes)
-- ==========================================================================
create table if not exists public.life_faith_prayers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  text          text not null,
  answered      boolean default false,
  answered_at   date,
  answer_note   text default '',
  created_at    timestamptz default now()
);
alter table public.life_faith_prayers enable row level security;
create policy "prayers owner" on public.life_faith_prayers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
-- LIFE — gratitude (3 things a day)
-- ==========================================================================
create table if not exists public.life_gratitude (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  things      text[] default '{}',
  created_at  timestamptz default now(),
  unique (user_id, date)
);
alter table public.life_gratitude enable row level security;
create policy "gratitude owner" on public.life_gratitude for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
-- ME TIME (self-care sessions)
-- ==========================================================================
create table if not exists public.metime_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  started_at    timestamptz not null,
  ended_at      timestamptz,
  minutes       int,
  activity      text default '',
  activity_label text default '',
  reflection    text default '',
  created_at    timestamptz default now()
);
alter table public.metime_sessions enable row level security;
create policy "metime owner" on public.metime_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
-- HABITS (1 free, unlimited paid)
-- ==========================================================================
create table if not exists public.habits_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  emoji       text default '✨',
  category    text default 'custom',
  schedule    text default 'daily',
  created_at  timestamptz default now()
);
alter table public.habits_items enable row level security;
create policy "habits items owner" on public.habits_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.habits_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  habit_id    uuid not null references public.habits_items(id) on delete cascade,
  date        date not null,
  done        boolean default true,
  created_at  timestamptz default now(),
  unique (habit_id, date)
);
alter table public.habits_log enable row level security;
create policy "habits log owner" on public.habits_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
-- BRAIN — chat history (optional sync; default keeps local-only)
-- ==========================================================================
create table if not exists public.brain_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  text        text not null,
  tone        text default 'friend',
  created_at  timestamptz default now()
);
alter table public.brain_messages enable row level security;
create policy "brain messages owner" on public.brain_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists brain_messages_user_created on public.brain_messages(user_id, created_at desc);

-- ==========================================================================
-- WISHES (Brain's life-coach layer)
-- ==========================================================================
create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  kind        text not null check (kind in ('wish','desire','fear','goal')),
  notes       text default '',
  status      text default 'active' check (status in ('active','moving','achieved','released')),
  created_at  timestamptz default now()
);
alter table public.wishes enable row level security;
create policy "wishes owner" on public.wishes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
-- SAFETY NET — flagged events (PRIVATE — only the user can ever read these)
-- ==========================================================================
create table if not exists public.safety_flagged (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  source      text not null,
  text        text not null,
  level       text not null check (level in ('watch','acute')),
  intent      text check (intent in ('venting','distress','crisis')),
  confidence  numeric(3,2),
  reasoning   text default '',
  created_at  timestamptz default now()
);
alter table public.safety_flagged enable row level security;
-- DELIBERATE: even partners with explicit consent cannot read this table directly.
-- Crisis alerts go through a service-role-only Edge Function that decides what
-- a partner sees (per §20).
create policy "safety flagged self only" on public.safety_flagged for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================================
-- PURCHASES (Stripe success-URL trust + future webhook source of truth)
-- ==========================================================================
create table if not exists public.purchases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null,
  unlocked_at timestamptz default now(),
  source      text default 'stripe',
  stripe_session_id text,
  unique (user_id, item_id)
);
alter table public.purchases enable row level security;
create policy "purchases owner read" on public.purchases for select using (auth.uid() = user_id);
-- Inserts come from the Stripe webhook (service role bypasses RLS). Direct
-- client inserts NOT allowed — prevents users from granting themselves purchases.

-- ==========================================================================
-- Convenience: updated_at auto-trigger
-- ==========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','income_deposits','income_bills','followup_leads',
    'booking_appointments','life_pregnancy'
  ]) loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
