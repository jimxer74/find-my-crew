---
id: doc-002
title: Auth & Onboarding Redirect Logic - Specification
type: other
created_date: '2026-02-21 08:16'
---
# Auth & Onboarding Redirect Logic - Specification

**Status**: DRAFT - Under Review  
**Last Updated**: 2026-02-21  
**Purpose**: Define canonical redirect logic for all authentication and onboarding flows

---

## Overview

This document defines the SINGLE SOURCE OF TRUTH for all redirect decisions after authentication events. All redirect logic should follow these rules consistently across email auth, Google OAuth, and Facebook OAuth.

---

## Core Principles

1. **AI Onboarding First**: Users with pending onboarding sessions ALWAYS return to AI onboarding flow
2. **Session State is Authority**: Database session state (owner_sessions, prospect_sessions) is the primary decision factor
3. **No Legacy Routes**: `/profile-setup` is deprecated - all onboarding via `/welcome/owner` or `/welcome/crew`
4. **Consent Required**: ConsentSetupModal blocks all other actions until user accepts privacy/terms (minimum) and chooses AI consent
5. **Profile Completion**: After consent, AI-assisted profile completion is triggered via query parameter `?profile_completion=true`

---

## Redirect Decision Tree

```
User Authenticated
  ↓
Has consent_setup_completed? (user_consents table)
├─ NO → Show ConsentSetupModal (blocks everything)
│         ↓
│       User Saves Consent
│         ↓
│       Call /api/onboarding/after-consent
│         ↓
│       [Continue to "After Consent" flow below]
│
└─ YES → Check Redirect Rules
          ↓
        [Continue to "Redirect Priority Rules" below]
```

---

## After Consent Flow

After user saves consent in ConsentSetupModal, `/api/onboarding/after-consent` determines redirect:

```
Check: owner_sessions with onboarding_state = 'consent_pending'
├─ FOUND
│  ├─ User ACCEPTED AI consent
│  │  └─ UPDATE onboarding_state = 'profile_pending'
│  │  └─ REDIRECT to /welcome/owner?profile_completion=true
│  │  └─ (This triggers SYSTEM prompt to AI)
│  │
│  └─ User REJECTED AI consent
│     └─ ARCHIVE conversation to ai_messages (GDPR)
│     └─ DELETE session
│     └─ REDIRECT to / (home page)
│
└─ NOT FOUND → Check prospect_sessions with onboarding_state = 'consent_pending'
   ├─ FOUND
   │  ├─ User ACCEPTED AI consent
   │  │  └─ UPDATE onboarding_state = 'profile_pending'
   │  │  └─ REDIRECT to /welcome/crew?profile_completion=true
   │  │  └─ (This triggers SYSTEM prompt to AI)
   │  │
   │  └─ User REJECTED AI consent
   │     └─ ARCHIVE conversation to ai_messages (GDPR)
   │     └─ DELETE session
   │     └─ REDIRECT to / (home page)
   │
   └─ NOT FOUND → No pending session
      └─ REDIRECT to / (home page)
```

---

## Redirect Priority Rules

When user is authenticated and consent is completed, apply these rules IN ORDER:

### Priority 1: Pending Onboarding Sessions
**Check**: `owner_sessions` or `prospect_sessions` with `onboarding_state` in:
- `signup_pending`
- `consent_pending` 
- `profile_pending`
- `boat_pending` (owner only)
- `journey_pending` (owner only)

**Action**:
- If `owner_sessions` found → REDIRECT to `/welcome/owner`
- If `prospect_sessions` found → REDIRECT to `/welcome/crew`
- Reason: User has active AI onboarding in progress

---

### Priority 2: Profile Completion Triggered
**Check**: `owner_sessions.profile_completion_triggered_at IS NOT NULL` OR `prospect_sessions.profile_completion_triggered_at IS NOT NULL`

**Action**:
- If owner session → REDIRECT to `/welcome/owner?profile_completion=true`
- If prospect session → REDIRECT to `/welcome/crew?profile_completion=true`
- Reason: Returning user who started AI onboarding but didn't finish profile

---

### Priority 3: Source-Based Redirects
**Check**: `from` query parameter or stored context about where user came from

**Action**:
- If `from=owner` OR came from `/welcome/owner` → REDIRECT to `/welcome/owner?profile_completion=true`
- If `from=prospect` OR came from `/welcome/crew` → REDIRECT to `/welcome/crew?profile_completion=true`
- Reason: User intent based on entry point

---

### Priority 4: Role-Based Redirects
**Check**: User's `profiles.roles` array

**Action**:
- If roles includes 'owner' AND has boats → REDIRECT to `/owner/journeys`
- If roles includes 'owner' AND no boats → REDIRECT to `/owner/boats`
- If roles includes 'crew' → REDIRECT to `/crew`
- Reason: Established user with known role

