-- Add min_experience_level column to journeys table
-- This field specifies the minimum required experience level for crew members
-- Values: 'Beginner', 'Competent Crew', 'Coastal Skipper', 'Offshore Skipper', or NULL

ALTER TABLE public.journeys 
ADD COLUMN IF NOT EXISTS min_experience_level text;

COMMENT ON COLUMN public.journeys.min_experience_level IS 'Minimum required experience level for crew members. Values: Beginner, Competent Crew, Coastal Skipper, Offshore Skipper';
