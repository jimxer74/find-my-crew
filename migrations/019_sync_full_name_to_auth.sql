-- Migration: Sync full_name from profiles to auth.users.raw_user_meta_data
-- This ensures the NavigationMenu avatar and other components using user.user_metadata.full_name
-- always reflect the current profile name, not just the signup name
--
-- Problem: During signup, full_name is stored in auth.users.raw_user_meta_data.full_name
--          During profile editing, full_name is updated in profiles.full_name
--          NavigationMenu uses user.user_metadata.full_name, which becomes stale
--          No synchronization exists between these two locations

-- ============================================================================
-- Step 1: Create trigger function to sync full_name to auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_full_name_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the auth.users.raw_user_meta_data with the current full_name
  -- This ensures user.user_metadata.full_name stays in sync with profiles.full_name
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', NEW.full_name)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 2: Create trigger on profiles table
-- ============================================================================

-- Drop existing trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS on_profile_full_name_updated ON public.profiles;

-- Create trigger to sync full_name when profile is updated
-- Note: We only trigger on UPDATE, not INSERT, because the initial full_name
-- from signup should remain in auth.users until the user edits their profile
CREATE TRIGGER on_profile_full_name_updated
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_full_name_to_auth();

-- ============================================================================
-- Step 3: Sync existing profile names to auth.users (optional)
-- ============================================================================

-- Update auth.users.raw_user_meta_data.full_name with current profiles.full_name
-- This ensures existing users get their profile names reflected in auth metadata
UPDATE auth.users au
SET raw_user_meta_data = au.raw_user_meta_data || jsonb_build_object('full_name', p.full_name)
FROM public.profiles p
WHERE p.id = au.id
AND p.full_name IS NOT NULL
AND p.full_name != ''
AND (au.raw_user_meta_data->>'full_name') IS DISTINCT FROM p.full_name;

-- Note: This migration updates existing users to have their current profile full_name
-- in auth.users.raw_user_meta_data.full_name, ensuring consistency going forward