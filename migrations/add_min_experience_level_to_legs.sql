-- Add min_experience_level column to legs table
-- This field specifies the minimum required experience level for a specific leg
-- Can be more strict than journey level, but not less strict
-- Values: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper, or NULL

ALTER TABLE public.legs 
ADD COLUMN IF NOT EXISTS min_experience_level integer;

COMMENT ON COLUMN public.legs.min_experience_level IS 'Minimum required experience level for this leg. Can be more strict (higher number) than journey level, but not less strict. Values: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper';
