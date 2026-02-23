-- Migration 045: Add skipper_profile and crew_requirements text columns to owner_sessions
-- These store the raw free-text inputs from the front page ComboSearchBox, giving the AI
-- clearly labelled context so it never confuses the skipper's own profile with crew requirements.

alter table public.owner_sessions
  add column if not exists skipper_profile text,     -- Raw skipper/owner profile text from combo search box
  add column if not exists crew_requirements text;   -- Raw crew requirements text from combo search box
