-- Fix foreign key constraints for proper account deletion
-- Addresses constraint issues causing "Profile still exists after deletion attempt!"
-- and "Auth user deletion via admin API failed: Database error deleting user"

-- 1. Fix profiles table foreign key constraint
-- The current constraint lacks ON DELETE CASCADE, causing deletion failures
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Fix feedback table status_changed_by foreign key constraint
-- This field tracks which admin changed feedback status, should use SET NULL on delete
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_changed_by_fkey;
ALTER TABLE feedback ADD CONSTRAINT feedback_status_changed_by_fkey
  FOREIGN KEY (status_changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Verify the constraints were created correctly
COMMENT ON CONSTRAINT profiles_id_fkey ON profiles IS 'Foreign key to auth.users with CASCADE delete for proper account deletion';
COMMENT ON CONSTRAINT feedback_status_changed_by_fkey ON feedback IS 'Foreign key to auth.users with SET NULL on delete for admin tracking';

-- Test the constraints work correctly by checking their definitions
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.update_rule,
  rc.delete_rule
FROM
  information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('profiles', 'feedback')
  AND tc.constraint_name IN ('profiles_id_fkey', 'feedback_status_changed_by_fkey')
ORDER BY tc.table_name, tc.constraint_name;