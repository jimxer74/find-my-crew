-- Add profile_image_url text field to profiles table
-- This field stores the URL to the user's profile image uploaded to Supabase Storage

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_image_url text;

-- Add a comment to document the field
COMMENT ON COLUMN public.profiles.profile_image_url IS 'URL to the user profile image stored in Supabase Storage (profile-images bucket)';