---

### Priority 5: New User Default
**Check**: No profile OR profile incomplete (no username)

**Action**:
- REDIRECT to `/crew`
- Reason: New users can browse opportunities while deciding if they want to create profile

---

### Priority 6: Fallback
**Check**: Everything else

**Action**:
- REDIRECT to `/crew`
- Reason: Safe default - crew browsing page

---

## Authentication Method Specifics

### Email Auth
```
User submits signup form
  ↓
EmailConfirmationModal shown
  ↓
User clicks "Continue to SailSmart"
  ↓
Modal redirects to / (home page)
  ↓
User clicks email verification link
  ↓
Redirected to /auth/callback
  ↓
[Apply Redirect Priority Rules]
```

### Google OAuth
```
User clicks "Continue with Google"
  ↓
Google authentication popup/redirect
  ↓
Returns to /auth/callback?code=...
  ↓
Backend exchanges code for session
  ↓
Middleware refreshes session on /welcome/* pages
  ↓
[Apply Redirect Priority Rules]
  ↓
If redirected to /welcome/owner or /welcome/crew:
  ↓
ConsentSetupModal appears (if no consent_setup_completed)
  ↓
[Continue with "After Consent" flow]
```

### Facebook OAuth
```
User clicks "Continue with Facebook"
  ↓
Facebook authentication popup/redirect
  ↓
Returns to /auth/callback?code=...
  ↓
Backend exchanges code for session
  ↓
If session.provider_token exists:
  └─ Store in fb_access_token cookie (for future use - currently disabled)
  ↓
Middleware refreshes session on /welcome/* pages
  ↓
[Apply Redirect Priority Rules]
  ↓
If redirected to /welcome/owner or /welcome/crew:
  ↓
ConsentSetupModal appears (if no consent_setup_completed)
  ↓
[Continue with "After Consent" flow]
```

---

## Session States

### Onboarding States (owner_sessions, prospect_sessions)

| State | Meaning | Next Step |
|-------|---------|-----------|
| `signup_pending` | User started chat but not signed up yet | After signup → `consent_pending` |
| `consent_pending` | User signed up, waiting for consent | After consent → `profile_pending` |
| `profile_pending` | Consent given, AI creating profile | After profile created → `boat_pending` (owner) or COMPLETE (prospect) |
| `boat_pending` | Profile created, AI creating boat | After boat created → `journey_pending` |
| `journey_pending` | Boat created, AI creating journey | After journey created → COMPLETE |

### Consent States (user_consents)

| Field | Meaning | Required? |
|-------|---------|-----------|
| `privacy_policy_accepted_at` | User accepted privacy policy | YES |
| `terms_accepted_at` | User accepted terms of service | YES |
| `ai_processing_consent` | User allows AI to process data | OPTIONAL (default: false) |
| `consent_setup_completed_at` | User completed consent modal | YES (set when saved) |

---

## Special Cases

### User Starts AI Chat Before Auth
```
1. User visits /welcome/owner (unauthenticated)
2. Starts AI conversation
3. Session created with onboarding_state = 'signup_pending'
4. User clicks "Continue with Google"
5. OAuth completes → /auth/callback
6. Checks for session with user_id = NULL and session_id from cookie
7. LINKS session to user.id
8. Updates onboarding_state = 'consent_pending'
9. REDIRECT to /welcome/owner
10. ConsentSetupModal appears
11. After consent → onboarding_state = 'profile_pending'
12. REDIRECT to /welcome/owner?profile_completion=true
13. AI receives SYSTEM prompt to continue
```

### User Opts Out of AI During Consent
```
1. User at ConsentSetupModal
2. Unchecks "AI Processing" checkbox
3. Saves consent
4. /api/onboarding/after-consent called
5. Finds pending session
6. Archives conversation to ai_messages (GDPR compliance)
7. Deletes session
8. REDIRECT to / (home page)
9. User can manually navigate and use non-AI features
```

### User Already Has Profile
```
1. User authenticates (any method)
2. Has complete profile with username
3. isNewUser = false
4. No pending sessions
5. Applies Priority 4 (Role-Based) or Priority 6 (Fallback)
6. REDIRECT to role-appropriate page
```

---

## Implementation Locations

### Core Files

1. **`/app/auth/callback/route.ts`**
   - Handles OAuth callbacks
   - Exchanges code for session
   - Calls `getRedirectResponse()` to determine redirect

2. **`/app/lib/routing/redirectService.ts`**
   - Contains priority-based redirect logic
   - `determineRedirect()` method runs all checks
   - Returns `{ path, reason, priority }`

3. **`/app/lib/routing/redirectContext.ts`**
   - Builds context object with all necessary data
   - Queries database for sessions, profile, etc.
   - Provides data to redirectService

