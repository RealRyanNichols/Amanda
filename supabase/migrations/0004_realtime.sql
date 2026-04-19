-- Migration 0004 — Enable realtime replication on synced tables.
--
-- After this, Supabase will push row-level events (INSERT/UPDATE/DELETE)
-- to any authenticated client that subscribes via supabase.channel().
-- js/sync.js subscribes per user so multi-device sync happens live:
-- Amanda edits on her phone, Ryan's desktop sees it within ~100ms.
--
-- We do NOT enable replication on safety_flagged — that table is
-- deliberately write-only from the client's perspective; anything server
-- side reads it via service_role.

-- Create the supabase_realtime publication if it doesn't exist (standard
-- Supabase projects ship with it; this is a safety no-op in most cases).
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Add each synced table to the publication. ALTER PUBLICATION is idempotent:
-- it errors if the table is already a member, so we wrap in a DO block.
do $$
declare tbl text;
begin
  for tbl in select unnest(array[
    'profiles',
    'income_deposits','income_bills',
    'followup_leads','booking_appointments',
    'life_pregnancy','life_pregnancy_letters','life_pregnancy_visits','life_pregnancy_body_log',
    'life_faith_prayers','life_gratitude',
    'metime_sessions',
    'habits_items','habits_log',
    'brain_messages',
    'wishes',
    'purchases',
    'vault_items',
    'meals_plan','meals_grocery','meals_recipes',
    'social_profiles','social_posts','social_hashtag_sets',
    'academy_programs','academy_students','academy_course_modules','academy_course_lessons',
    'captures',
    'life_family_kids','life_family_supporters','life_love_notes',
    'baby_year_milestones','baby_year_growth',
    'household_members','households'
  ]) loop
    -- ignore errors (table already in publication, or doesn't exist yet)
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when others then null;
    end;
  end loop;
end $$;
