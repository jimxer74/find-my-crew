---
id: TASK-033
title: Sign-up and login improvements
status: Done
assignee: []
created_date: '2026-01-26 12:19'
updated_date: '2026-01-26 12:23'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improvements to sign-up and login flow.

- Remove the Consent & Preferences and Optional preferences setup from the sign-up page (Create your account)
- Instead, enforce a modal dialog with all the consents and preferences to be verfied and selected by the user after the first successful login. User must verify and set the preferences before continuing using the app.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Summary

### Changes Made

1. **Simplified Sign-up Page** (`app/auth/signup/page.tsx`)
   - Removed the entire "Consent & Preferences" section with individual checkboxes
   - Removed optional preferences (AI processing, profile sharing, marketing)
   - Kept only a single checkbox for accepting Privacy Policy and Terms of Service (required)
   - Simplified the signup flow to only save minimal consent data

2. **Created Database Migration** (`migrations/010_add_consent_setup_completed.sql`)
   - Added `consent_setup_completed_at` field to `user_consents` table
   - This tracks when a user has completed the initial consent setup modal

3. **Created ConsentSetupModal** (`app/components/auth/ConsentSetupModal.tsx`)
   - Full-screen modal that blocks app usage until completed
   - Includes all consent options:
     - AI-powered matching consent
     - Profile sharing consent
     - Marketing email consent
   - Saves preferences and marks setup as complete
   - Logs all consent changes to audit trail

4. **Created ConsentSetupProvider** (`app/contexts/ConsentSetupContext.tsx`)
   - Context provider that checks if user needs to complete consent setup
   - Automatically shows ConsentSetupModal for users who haven't completed setup
   - Integrated into app layout

5. **Updated App Layout** (`app/layout.tsx`)
   - Added ConsentSetupProvider to wrap the app
   - Modal appears automatically after login for users who need to complete setup

### User Flow

1. User signs up with just name, email, password, and accepts Privacy Policy/Terms
2. After signing up (or logging in for existing users without completed setup), the ConsentSetupModal appears
3. User must set their preferences before they can use the app
4. Preferences can be changed later in Settings > Privacy
<!-- SECTION:FINAL_SUMMARY:END -->