4. **`/app/lib/routing/redirectHelpers.server.ts`**
   - Server-side helper: `getRedirectResponse()`
   - Creates NextResponse.redirect with cookies

5. **`/app/lib/routing/redirectHelpers.client.ts`**
   - Client-side helper: `redirectAfterAuth()`
   - Uses Next.js router.push()

6. **`/app/api/onboarding/after-consent/route.ts`**
   - Post-consent redirect logic
   - Updates session states
   - Returns redirect path to ConsentSetupModal

7. **`/app/contexts/ConsentSetupContext.tsx`**
   - Detects if consent modal should show
   - Checks `user_consents.consent_setup_completed_at`
   - Blocks all other UI until consent given

8. **`/app/components/auth/ConsentSetupModal.tsx`**
   - UI for consent collection
   - Calls `/api/onboarding/after-consent` on save
   - Uses router.push() to navigate with query params

9. **`/middleware.ts`**
   - Refreshes Supabase session for `/` and `/welcome/*` paths
   - Critical for OAuth cookie synchronization

---

## Query Parameters

### `?profile_completion=true`
**Used**: When redirecting to `/welcome/owner` or `/welcome/crew` after consent  
**Purpose**: Triggers AI profile completion mode  
**Handler**: `OwnerChatContext` or `ProspectChatContext` useEffect  
**Action**: Calls `/api/ai/owner/trigger-profile-completion` which sends SYSTEM prompt to AI

### `?from=owner` or `?from=prospect`
**Used**: When redirecting from signup/login forms  
**Purpose**: Indicates user intent (owner vs crew)  
**Handler**: `/auth/callback` route  
**Action**: Influences redirect decision in Priority 3 (Source-Based)

---

## Testing Scenarios

### Scenario 1: New User - Google OAuth from Owner Chat
```
✓ User visits /welcome/owner (unauthenticated)
✓ Starts chat with AI
✓ Session created: onboarding_state = 'signup_pending'
✓ Clicks "Continue with Google"
✓ OAuth completes → /auth/callback
✓ Session linked to user.id
✓ onboarding_state = 'consent_pending'
✓ REDIRECT to /welcome/owner
✓ ConsentSetupModal shows
✓ User accepts consent (including AI processing)
✓ onboarding_state = 'profile_pending'
✓ REDIRECT to /welcome/owner?profile_completion=true
✓ AI receives SYSTEM prompt
✓ Onboarding continues
```

### Scenario 2: New User - Email Auth, No Chat History
```
✓ User visits /auth/signup
✓ Submits email/password
✓ EmailConfirmationModal shows
✓ Clicks "Continue to SailSmart"
✓ Redirected to /
✓ Clicks email verification link
✓ /auth/callback processes
✓ No pending sessions found
✓ isNewUser = true
✓ REDIRECT to /crew (Priority 5)
✓ ConsentSetupModal shows
✓ User accepts consent
✓ REDIRECT to / (no pending session)
✓ User can browse or start AI onboarding
```

### Scenario 3: Returning User with Incomplete Profile
```
✓ User logs in (any method)
✓ Has profile but incomplete (no username)
✓ Has owner_session with profile_completion_triggered_at set
✓ REDIRECT to /welcome/owner?profile_completion=true (Priority 2)
✓ AI resumes profile completion
```

---

## Current Issues (To Be Fixed)

1. **Issue**: Redirect to /profile-setup still happening in some cases
   - **Root Cause**: TBD - need to trace
   - **Fix**: Remove all /profile-setup redirects

2. **Issue**: SYSTEM prompt not being sent after consent
   - **Root Cause**: router.push() with query params not triggering properly
   - **Fix**: ConsentSetupModal now uses router.push() even on same page

3. **Issue**: User not authenticated on /welcome pages after OAuth
   - **Root Cause**: Middleware wasn't running on /welcome/* paths
   - **Fix**: Middleware now runs on /welcome/* for session refresh

4. **Issue**: Modal appearing under header
   - **Root Cause**: Z-index scale had modal below header
   - **Fix**: Bumped modal z-index to 1000

---

## Open Questions

1. Should users who opt out of AI consent be able to still use AI features later?
2. If user has both owner and crew roles, which page should they land on?
3. Should /profile-setup route be completely deleted or kept as fallback?
4. What happens if user closes browser mid-onboarding and returns days later?

---

## Success Criteria

After implementing this specification:

- [ ] All auth methods (email, Google, Facebook) follow same redirect logic
- [ ] Users with pending sessions ALWAYS return to AI onboarding
- [ ] ConsentSetupModal blocks all actions until consent given
- [ ] After consent, AI receives SYSTEM prompt and continues onboarding
- [ ] No redirects to /profile-setup
- [ ] Consistent behavior across all entry points
- [ ] Clear logging shows which redirect rule was applied and why
