-- Migration: Add sailing_experience column to profiles table
-- Date: 2024
-- Description: Adds sailing_experience field to store user's sailing experience level
--              Values: 'Beginner', 'Confident Crew', 'Competent Coastal', 'Advanced', or NULL

-- Add the sailing_experience column to the profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS sailing_experience text;

-- Optional: Add a check constraint to ensure only valid values are stored
-- Uncomment the following lines if you want to enforce data integrity at the database level
-- ALTER TABLE public.profiles
--   DROP CONSTRAINT IF EXISTS profiles_sailing_experience_check;
-- ALTER TABLE public.profiles
--   ADD CONSTRAINT profiles_sailing_experience_check 
--   CHECK (sailing_experience IS NULL OR sailing_experience IN ('Beginner', 'Confident Crew', 'Competent Coastal', 'Advanced'));

-- Note: Existing profiles will have NULL values for sailing_experience
-- Users can update their profiles through the UI to set their sailing experience level
