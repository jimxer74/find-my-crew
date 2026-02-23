-- Migration 046: Add journey_details text column to owner_sessions
-- Stores the parsed journey text (locations, dates, waypoints) from the front page ComboSearchBox.
-- Mirrors the skipper_profile / crew_requirements pattern so the AI always has clearly-labelled,
-- reliably-available journey context throughout the session.

alter table public.owner_sessions
  add column if not exists journey_details text;  -- Parsed journey details text from combo search box
