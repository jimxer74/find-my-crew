-- ============================================================================
-- Migration: Profile Refactoring - Convert role to roles array
-- ============================================================================
-- This migration converts the single 'role' field to a 'roles' array
-- to support users having multiple roles (owner, crew, or both)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add new columns to profiles table
-- ============================================================================

-- Add roles array column (nullable initially, will be populated from role)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS roles VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[];

-- Add profile completion tracking columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP;

-- ============================================================================
-- STEP 2: Migrate existing role data to roles array
-- ============================================================================

-- Convert existing single role to roles array
-- Handle both enum type (profile_type) and text values
UPDATE public.profiles 
SET roles = ARRAY[role::text]::VARCHAR(50)[]
WHERE roles = ARRAY[]::VARCHAR(50)[] 
  AND role IS NOT NULL;

-- For any profiles that still have empty roles array, set default to crew
UPDATE public.profiles
SET roles = ARRAY['crew']::VARCHAR(50)[]
WHERE roles = ARRAY[]::VARCHAR(50)[];

-- ============================================================================
-- STEP 3: Create GIN index for efficient array queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_roles ON public.profiles USING GIN(roles);

-- ============================================================================
-- STEP 4: Create profile completion tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_completion_tracking (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  has_basic_info BOOLEAN DEFAULT false,
  has_experience_info BOOLEAN DEFAULT false,
  has_skills BOOLEAN DEFAULT false,
  has_preferences BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_completion_user_id 
  ON public.profile_completion_tracking(user_id);

-- ============================================================================
-- STEP 5: Add profile_image_url column if it doesn't exist
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- ============================================================================
-- STEP 6: Create function to calculate profile completion percentage
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_profile_completion(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  completion_score INTEGER := 0;
  total_fields INTEGER := 8; -- Total number of fields to check
  has_username BOOLEAN := false;
  has_full_name BOOLEAN := false;
  has_phone BOOLEAN := false;
  has_experience BOOLEAN := false;
  has_risk_level BOOLEAN := false;
  has_skills BOOLEAN := false;
  has_preferences BOOLEAN := false;
  has_roles BOOLEAN := false;
  profile_exists BOOLEAN := false;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO profile_exists;
  
  -- If profile doesn't exist, return 0
  IF NOT profile_exists THEN
    RETURN 0;
  END IF;

  -- Get profile data
  SELECT 
    (username IS NOT NULL AND username != ''),
    (full_name IS NOT NULL AND full_name != ''),
    (phone IS NOT NULL AND phone != ''),
    (sailing_experience IS NOT NULL),
    (risk_level IS NOT NULL AND array_length(risk_level, 1) > 0),
    (skills IS NOT NULL AND array_length(skills, 1) > 0),
    (sailing_preferences IS NOT NULL AND sailing_preferences != ''),
    (roles IS NOT NULL AND array_length(roles, 1) > 0)
  INTO 
    has_username,
    has_full_name,
    has_phone,
    has_experience,
    has_risk_level,
    has_skills,
    has_preferences,
    has_roles
  FROM public.profiles
  WHERE id = p_user_id;

  -- Calculate completion score
  IF has_username THEN completion_score := completion_score + 1; END IF;
  IF has_full_name THEN completion_score := completion_score + 1; END IF;
  IF has_phone THEN completion_score := completion_score + 1; END IF;
  IF has_experience THEN completion_score := completion_score + 1; END IF;
  IF has_risk_level THEN completion_score := completion_score + 1; END IF;
  IF has_skills THEN completion_score := completion_score + 1; END IF;
  IF has_preferences THEN completion_score := completion_score + 1; END IF;
  IF has_roles THEN completion_score := completion_score + 1; END IF;

  RETURN ROUND((completion_score::NUMERIC / total_fields::NUMERIC) * 100);
EXCEPTION
  WHEN OTHERS THEN
    -- Return 0 if there's any error (e.g., profile doesn't exist)
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: Create trigger to update profile completion percentage
-- ============================================================================

CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_completion_percentage := calculate_profile_completion(NEW.id);
  
  -- Set profile_completed_at if completion reaches 100%
  -- Handle both INSERT (OLD is NULL) and UPDATE cases
  IF NEW.profile_completion_percentage = 100 AND (OLD IS NULL OR OLD.profile_completion_percentage < 100) THEN
    NEW.profile_completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_profile_completion ON public.profiles;
CREATE TRIGGER trigger_update_profile_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_completion();

-- ============================================================================
-- STEP 8: Initialize completion percentages for existing profiles
-- ============================================================================

UPDATE public.profiles
SET profile_completion_percentage = calculate_profile_completion(id);

-- ============================================================================
-- STEP 9: Update profile_completion_tracking for existing profiles
-- ============================================================================

INSERT INTO public.profile_completion_tracking (user_id, has_basic_info, has_experience_info, has_skills, has_preferences, updated_at)
SELECT 
  id,
  (username IS NOT NULL AND username != '') AND (full_name IS NOT NULL AND full_name != ''),
  sailing_experience IS NOT NULL,
  (skills IS NOT NULL AND array_length(skills, 1) > 0),
  (sailing_preferences IS NOT NULL AND sailing_preferences != ''),
  NOW()
FROM public.profiles
ON CONFLICT (user_id) DO UPDATE SET
  has_basic_info = EXCLUDED.has_basic_info,
  has_experience_info = EXCLUDED.has_experience_info,
  has_skills = EXCLUDED.has_skills,
  has_preferences = EXCLUDED.has_preferences,
  updated_at = NOW();

-- ============================================================================
-- NOTE: The 'role' column is NOT dropped yet
-- ============================================================================
-- We keep the old 'role' column for backward compatibility during migration period
-- After verifying all code uses 'roles' array, we can drop it in a future migration
-- To drop it later, run:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
-- DROP TYPE IF EXISTS profile_type; -- Only if no other tables use it

COMMIT;

-- ============================================================================
-- Verification queries (run these to verify migration)
-- ============================================================================
-- SELECT id, role, roles, profile_completion_percentage FROM public.profiles LIMIT 10;
-- SELECT COUNT(*) as total_profiles, 
--        COUNT(*) FILTER (WHERE array_length(roles, 1) > 0) as profiles_with_roles,
--        AVG(profile_completion_percentage) as avg_completion
-- FROM public.profiles;
