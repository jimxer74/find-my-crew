-- Add sailing_preferences text field to profiles table
-- This field allows users to describe their sailing preferences and preferences

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sailing_preferences text;

-- Add a comment to document the field
COMMENT ON COLUMN public.profiles.sailing_preferences IS 'User sailing preferences and preferences description';
