-- Migration: Change experience level columns from text to integer
-- This migration converts text-based experience levels to numeric values:
-- 'Beginner' -> 1
-- 'Competent Crew' -> 2
-- 'Coastal Skipper' -> 3
-- 'Offshore Skipper' -> 4

-- Step 1: Add new integer columns alongside existing text columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sailing_experience_level integer;

ALTER TABLE public.journeys 
ADD COLUMN IF NOT EXISTS min_experience_level_new integer;

-- Step 2: Migrate existing data from text to integer
-- Profiles table
UPDATE public.profiles
SET sailing_experience_level = CASE
  WHEN sailing_experience = 'Beginner' THEN 1
  WHEN sailing_experience = 'Competent Crew' THEN 2
  WHEN sailing_experience = 'Coastal Skipper' THEN 3
  WHEN sailing_experience = 'Offshore Skipper' THEN 4
  ELSE NULL
END
WHERE sailing_experience IS NOT NULL;

-- Journeys table (min_experience_level is currently text)
UPDATE public.journeys
SET min_experience_level_new = CASE
  WHEN min_experience_level::text = 'Beginner' THEN 1
  WHEN min_experience_level::text = 'Competent Crew' THEN 2
  WHEN min_experience_level::text = 'Coastal Skipper' THEN 3
  WHEN min_experience_level::text = 'Offshore Skipper' THEN 4
  ELSE NULL
END
WHERE min_experience_level IS NOT NULL;

-- Step 3: Drop old text columns
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS sailing_experience;

ALTER TABLE public.journeys 
DROP COLUMN IF EXISTS min_experience_level;

-- Step 4: Rename new columns to final names
ALTER TABLE public.profiles 
RENAME COLUMN sailing_experience_level TO sailing_experience;

ALTER TABLE public.journeys 
RENAME COLUMN min_experience_level_new TO min_experience_level;

-- Step 5: Add comments
COMMENT ON COLUMN public.profiles.sailing_experience IS 'Experience level: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper';
COMMENT ON COLUMN public.journeys.min_experience_level IS 'Minimum required experience level: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper';
