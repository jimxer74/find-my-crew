-- Add profile_field column to ai_pending_actions table
-- This column is used to track which profile field should be updated for profile-related actions
-- and enables automatic action completion when users update their profile

ALTER TABLE public.ai_pending_actions
ADD COLUMN IF NOT EXISTS profile_field text;

-- Add index for efficient querying of actions by profile field
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_profile_field
ON public.ai_pending_actions(profile_field)
WHERE profile_field IS NOT NULL;

-- Update the table schema in specs
-- Note: The specs/tables.sql file should be updated to include this column
-- This migration ensures the column exists in the database

COMMENT ON COLUMN public.ai_pending_actions.profile_field IS
'Specifies which profile field this action relates to (e.g., user_description, certifications, risk_level, sailing_preferences, skills).
Used for automatic action completion when users update their profile fields.';