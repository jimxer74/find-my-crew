-- Migration: Add email column to profiles table
-- This allows fetching user emails without service role key
-- Email is synced from auth.users via trigger

-- ============================================================================
-- Step 1: Add email column to profiles
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ============================================================================
-- Step 2: Sync existing emails from auth.users to profiles
-- ============================================================================

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

-- ============================================================================
-- Step 3: Create trigger function to sync email on user creation/update
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the profiles table with the user's email
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 4: Create trigger on auth.users
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;

-- Create trigger to sync email when user is created or email is updated
CREATE TRIGGER on_auth_user_email_updated
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email();

-- ============================================================================
-- Step 5: RLS policy for email access
-- ============================================================================

-- Authenticated users can read emails from profiles (needed for notifications)
-- This is acceptable for a crew-finding app where contact is expected
-- The existing "Public profiles are viewable by all" policy already allows SELECT
-- so email will be readable once added to the table

-- Note: If you want to restrict email visibility, you could:
-- 1. Create a separate policy for email access
-- 2. Use a database function to handle email notifications server-side
