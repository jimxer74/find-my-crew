-- Add skills column to journeys table
ALTER TABLE public.journeys
ADD COLUMN IF NOT EXISTS skills text[] default '{}';

-- Add comment
COMMENT ON COLUMN public.journeys.skills IS 'Required skills for this journey (array of skill names)';
