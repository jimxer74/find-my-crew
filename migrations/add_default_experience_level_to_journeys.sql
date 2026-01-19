-- Add default value for min_experience_level in journeys table
-- Sets default to 1 (Beginner) for new journeys
-- Updates existing NULL values to 1 (Beginner)

-- Step 1: Update existing NULL values to 1 (Beginner)
UPDATE public.journeys
SET min_experience_level = 1
WHERE min_experience_level IS NULL;

-- Step 2: Set default value for the column
ALTER TABLE public.journeys
ALTER COLUMN min_experience_level SET DEFAULT 1;

-- Add comment to clarify the default
COMMENT ON COLUMN public.journeys.min_experience_level IS 'Minimum required experience level: 1=Beginner (default), 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper';
