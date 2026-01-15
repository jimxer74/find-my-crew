-- Add description field to legs table
-- This field allows storing additional descriptive text for each leg

ALTER TABLE public.legs 
ADD COLUMN IF NOT EXISTS description text;

-- Add a comment to document the field
COMMENT ON COLUMN public.legs.description IS 'Additional descriptive text for the leg';
