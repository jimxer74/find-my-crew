# GDPR User Deletion Issue - Root Cause & Fix

## Problem
The GDPR user deletion was failing with the error:
```
WARNING: Some user data remains before auth deletion: [
  { table: 'user_consents', status: 'remaining', count: 1 },
  { table: 'consent_audit_log', status: 'remaining', count: 7 }
]
CRITICAL: Constraint violations detected before auth deletion
```

## Root Cause
**RLS (Row Level Security) policies were blocking DELETE operations on consent tables.**

### Database Schema Analysis
- `user_consents` table: Has SELECT, INSERT, UPDATE policies but **NO DELETE policy**
- `consent_audit_log` table: Has SELECT, INSERT policies but **NO DELETE policy**
- Without DELETE policies, RLS blocks all DELETE operations on these tables

### Code Analysis
The deletion code was using the regular Supabase client which is subject to RLS policies:
```typescript
// This fails because RLS blocks DELETE on consent tables
const consentAuditResult = await safeDelete('consent_audit_log', { user_id: user.id }, supabase, user.id);
const userConsentsResult = await safeDelete('user_consents', { user_id: user.id }, supabase, user.id);
```

## Solution Applied
Modified the deletion code to use the **service role client** for consent tables, which bypasses RLS policies:

```typescript
// Use service role client to bypass RLS policies
if (serviceRoleKey && supabaseUrl) {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  consentAuditResult = await safeDelete('consent_audit_log', { user_id: user.id }, adminClient, user.id);
}
```

## Changes Made
1. **app/api/user/delete-account/route.ts** (lines 154-176):
   - Modified consent audit log deletion to use service role client
   - Modified user consents deletion to use service role client
   - Added fallback to regular client if service role key is not available

2. **Enhanced error handling** (lines 40-56):
   - Added detection of RLS policy violations
   - Provides clear error messages when RLS blocks deletion

## Why This Fix Works
- **Service role client** has admin privileges and bypasses RLS policies
- **Regular client** is still used as fallback for compatibility
- **Foreign key constraints** with CASCADE DELETE are properly configured
- **No security compromise** - service role is only used for deletion during account cleanup

## Testing
After this fix:
1. Consent tables will be deleted using service role client
2. Auth user deletion can proceed normally
3. No constraint violations should occur
4. Proper error messages when issues arise

## Alternative Solutions Considered
1. **Add DELETE RLS policies** - Rejected due to security concerns
2. **Remove RLS entirely** - Rejected due to security concerns
3. **Use service role for all deletions** - Implemented for consent tables only

## Files Modified
- `app/api/user/delete-account/route.ts` - Main deletion logic
- `gdpr_deletion_fix.md` - Documentation of the fix
- `test_gdpr_fix.sql` - Test script for verification