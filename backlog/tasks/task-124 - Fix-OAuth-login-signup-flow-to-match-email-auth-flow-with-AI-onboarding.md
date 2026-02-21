---
id: TASK-124
title: Fix OAuth login/signup flow to match email auth flow with AI onboarding
status: Done
assignee: []
created_date: '2026-02-20 15:34'
updated_date: '2026-02-21 07:40'
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
## OAuth Consent Modal Issue - FIXED ✅

Successfully identified and fixed the root cause of the OAuth authentication persistence problem.

## The Problem

After Google OAuth, users were:
- NOT authenticated on `/welcome/owner` or `/welcome/crew` 
- NO ConsentSetupModal showing
- BUT became authenticated when navigating to `/crew` manually

This showed the cookies WERE being set, but AuthContext on welcome pages wasn't picking them up.

## Root Cause

The **middleware was skipping `/welcome/*` routes**, so the Supabase session wasn't being refreshed there. Here's what was happening:

```
OAuth callback → Sets cookies → Redirects to /welcome/owner → 
Middleware SKIPS the route → No session refresh → 
AuthContext runs getSession() → Cookies not synced yet → 
User appears unauthenticated → ConsentSetupModal doesn't show
```

## The Fix

**Removed `/welcome/*` from middleware skip list** in `middleware.ts` (line 14-28).

Now when user lands on `/welcome/owner` or `/welcome/crew` after OAuth:

```
OAuth callback → Sets cookies → Redirects to /welcome/owner → 
Middleware RUNS on /welcome page → 
Middleware calls supabase.auth.getUser() → 
Session is refreshed & cookies synced →
Response includes updated cookies →
AuthContext.getSession() now finds authentication →
ConsentSetupModal shows immediately ✅
```

## Files Changed

1. **middleware.ts** 
   - Removed `/welcome/*` from skip list
   - Now middleware will refresh session on welcome pages

2. **app/auth/callback/route.ts**
   - Added detailed logging for session exchange
   - Documented that cookies are automatically updated

## How It Now Works - Full OAuth Flow

```
1. User on /welcome/owner (unauthenticated)
2. Clicks "Continue with Google"
3. Google OAuth provider authentication
4. Browser redirects to /auth/callback?code=...
5. Backend exchanges code for session
   └─ Supabase automatically updates cookies
6. Server redirects to /welcome/owner
7. Middleware intercepts and checks auth
   └─ Calls supabase.auth.getUser()
   └─ Refreshes session state
   └─ Returns response with updated cookies
8. Client receives response with cookies
9. AuthContext mounts and calls getSession()
   └─ Finds the cookies that were synced
   └─ Sets user state
   └─ loading = false
10. ConsentSetupContext runs
    └─ Finds user is authenticated
    └─ Checks user_consents table
    └─ No consent record exists
    └─ Sets needsConsentSetup = true
11. ConsentSetupModal displays ✅
12. User accepts consent
13. SYSTEM AI prompt sent to continue onboarding
```

## Key Insight

The middleware is crucial for syncing Supabase session state after OAuth. By running it on `/welcome/*` routes (which we previously skipped as an optimization), we ensure cookies are properly synced before the client-side AuthContext checks for authentication.

## Testing Checklist

- ✅ Build successful: All 81 pages compiled
- ✅ Google OAuth flow → /welcome/owner
- ✅ User authenticated on welcome page
- ✅ ConsentSetupModal displays
- ✅ Facebook OAuth flow → /welcome/owner  
- ✅ User authenticated on welcome page
- ✅ Consent modal shows
- ✅ Manual navigation to /crew still works
- ✅ Existing email auth flow still works

## Commits

1. **af0d15b** - fix(auth): fix OAuth callback flow to check pending onboarding sessions
2. **d440f52** - debug: add comprehensive logging for OAuth consent modal issue
3. **433d37e** - fix: ensure auth session persists after OAuth callback to welcome pages

## Why This Works

The Supabase SSR library (`@supabase/ssr`) is designed to sync session state via cookies. The middleware running `supabase.auth.getUser()` triggers the automatic cookie synchronization mechanism, ensuring that when the page loads, all necessary auth cookies are available for the browser to read via `document.cookie`.

Without the middleware running on `/welcome/*`, the cookies are set by auth/callback but not synced into a format the browser can immediately read, causing a race condition where AuthContext checks for session before cookies are available.

By letting middleware run, we guarantee the session refresh completes before returning the response to the client.
<!-- SECTION:FINAL_SUMMARY:END -->
