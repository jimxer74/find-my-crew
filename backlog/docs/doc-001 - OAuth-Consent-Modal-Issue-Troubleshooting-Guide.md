---
id: doc-001
title: OAuth Consent Modal Issue - Troubleshooting Guide
type: other
created_date: '2026-02-21 07:13'
---
# OAuth Consent Modal Issue - Troubleshooting Guide

## Problem Summary
After Google OAuth login/signup, the ConsentSetupModal is NOT showing, even though:
- Email auth flow shows it correctly
- Auth/callback route has been fixed to check pending sessions
- Redirect to `/welcome/owner` or `/welcome/crew` is working

## Investigation Steps

### Step 1: Check Browser Console Logs
After Google OAuth flow, look for these debug logs in browser console:

**Key log pattern to look for:**
```
[ConsentSetupContext] Checking consent setup
[ConsentSetupContext] Render condition check
[ConsentSetupContext] No consent record found - showing modal
```

**What to look for:**
- Is `Checking consent setup` appearing?
- Are all conditions in `Render condition check` true?
- Is it finding the user (hasUser: true)?
- Is authLoading becoming false?

### Step 2: Check Server Logs
Look for these logs from `auth/callback` route:

```
LOGIN CALLBACK: Session detection results
```

This will show:
- `hasPendingOwnerSession`: Should be true if user was in owner chat
- `hasPendingProspectSession`: Should be true if user was in crew chat
- `isNewUser`: Should be true for OAuth users
- What redirect path is being chosen

### Step 3: Browser Network Tab
1. After Google OAuth, look at the redirect chain:
   - First: `auth/callback?code=...`
   - Second: Should be `/welcome/owner` or `/welcome/crew` (NOT `/profile-setup`)
   
2. If second redirect is `/profile-setup`:
   - This means pending session was NOT found
   - Check if owner_sessions or prospect_sessions rows were created

### Step 4: Database Check
Run these queries in Supabase:

```sql
-- Check if owner_sessions exists for the user
SELECT session_id, onboarding_state, conversation 
FROM owner_sessions 
WHERE user_id = 'USER_ID_HERE'
LIMIT 5;

-- Check if prospect_sessions exists
SELECT session_id, onboarding_state, conversation 
FROM prospect_sessions 
WHERE user_id = 'USER_ID_HERE'
LIMIT 5;

-- Check user_consents record
SELECT user_id, privacy_policy_accepted_at, terms_accepted_at 
FROM user_consents 
WHERE user_id = 'USER_ID_HERE';
```

## Possible Root Causes

### Cause 1: Pending Session Not Created
**Symptom**: Redirect goes to `/profile-setup` instead of `/welcome/owner`

**Debug**: 
- Check database for owner_sessions/prospect_sessions rows
- Check if AI chat was actually initialized before OAuth flow

**Fix**: Ensure session is created BEFORE user initiates Google OAuth

### Cause 2: User is Already Authenticated
**Symptom**: Auth/callback doesn't find user in pending state

**Debug**:
- Check if user is already logged in before clicking Google OAuth button
- Check if cookies from previous session are being reused

**Fix**: May need to logout first, or handle re-authentication case

### Cause 3: ConsentSetupContext Not Detecting Setup Need
**Symptom**: Redirects correctly to `/welcome/owner`, but modal doesn't show

**Debug**:
- Check if AuthContext is loading properly (authLoading should go false)
- Check if user object is available when ConsentSetupContext runs
- Check if mounted state is true

**Fix**:
- Check AuthContext loading state
- Verify mounted effect is firing
- Check if there's a race condition with AuthContext

### Cause 4: User Consents Record Already Exists
**Symptom**: user_consents table has a record with both privacy_policy_accepted_at and terms_accepted_at set

**Debug**:
- Check database for user_consents record
- If exists with both required consents, modal won't show

**Fix**:
- Delete or update the user_consents record if it was created incorrectly
- OR update ConsentSetupContext to re-show modal even if record exists (if that's desired)

## Testing Procedure

### Test Flow
1. Go to `/welcome/owner` (unauthenticated)
2. Start a conversation with the AI
3. At any point, click "Continue with Google"
4. Should be redirected back to `/auth/callback`
5. Should then be redirected to `/welcome/owner` (again)
6. ConsentSetupModal should appear

### Expected Console Output
```
LOGIN CALLBACK: Session detection results {
  userId: "...",
  hasPendingOwnerSession: true,
  hasPendingProspectSession: false,
  isNewUser: true
}

[ConsentSetupContext] Checking consent setup {
  authLoading: false,
  hasUser: true,
  userId: "...",
}

[ConsentSetupContext] No consent record found - showing modal
[ConsentSetupContext] Render condition check {
  mounted: true,
  authLoading: false,
  isLoading: false,
  hasUser: true,
  needsConsentSetup: true,
  isExcludedPath: false,
  shouldShowModal: true
}
```

## Email vs OAuth Flow Differences

### Email Flow
```
Email signup page → EmailConfirmationModal → Click "Continue" → Redirect to / → 
AuthContext loads → ConsentSetupContext detects setup needed → Modal shows
```

### OAuth Flow (Expected)
```
Chat page (owner/crew) → Click "Continue with Google" → Google OAuth → 
/auth/callback (detects pending session) → Redirect to /welcome/owner → 
AuthContext loads → ConsentSetupContext detects setup needed → Modal shows
```

### Possible Divergence Point
The issue might be that OAuth users are hitting a different code path in ConsentSetupContext or AuthContext that email users don't hit.

## Quick Fixes to Try

1. **Force modal re-check**: Hard refresh browser (Ctrl+Shift+R)
2. **Clear auth session**: Sign out and try again
3. **Check for console errors**: Look for JavaScript errors in console
4. **Check RLS policies**: Verify user_consents table has correct RLS policies for new users
5. **Check user profile creation**: Some OAuth flows might create profiles differently

## Related Files

- `/app/contexts/ConsentSetupContext.tsx` - Controls modal visibility
- `/app/auth/callback/route.ts` - Handles auth callbacks and redirects
- `/app/contexts/AuthContext.tsx` - User authentication state
- `/app/welcome/owner/page.tsx` - Owner onboarding page
- `/app/welcome/crew/page.tsx` - Crew onboarding page
