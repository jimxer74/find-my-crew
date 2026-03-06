---
id: TASK-134
title: Bugs and Enhancements
status: Done
assignee: []
created_date: '2026-02-25 15:02'
updated_date: '2026-03-06 08:59'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
** /welcome/crew-v2 and owner-v2 flows**
- no consent modal displayd after signup
- OAuth signup redirects to /crew, should retain in ai flow
- Add link to profile completion banner to continue with ai onboarding
- When profile is saved after signup, role is not stored, it should be stored based on the onboarding flow. e.g. /welcome/crew-v2 should get crew role
- Make sure all the buttons in both crew and owner flows uses loading button in long running operations
- Fix "Send" button to match the input textbox size
- Add a disclaimer text before user click create account to indicate that by creating account user is confirming the usage of AI to access the profile data

** Frontpage **
- Update for Skippers and for Crew sections: remove AI consent toggle and add text below the textarea to indicate that by submitting users confirm the usage of AI to access the profile date. Remove consent validation logic from Post button
- Change top right Sign up button to "Log in"

** /crew/dashboard**
- In mobile view the botton sheet is not minimizable when user has scrolled the list downwards, the bottom sheet must be allways resizable
- Mobile view bottom sheet when fully maximized gets overfilled in the Header and cannot be resized anymore as it is renderec under the header.

** /welcome/crew and /welcome/owner**
- consent modal is not displayed after signup
- Update the UI use the same concept as in /welcome/crew-v2 and owner-v2 with same color schemes and glassmorphism look and feel

** Privacy policy **
- Refactor DELETE MY ACCOUNT to use supabase async feature with progress UI indicator
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes Implemented

### Frontpage (`app/page.tsx`)
- Changed top-right "Sign Up" button to "Log in" linking to `/auth/login`
- Removed AI consent toggle from `OwnerPostDialog` — replaced with disclaimer text ("By submitting, you confirm that AI may process your input...")
- Removed `!aiConsent` from Post button disabled condition (now only requires non-empty text)
- Removed unused `tPrivacy` translation import

### BottomSheet (`shared/ui/BottomSheet.tsx`)
- Removed scroll-top check (`canCollapse`) from `onSwipedDown` — swipe-down now always collapses the sheet regardless of scroll position
- Changed default `expandedHeight` from `calc(100vh - 4rem)` to `calc(100dvh - 4.5rem)` so expanded sheet clears the app header (z-[110])

### Chat Send Button (`CrewOnboardingChat.tsx`, `OnboardingChat.tsx`)
- Added `self-end h-[38px]` to Send Button className to match the textarea `min-h-[38px]`

### Onboarding V2 Disclaimer (`CrewOnboardingV2.tsx`, `OwnerOnboardingV2.tsx`)
- Added disclaimer text before "Create account" button explaining AI data usage

### OAuth Redirect Fix (`app/auth/callback/route.ts`)
- Uncommented v2-specific short-circuit redirects for `from=crew-v2` and `from=owner-v2`
- OAuth signups from `/welcome/crew-v2` now redirect back to `/welcome/crew-v2` instead of `/`
- OAuth signups from `/welcome/owner-v2` now redirect back to `/welcome/owner-v2`

### Consent Modal for Legacy Flows (`app/welcome/crew/page.tsx`, `app/welcome/owner/page.tsx`)
- Added `useAuth`, `useConsentSetup`, and `ConsentSetupModal` to both pages
- Consent modal is shown after signup if user hasn't set up consent
- Added background image + blue/amber overlay matching v2 glassmorphism style

### Profile Completion Banner (`shared/components/profile/ProfileCompletionPrompt.tsx`)
- Updated CTA link to use v2 AI flows (`/welcome/crew-v2`, `/welcome/owner-v2`) instead of legacy flows
- Fixed typo: "get better matches" → "to get better matches"

### Delete Account Progress UI (`app/settings/privacy/page.tsx`)
- Added `deletionStep` state to show progress messages during deletion
- Shows "Deleting your account data…" spinner while API call runs
- Updates to "Signing you out…" before logout
- Spinner indicator displayed in the confirmation dialog during deletion
<!-- SECTION:FINAL_SUMMARY:END -->
