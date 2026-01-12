-- Migration: Refactor legs table to use waypoints array instead of start_geocode and end_geocode
-- Date: 2024

-- Step 1: Add the new waypoints column (nullable initially for migration)
alter table public.legs 
  add column if not exists waypoints jsonb default '[]';

-- Step 2: Migrate existing data
-- Convert start_geocode and end_geocode to waypoints array
-- Only migrate if both geocodes exist and waypoints is empty
update public.legs
set waypoints = case
  when start_geocode is not null and end_geocode is not null then
    jsonb_build_array(
      jsonb_build_object('index', 0, 'geocode', start_geocode),
      jsonb_build_object('index', 1, 'geocode', end_geocode)
    )
  when start_geocode is not null then
    jsonb_build_array(
      jsonb_build_object('index', 0, 'geocode', start_geocode)
    )
  when end_geocode is not null then
    jsonb_build_array(
      jsonb_build_object('index', 0, 'geocode', end_geocode)
    )
  else '[]'::jsonb
end
where waypoints = '[]'::jsonb or waypoints is null;

-- Step 3: Make waypoints column NOT NULL with default value
alter table public.legs
  alter column waypoints set not null,
  alter column waypoints set default '[]'::jsonb;

-- Step 4: Drop the old geocode columns
alter table public.legs 
  drop column if exists start_geocode;
  
alter table public.legs 
  drop column if exists end_geocode;

-- Step 5: Create GIN index on waypoints for better query performance
create index if not exists legs_waypoints_idx on public.legs using gin (waypoints);
