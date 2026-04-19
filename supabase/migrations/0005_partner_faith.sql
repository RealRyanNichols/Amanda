-- 0005 — Partner faith context on household invites.
--
-- When she invites her partner, she can optionally tell us where he is on
-- his faith journey so the app can meet him where he is. None of this is
-- shown TO him as "she said this about you" — it just informs which
-- scripture and prompts the app surfaces on his side. He can override
-- every field himself once he signs in.
--
-- All columns default to null / false so existing invites keep working.

alter table public.household_members
  add column if not exists faith_status     text,
  add column if not exists church_frequency text,
  add column if not exists faith_nudges_ok  boolean not null default false,
  add column if not exists prayer_ok        boolean not null default false;

-- Validation: faith_status is one of the allowed values (or null).
-- Use a check constraint rather than an enum so we can add values later
-- without a migration for every tweak.
alter table public.household_members
  drop constraint if exists household_members_faith_status_chk;
alter table public.household_members
  add constraint household_members_faith_status_chk
  check (faith_status is null or faith_status in ('unknown','believer','lapsed','exploring','not'));

alter table public.household_members
  drop constraint if exists household_members_church_frequency_chk;
alter table public.household_members
  add constraint household_members_church_frequency_chk
  check (church_frequency is null or church_frequency in ('unknown','weekly','occasional','used_to','never'));
