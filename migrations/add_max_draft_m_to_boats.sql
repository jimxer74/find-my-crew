-- Add max_draft_m column to boats table
-- This field stores the boat's maximum draft (deepest point below waterline) in meters

ALTER TABLE public.boats 
ADD COLUMN IF NOT EXISTS max_draft_m numeric;

-- Add a comment to document the field
COMMENT ON COLUMN public.boats.max_draft_m IS 'Maximum draft (deepest point below waterline) in meters';
