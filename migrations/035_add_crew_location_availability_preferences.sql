-- Migration: Add crew location and availability preferences to profiles
-- These fields store preferred departure/arrival locations and availability dates
-- for crew members, used for filtering and matching in /crew and /crew/dashboard.
--
-- Location fields use jsonb to store the complete Location type:
-- {name, lat, lng, isCruisingRegion?, bbox?: {minLng, minLat, maxLng, maxLat}, countryCode?, countryName?}
-- This matches the LocationAutocomplete component output and preserves cruising region bbox data.

-- Add location preference columns
alter table public.profiles
  add column if not exists preferred_departure_location jsonb null,
  add column if not exists preferred_arrival_location jsonb null;

-- Add availability date columns
alter table public.profiles
  add column if not exists availability_start_date date null,
  add column if not exists availability_end_date date null;

-- Index on availability dates for filtering queries
create index if not exists idx_profiles_availability_dates
  on public.profiles (availability_start_date, availability_end_date)
  where availability_start_date is not null or availability_end_date is not null;
