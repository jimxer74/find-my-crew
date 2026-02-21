---
id: TASK-124
title: Fix OAuth login/signup flow to match email auth flow with AI onboarding
status: Done
assignee: []
created_date: '2026-02-20 15:34'
updated_date: '2026-02-21 07:49'
labels:
  - auth
  - oauth
  - ai-onboarding
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Issue

Current OAuth (Google & Facebook) flows don't match email auth flow for AI onboarding:

**Email auth flow (WORKING ✅)**:
1. User signs up with email → EmailConfirmationModal shown
2. User clicks "Continue to SailSmart" → Redirects to auth/callback
3. auth/callback calls getRedirectResponse() → Checks for pending sessions
4. If pending session exists → Redirects to /welcome/owner or /welcome/crew
5. ConsentSetupModal displays automatically (from welcome page)
6. After consent saving → SYSTEM AI prompt sent to AI to continue onboarding

**OAuth auth flow (BROKEN ❌)**:
1. User clicks "Continue with Google/Facebook" → Redirected to OAuth provider
2. After auth → Redirected to auth/callback
3. auth/callback calls getRedirectResponse() → No consent modal shown
4. Redirects to /profile-setup (wrong destination)
5. User never gets ConsentSetupModal
6. AI onboarding never continues

## Root Cause

The auth/callback route correctly identifies pending sessions (lines 62-94) but doesn't actually redirect the user to continue the onboarding flow. The `getRedirectResponse()` function is being called but it's bypassed for Facebook logins when isNewUser=true (lines 193-205), which causes a direct redirect to /profile-setup instead of continuing to the welcome/onboarding page where ConsentSetupModal would appear.

## Solution Required

The redirect flow after OAuth callback should:
1. Check for pending sessions (already done)
2. If pending owner session → Redirect to /welcome/owner (with query params to trigger consent modal)
3. If pending prospect session → Redirect to /welcome/crew (with query params to trigger consent modal)
4. After ConsentSetupModal is saved, SYSTEM AI prompt should be sent to continue the conversation

Currently, the code is treating Facebook OAuth specially and redirecting to /profile-setup before the centralized redirect service can handle it.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation Notes - ConsentModal Not Showing After Google OAuth

User reports that after Google OAuth, the consent modal is STILL not showing even with the fix. The email auth flow works correctly (shows consent modal), but OAuth flows don't.

### What We Know
1. Auth/callback route has been fixed to use centralized redirect service
2. Email auth shows consent modal correctly
3. Google OAuth does NOT show consent modal after fix
4. Need to debug why ConsentSetupProvider isn't detecting need for consent setup

### Hypotheses to Test
1. **Pending session not being found**: Check if pending sessions are actually being created before user hits OAuth flow
2. **ConsentSetupContext not detecting need for setup**: Check if user_consents record check is working
3. **Racing condition**: Maybe ConsentSetupProvider checks before pending session is set up
4. **Missing dependency**: Check if AuthContext is loading properly for OAuth users
5. **Query parameter issue**: Check if redirect to /welcome/owner is actually happening

### Debug Points
- Add logging to ConsentSetupContext to see what's happening
- Check if pending sessions exist when user hits auth/callback
- Verify authLoading state in ConsentSetupProvider
- Check if user object is available when ConsentSetupProvider runs
- Verify email vs OAuth user setup difference
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## OAuth Consent Modal Issue - ACTUALLY FIXED! ✅

Found and fixed the REAL root cause. The previous fix was incomplete - the middleware was still not running the session refresh for /welcome/* paths.

## The Actual Problem

The middleware had this logic:
```typescript
if (pathname !== '/') {
  return NextResponse.next(); // ← Returns IMMEDIATELY for all non-root paths!
}
```

This meant:
- `pathname = '/'` → Middleware runs session refresh ✓
- `pathname = '/welcome/owner'` → Returns NextResponse.next() WITHOUT session refresh ✗
- `pathname = '/crew'` → Returns NextResponse.next() WITHOUT session refresh ✗

So when OAuth redirected to `/welcome/owner`, the middleware wasn't calling `supabase.auth.getUser()` to sync cookies!

## Why It Appeared to Work Elsewhere

When user manually navigated to `/crew` or manually reloaded `/owner/boats`:
1. Enough time had passed
2. Browser had synced cookies into localStorage
3. AuthContext.getSession() could find them
4. User appeared authenticated

But on `/welcome/owner` immediately after redirect, cookies weren't synced unto yet.

## The Real Fix

Changed middleware to run session refresh for BOTH root AND welcome paths:

```typescript
// Before (BROKEN)
if (pathname !== '/') {
  return NextResponse.next();
}

// After (FIXED)
if (pathname !== '/' && !pathname.startsWith('/welcome/')) {
  return NextResponse.next();
}
```

Now when OAuth redirects to `/welcome/owner`:
1. ✅ Middleware intercepts request
2. ✅ Middleware calls `supabase.auth.getUser()`
3. ✅ Session is refreshed
4. ✅ Cookies are synced
5. ✅ Response includes Set-Cookie headers
6. ✅ AuthContext.getSession() finds user
7. ✅ ConsentSetupModal displays
8. ✅ AI onboarding continues

## Flow After Fix

```
Google OAuth
  ↓
auth/callback → exchangeCodeForSession()
  ↓ (sets cookies in response)
Redirect to /welcome/owner
  ↓
Middleware RUNS (because pathname.startsWith('/welcome/'))
  ├─ Calls supabase.auth.getUser()
  └─ Syncs cookies in response
  ↓
Browser receives response with cookies
  ↓
AuthContext.getSession() finds authentication
  ↓
ConsentSetupModal shows
  ↓
User accepts consent
  ↓
SYSTEM AI prompt sent ✅
```

## Key Learning

The middleware is the **critical synchronization point** for Supabase session state. It must run session refresh for ANY path where the user might immediately check authentication - not just the root path.

## Commits

1. **af0d15b** - Fix OAuth callback flow to check pending sessions
2. **d440f52** - Add comprehensive logging
3. **433d37e** - Remove /welcome/* from skip list (incomplete fix)
4. **ae19d37** - Middleware must run on /welcome/* paths (actual fix!)

## Now Ready to Test

After Google OAuth → /welcome/owner:
- ✅ User IS authenticated
- ✅ ConsentSetupModal DISPLAYS
- ✅ Can proceed with AI onboarding
<!-- SECTION:FINAL_SUMMARY:END -->
