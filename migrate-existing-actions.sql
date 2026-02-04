-- Migration script to update existing AI pending actions with profile_field values
-- This script should be run after the 012_add_profile_field_to_ai_pending_actions.sql migration

-- Update existing actions with profile_field based on action_type
UPDATE public.ai_pending_actions
SET profile_field = CASE
    WHEN action_type = 'update_profile_user_description' THEN 'user_description'
    WHEN action_type = 'update_profile_certifications' THEN 'certifications'
    WHEN action_type = 'update_profile_risk_level' THEN 'risk_level'
    WHEN action_type = 'update_profile_sailing_preferences' THEN 'sailing_preferences'
    WHEN action_type = 'update_profile_skills' THEN 'skills'
    WHEN action_type = 'refine_skills' THEN 'skills'
    ELSE NULL
  END
WHERE profile_field IS NULL
  AND action_type IN (
    'update_profile_user_description',
    'update_profile_certifications',
    'update_profile_risk_level',
    'update_profile_sailing_preferences',
    'update_profile_skills',
    'refine_skills'
  );

-- Verify the update
SELECT
  action_type,
  profile_field,
  COUNT(*) as action_count
FROM public.ai_pending_actions
WHERE action_type IN (
    'update_profile_user_description',
    'update_profile_certifications',
    'update_profile_risk_level',
    'update_profile_sailing_preferences',
    'update_profile_skills',
    'refine_skills'
  )
GROUP BY action_type, profile_field
ORDER BY action_type;