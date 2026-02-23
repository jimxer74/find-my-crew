-- Migration 047: Ensure skipper_profile, crew_requirements, and journey_details are nullable
-- These columns were added in 045 and 046 but may have been created with NOT NULL constraints.
-- Explicitly drop any NOT NULL constraint so null values can be stored.

alter table public.owner_sessions
  alter column skipper_profile drop not null,
  alter column crew_requirements drop not null,
  alter column journey_details drop not null;
