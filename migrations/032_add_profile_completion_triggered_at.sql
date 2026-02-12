-- Migration: Add profile_completion_triggered_at to session tables
-- Purpose: Track when SYSTEM message was sent so returning users can be prompted to continue
-- When user visits /welcome/owner or /welcome/crew without profile_completion param but has
-- incomplete profile and linked session, we trigger profile completion if this is null

-- Add to prospect_sessions
ALTER TABLE public.prospect_sessions
  ADD COLUMN IF NOT EXISTS profile_completion_triggered_at timestamptz NULL;

COMMENT ON COLUMN public.prospect_sessions.profile_completion_triggered_at IS
  'When the profile completion SYSTEM message was sent to AI. Null = not yet triggered. Set by trigger-profile-completion API on success.';

-- Add to owner_sessions
ALTER TABLE public.owner_sessions
  ADD COLUMN IF NOT EXISTS profile_completion_triggered_at timestamptz NULL;

COMMENT ON COLUMN public.owner_sessions.profile_completion_triggered_at IS
  'When the profile completion SYSTEM message was sent to AI. Null = not yet triggered. Set by trigger-profile-completion API on success.';
