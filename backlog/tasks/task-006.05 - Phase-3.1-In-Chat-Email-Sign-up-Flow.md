---
id: TASK-006.05
title: 'Phase 3.1: In-Chat Email Sign-up Flow'
status: Done
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-09 12:43'
labels:
  - auth
  - signup
  - phase-3
dependencies: []
parent_task_id: TASK-006
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement email-based sign-up within the chat interface without redirecting to external pages.

**Depends on:** Phase 2 tasks

**Flow:**
1. AI suggests sign-up when user shows interest in a leg
2. User agrees to sign up
3. Chat displays inline sign-up form (name, email, password)
4. Form submission triggers Supabase auth signup
5. Email confirmation sent
6. User returns and confirms email
7. Profile auto-populated from gathered preferences

**Components:**
- `InlineChatSignupForm.tsx` - Email signup form styled to match chat
- Integration with existing Supabase auth
- Email confirmation handling within chat context

**Profile Auto-Population:**
Map gathered preferences to profile fields:
- `sailingGoals` → `user_description`
- `experienceLevel` → `sailing_experience`
- `riskLevels` → `risk_level`
- `skills` → `skills`
- `preferredLocations` → `sailing_preferences`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sign-up form appears inline within chat
- [x] #2 Form validates email and password
- [x] #3 Successful signup triggers email confirmation
- [x] #4 User profile created with gathered preferences
- [x] #5 Error states handled gracefully in chat context
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Notes (2026-02-09)

### Components Created

1. **InlineChatSignupForm.tsx** (`app/components/prospect/`)
   - Email signup form styled to match chat interface
   - Collects full name, email, password
   - Supports Facebook OAuth with preference preservation
   - Shows success state with email confirmation message
   - Stores prospect preferences in user metadata for later sync

2. **InlineChatLoginForm.tsx** (`app/components/prospect/`)
   - Companion login form for returning users
   - Same inline chat styling
   - Facebook OAuth support

### Integration Points

1. **ProspectChat.tsx** updated:
   - Added `showAuthForm` state ('signup' | 'login' | null)
   - Sign up button appears in header after 2+ messages
   - Forms render inline within chat message area
   - Preferences passed from context to signup form

2. **Auth callback route** updated:
   - Detects `from=prospect` parameter
   - Reads `prospect_preferences` from user metadata
   - Syncs preferences to profile fields:
     - experienceLevel → sailing_experience
     - skills → skills
     - riskLevels → risk_level (with enum mapping)
     - sailingGoals → sailing_preferences

### Preference Mapping

```typescript
ProspectPreferences → Profile
- experienceLevel (1-4) → sailing_experience
- skills[] → skills[]
- riskLevels[] → risk_level[] (mapped to enum)
- sailingGoals → sailing_preferences
```
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Complete

### Files Created
- `app/components/prospect/InlineChatSignupForm.tsx` - Inline email signup form
- `app/components/prospect/InlineChatLoginForm.tsx` - Inline login form for returning users

### Files Modified
- `app/components/prospect/ProspectChat.tsx` - Integrated signup/login forms, added header button
- `app/auth/callback/route.ts` - Added prospect preference syncing to profile

### Key Features Delivered

1. **Inline Signup Form**
   - Styled to match chat interface (appears as assistant message)
   - Collects: full name, email, password
   - Facebook OAuth with preference preservation
   - Success state shows email confirmation instructions
   - "Maybe later" and "Already have an account?" options

2. **Inline Login Form**
   - Matching chat styling
   - Email/password and Facebook OAuth
   - Switch to signup option

3. **Sign-up Trigger**
   - "Sign up" button appears in chat header after 2+ messages
   - Forms render inline within message area
   - Can be dismissed with "Maybe later"

4. **Preference Syncing**
   - Preferences stored in `user_metadata.prospect_preferences` during signup
   - Auth callback detects `from=prospect` parameter
   - Syncs to profile on first login:
     - `experienceLevel` → `sailing_experience`
     - `skills[]` → `skills[]`
     - `riskLevels[]` → `risk_level[]` (with enum mapping)
     - `sailingGoals` → `sailing_preferences`

### Testing Notes
- Build passes successfully
- Forms validate required fields and password length
- Error states display inline with destructive styling
- OAuth redirects preserve `from=prospect` for preference sync
<!-- SECTION:FINAL_SUMMARY:END -->
