-- ============================================================================
-- Migration: Fix Profile Completion Trigger
-- ============================================================================
-- The trigger was reading OLD values from the database instead of NEW values
-- This fixes the trigger to calculate completion based on the NEW row data
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create new trigger function that calculates completion from NEW row
-- ============================================================================

CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER AS $$
DECLARE
  completion_score INTEGER := 0;
  total_fields INTEGER := 8;
BEGIN
  -- Calculate completion score based on NEW row values (not from database query)
  IF NEW.username IS NOT NULL AND NEW.username != '' THEN
    completion_score := completion_score + 1;
  END IF;
  
  IF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN
    completion_score := completion_score + 1;
  END IF;
  
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    completion_score := completion_score + 1;
  END IF;
  
  IF NEW.sailing_experience IS NOT NULL THEN
    completion_score := completion_score + 1;
  END IF;
  
  IF NEW.risk_level IS NOT NULL AND array_length(NEW.risk_level, 1) > 0 THEN
    completion_score := completion_score + 1;
  END IF;
  
  IF NEW.skills IS NOT NULL AND array_length(NEW.skills, 1) > 0 THEN
    completion_score := completion_score + 1;
  END IF;
  
  IF NEW.sailing_preferences IS NOT NULL AND NEW.sailing_preferences != '' THEN
    completion_score := completion_score + 1;
  END IF;
  
  IF NEW.roles IS NOT NULL AND array_length(NEW.roles, 1) > 0 THEN
    completion_score := completion_score + 1;
  END IF;

  -- Calculate and set completion percentage
  NEW.profile_completion_percentage := ROUND((completion_score::NUMERIC / total_fields::NUMERIC) * 100);
  
  -- Set profile_completed_at if completion reaches 100%
  -- Handle both INSERT (OLD is NULL) and UPDATE cases
  IF NEW.profile_completion_percentage = 100 AND (OLD IS NULL OR OLD.profile_completion_percentage < 100) THEN
    NEW.profile_completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Recreate trigger (it should already exist, but this ensures it's correct)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_profile_completion ON public.profiles;
CREATE TRIGGER trigger_update_profile_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_completion();

-- ============================================================================
-- STEP 3: Recalculate completion percentages for all existing profiles
-- ============================================================================

UPDATE public.profiles
SET profile_completion_percentage = calculate_profile_completion(id);

COMMIT;

-- ============================================================================
-- Verification query
-- ============================================================================
-- SELECT id, username, full_name, phone, sailing_experience, 
--        array_length(risk_level, 1) as risk_level_count,
--        array_length(skills, 1) as skills_count,
--        sailing_preferences IS NOT NULL as has_preferences,
--        array_length(roles, 1) as roles_count,
--        profile_completion_percentage
-- FROM public.profiles
-- ORDER BY profile_completion_percentage DESC
-- LIMIT 10;
