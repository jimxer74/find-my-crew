# Account Deletion Fix - Immediate Action Required

## Problem
The account deletion is failing with:
- "Profile still exists after deletion attempt!"
- "Auth user deletion via admin API failed: Database error deleting user"

## Root Cause
Foreign key constraints in the database are preventing proper deletion:
1. `profiles.id` → `auth.users.id` lacks `ON DELETE CASCADE`
2. `feedback.status_changed_by` → `auth.users.id` lacks proper deletion handling

## Required Action

### 1. Apply Database Migration (CRITICAL)

**You must run this migration on your database:**

```sql
-- Fix foreign key constraints for proper account deletion
-- 1. Fix profiles table foreign key constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Fix feedback table status_changed_by foreign key constraint
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_changed_by_fkey;
ALTER TABLE feedback ADD CONSTRAINT feedback_status_changed_by_fkey
  FOREIGN KEY (status_changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
```

**How to apply the migration:**
- In Supabase dashboard: SQL Editor → Run the above SQL
- Or run the migration file: `migrations/003_fix_foreign_key_constraints.sql`

### 2. Test the Fix

After applying the migration:

1. **Create test data:**
   - User with profile
   - Feedback records where user is submitter
   - Feedback records where user is status_changed_by (if any)
   - Any other user data

2. **Trigger account deletion**
3. **Verify:**
   - Profile is deleted
   - Auth user is deleted
   - All related data is deleted
   - No constraint violations

### 3. Enhanced Code Changes

The code in `app/api/user/delete-account/route.ts` has been enhanced with:

- **Better constraint checking** before auth user deletion
- **Enhanced error handling** with detailed logging
- **Graceful handling** of partial failures
- **Comprehensive verification** of deletion completion

## Files Modified

1. **`app/api/user/delete-account/route.ts`** - Enhanced deletion logic
2. **`migrations/003_fix_foreign_key_constraints.sql`** - Database constraint fixes
3. **`specs/tables.sql`** - Updated schema specification

## Next Steps

1. **APPLY THE MIGRATION** (most important)
2. Test account deletion functionality
3. Monitor logs for any remaining issues
4. If issues persist, run the debug script: `scripts/debug-deletion-constraints.ts`

## Emergency Rollback

If the migration causes issues, you can rollback with:

```sql
-- Rollback profiles constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id);

-- Rollback feedback constraint
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_changed_by_fkey;
ALTER TABLE feedback ADD CONSTRAINT feedback_status_changed_by_fkey
  FOREIGN KEY (status_changed_by) REFERENCES auth.users(id);
```

## Contact

If you need assistance applying the migration or testing the fix, please let me know. The migration is the critical piece that will resolve the constraint violations preventing account deletion.