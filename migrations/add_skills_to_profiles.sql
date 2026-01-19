-- Add skills field to profiles table
-- Same as journeys.skills - array of skill names from skills-config.json

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.skills IS 'User skills array - skill names from skills-config.json (e.g., "First Aid", "Navigation", "Night Sailing")';
