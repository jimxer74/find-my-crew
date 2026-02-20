---
id: TASK-124
title: Fix OAuth login/signup flow to match email auth flow with AI onboarding
status: To Do
assignee: []
created_date: '2026-02-20 15:34'
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
