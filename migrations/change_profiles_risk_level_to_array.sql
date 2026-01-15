-- Change profiles.risk_level from single value to array
-- This allows crew members to select multiple preferred risk levels

-- First, drop the existing column
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS risk_level;

-- Add the column as an array type
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS risk_level risk_level[] DEFAULT '{}';

-- Add a comment to document the field
COMMENT ON COLUMN public.profiles.risk_level IS 'User preferred risk levels for sailing journeys (array of: Coastal sailing, Offshore sailing, Extreme sailing)';
