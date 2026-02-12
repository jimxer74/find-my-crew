-- Migration: Add onboarding_state to session tables
-- Purpose: Track onboarding progress for post-signup redirect and profile completion flow
-- When user signs up from chat, onboarding_state tracks progress through consent, profile, and (for owners) boat/journey setup
-- This enables /api/onboarding/after-consent to redirect to the correct page and maintain onboarding context

-- Add to prospect_sessions
ALTER TABLE public.prospect_sessions
  ADD COLUMN IF NOT EXISTS onboarding_state varchar(50) NOT NULL DEFAULT 'signup_pending';

COMMENT ON COLUMN public.prospect_sessions.onboarding_state IS
  'Onboarding state for prospects: signup_pending, consent_pending, profile_pending, completed. Tracks progress through post-signup onboarding flow.';

-- Add to owner_sessions
ALTER TABLE public.owner_sessions
  ADD COLUMN IF NOT EXISTS onboarding_state varchar(50) NOT NULL DEFAULT 'signup_pending';

COMMENT ON COLUMN public.owner_sessions.onboarding_state IS
  'Onboarding state for owners: signup_pending, consent_pending, profile_pending, boat_pending, journey_pending, completed. Tracks progress through post-signup onboarding flow.';

-- RLS policies already cover this field since we're not adding new restrictions