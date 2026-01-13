-- Add average_speed_knots column to boats table
-- This field stores the boat's average cruising speed in knots

ALTER TABLE public.boats 
ADD COLUMN IF NOT EXISTS average_speed_knots numeric;

-- Add a comment to document the field
COMMENT ON COLUMN public.boats.average_speed_knots IS 'Average cruising speed in knots';
