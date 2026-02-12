-- Migration: Add post_signup_onboarding_pending to session tables
-- Purpose: Store post-signup intent for server-driven onboarding flow
-- When true, /api/onboarding/after-consent will redirect to correct page and trigger profile completion

-- Add to prospect_sessions
ALTER TABLE public.prospect_sessions
  ADD COLUMN IF NOT EXISTS post_signup_onboarding_pending boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prospect_sessions.post_signup_onboarding_pending IS
  'True when user signed up from prospect chat and needs to continue onboarding after consent. Cleared by /api/onboarding/after-consent.';

-- Add to owner_sessions
ALTER TABLE public.owner_sessions
  ADD COLUMN IF NOT EXISTS post_signup_onboarding_pending boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.owner_sessions.post_signup_onboarding_pending IS
  'True when user signed up from owner chat and needs to continue onboarding after consent. Cleared by /api/onboarding/after-consent.';
