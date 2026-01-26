-- Migration: Add country_flag column to boats table
-- This stores the ISO 3166-1 alpha-2 country code for the boat's home port

ALTER TABLE public.boats ADD COLUMN IF NOT EXISTS country_flag text;
COMMENT ON COLUMN public.boats.country_flag IS 'ISO 3166-1 alpha-2 country code (e.g., US, GB, FR)';
