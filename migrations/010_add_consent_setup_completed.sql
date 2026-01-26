-- Migration: Add consent_setup_completed_at to user_consents table
-- This field tracks when a user has completed the initial consent setup modal after their first login

ALTER TABLE public.user_consents
ADD COLUMN IF NOT EXISTS consent_setup_completed_at timestamptz;

COMMENT ON COLUMN public.user_consents.consent_setup_completed_at IS 'When user completed the initial consent setup modal after first login';
