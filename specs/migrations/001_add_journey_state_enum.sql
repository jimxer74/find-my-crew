-- Migration: Add journey_state enum and replace is_public with state column
-- Date: 2024

-- Step 1: Create the journey_state enum type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'journey_state') then
    create type journey_state as enum ('In planning', 'Published', 'Archived');
  end if;
end$$;

-- Step 2: Add the new state column (nullable initially for migration)
alter table public.journeys 
  add column if not exists state journey_state;

-- Step 3: Migrate existing data
-- Set 'Published' for journeys that were public (is_public = true)
-- Set 'In planning' for journeys that were private (is_public = false)
update public.journeys
set state = case 
  when is_public = true then 'Published'::journey_state
  else 'In planning'::journey_state
end
where state is null;

-- Step 4: Make state column NOT NULL with default value
alter table public.journeys
  alter column state set not null,
  alter column state set default 'In planning'::journey_state;

-- Step 5: Drop the old is_public column
alter table public.journeys 
  drop column if exists is_public;

-- Step 6: Create index on state for better query performance
create index if not exists journeys_state_idx on public.journeys (state);

-- Step 7: Update RLS policy to use state instead of is_public
-- Drop the old policy if it exists
drop policy if exists "Journeys are viewable by all" on public.journeys;

-- Create new policy that shows Published journeys to everyone, 
-- but owners can see all their journeys regardless of state
create policy "Published journeys are viewable by all"
on public.journeys for select
using (
  state = 'Published'::journey_state
  or exists (
    select 1 from boats
    where boats.id = journeys.boat_id
    and boats.owner_id = auth.uid()
  )
);
