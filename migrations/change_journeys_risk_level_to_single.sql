-- Change journeys.risk_level from array to single value
-- This migration converts existing array values to single values (takes first element)
-- and changes the column type from risk_level[] to risk_level

-- Step 1: Create a temporary column with single value type
ALTER TABLE public.journeys 
ADD COLUMN IF NOT EXISTS risk_level_new risk_level;

-- Step 2: Migrate existing data (take first element from array if it exists)
UPDATE public.journeys
SET risk_level_new = CASE
  WHEN risk_level IS NULL OR array_length(risk_level, 1) IS NULL THEN NULL
  WHEN array_length(risk_level, 1) > 0 THEN risk_level[1]
  ELSE NULL
END;

-- Step 3: Drop the old array column
ALTER TABLE public.journeys 
DROP COLUMN IF EXISTS risk_level;

-- Step 4: Rename the new column to the original name
ALTER TABLE public.journeys 
RENAME COLUMN risk_level_new TO risk_level;

-- Step 5: Add comment to document the field
COMMENT ON COLUMN public.journeys.risk_level IS 'Risk level for this journey: Coastal sailing, Offshore sailing, or Extreme sailing (single selection)';
