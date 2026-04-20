-- Migration 0003 — Households + partner linking (§17 spec)
-- Run after 0002_complete_schema.sql.
--
-- Design:
--   - primary_user_id owns the household
--   - partner / family members get rows in household_members with per-
--     resource-kind visibility flags
--   - RLS: primary + approved members can see what was explicitly shared

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  primary_user_id uuid not null references auth.users(id) on delete cascade,
  name text default '',
  family_plan_active boolean default false,
  created_at timestamptz default now()
);
alter table public.households enable row level security;

-- Every household member has a row — the primary herself too.
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner' check (role in ('primary','partner','child','grandparent','helper')),
  relation text default '',  -- freeform label: 'husband','mom','pastor','nanny'
  -- Per-resource-kind visibility: each flag is opt-in by primary
  can_see_calendar      boolean default false,
  can_see_baby_year     boolean default false,
  can_see_pregnancy     boolean default false,  -- letters/body-log stay private unless she opts in
  can_see_kids          boolean default false,
  can_see_me_time       boolean default false,  -- summary-only; session text never shared
  alert_on_concerning   boolean default false,  -- partner-alert opt-in per §20
  invited_by            uuid references auth.users(id),
  invited_at            timestamptz default now(),
  joined_at             timestamptz,
  pending_email         text,  -- set before joined_at if invite sent to someone who hasn't signed up yet
  status text not null default 'pending' check (status in ('pending','active','removed')),
  unique (household_id, user_id)
);
alter table public.household_members enable row level security;

-- Households: primary sees her own household; members see the household they're in
create policy "household: primary sees own" on public.households
  for select using (auth.uid() = primary_user_id);
create policy "household: members see theirs" on public.households
  for select using (
    exists (
      select 1 from public.household_members m
      where m.household_id = id and m.user_id = auth.uid() and m.status = 'active'
    )
  );
create policy "household: primary writes" on public.households
  for all using (auth.uid() = primary_user_id) with check (auth.uid() = primary_user_id);

-- Household members table:
create policy "hm: self sees own row" on public.household_members
  for select using (auth.uid() = user_id);
create policy "hm: primary sees all in household" on public.household_members
  for select using (
    exists (
      select 1 from public.households h
      where h.id = household_id and h.primary_user_id = auth.uid()
    )
  );
-- Primary can insert/update/delete members
create policy "hm: primary manages" on public.household_members
  for all using (
    exists (
      select 1 from public.households h
      where h.id = household_id and h.primary_user_id = auth.uid()
    )
  );
-- Members can accept their own invite (update pending→active)
create policy "hm: self accepts invite" on public.household_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper view: "who can see my X"
create or replace view public.v_my_viewers as
  select
    h.id as household_id,
    m.user_id,
    m.role,
    m.relation,
    m.can_see_calendar,
    m.can_see_baby_year,
    m.can_see_pregnancy,
    m.can_see_kids,
    m.can_see_me_time,
    m.alert_on_concerning
  from public.households h
  join public.household_members m on m.household_id = h.id
  where h.primary_user_id = auth.uid() and m.status = 'active';

-- When a user signs up whose email was pre-invited, attach them to the pending row.
create or replace function public.attach_pending_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.household_members
    set user_id = new.id, status = 'active', joined_at = now(), pending_email = null
    where pending_email = new.email and status = 'pending';
  return new;
end;
$$;

drop trigger if exists on_auth_user_attach_invite on auth.users;
create trigger on_auth_user_attach_invite
  after insert on auth.users
  for each row execute function public.attach_pending_invite();
