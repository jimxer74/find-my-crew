# GDPR Deletion Fix

## Problem Identified
The GDPR user deletion was failing because:
1. `user_consents` and `consent_audit_log` tables have RLS policies but **no DELETE policy**
2. The deletion code was using the regular Supabase client subject to RLS policies
3. When RLS blocks DELETE operations, the consent data remains and prevents auth user deletion

## Root Cause
- `user_consents` table: Has SELECT, INSERT, UPDATE policies but NO DELETE policy
- `consent_audit_log` table: Has SELECT, INSERT policies but NO DELETE policy
- Without DELETE policies, RLS blocks all DELETE operations on these tables

## Solution Applied
1. **Modified deletion code** to use service role client for consent tables when available
2. **Enhanced error handling** to detect RLS policy violations and provide clear error messages
3. **Added fallback** to regular client if service role key is not available

## Files Modified
- `app/api/user/delete-account/route.ts`: Updated consent table deletion to use service role client

## Changes Made
1. Lines 144-150: Modified consent audit log deletion
2. Lines 152-158: Modified user consents deletion
3. Lines 40-56: Enhanced error handling in safeDelete function

## Expected Behavior After Fix
- Consent tables will be deleted using service role client (bypassing RLS)
- Auth user deletion can proceed normally
- Proper error messages when RLS policies block deletion

## Testing
Test the deletion with a user who has consent data to verify:
1. Consent tables are properly deleted
2. Auth user deletion succeeds
3. No constraint violations occur

## Alternative Solutions Considered
1. Add DELETE RLS policies to consent tables (rejected - security concern)
2. Remove RLS from consent tables entirely (rejected - security concern)
3. Use service role client for all deletions (implemented - most secure)