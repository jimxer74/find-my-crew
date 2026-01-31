-- Migration: Rename 'experience' column to 'user_description' in profiles table
-- This column stores a free-text description of the user, not specifically sailing experience

-- Rename the column
ALTER TABLE public.profiles
RENAME COLUMN experience TO user_description;

-- Add a comment to clarify the column's purpose
COMMENT ON COLUMN public.profiles.user_description IS 'Free-text description of the user - who they are, their background, interests, etc.';
