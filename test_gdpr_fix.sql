-- Test script to verify the GDPR deletion fix
-- This script tests the foreign key constraints and RLS behavior

-- 1. Check current RLS policies on consent tables
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM
  pg_policies
WHERE
  tablename IN ('user_consents', 'consent_audit_log')
ORDER BY
  tablename, cmd;

-- 2. Check foreign key constraints
SELECT
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
  AND tc.table_name IN ('user_consents', 'consent_audit_log')
ORDER BY tc.table_name;

-- 3. Test RLS behavior (this should fail with permission denied)
-- Note: This test should be run as a regular user, not service_role
-- DELETE FROM user_consents WHERE user_id = 'test-user-id';
-- DELETE FROM consent_audit_log WHERE user_id = 'test-user-id';

-- 4. Verify CASCADE behavior works correctly
-- This should work if CASCADE is properly configured
-- DELETE FROM auth.users WHERE id = 'test-user-id';