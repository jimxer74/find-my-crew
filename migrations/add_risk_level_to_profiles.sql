-- Add risk_level field to profiles table
-- This field uses the existing risk_level enum to indicate the user's preferred risk level

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS risk_level risk_level;

-- Add a comment to document the field
COMMENT ON COLUMN public.profiles.risk_level IS 'User preferred risk level for sailing journeys (Coastal sailing, Offshore sailing, Extreme sailing)';
