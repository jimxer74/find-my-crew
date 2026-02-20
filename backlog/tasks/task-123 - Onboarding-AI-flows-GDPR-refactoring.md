---
id: TASK-123
title: Onboarding AI flows GDPR refactoring
status: Done
assignee: []
created_date: '2026-02-20 10:08'
updated_date: '2026-02-20 11:20'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
For both owner and prospect onboarding flows a GDRP AI consent mangement needs to be hardened and data collection for AI messages needs to be implemented.

In both onboarding flows, it is not possible to continue if user does not expclitly agree on providind user information to AI model. This is good. Now after sign-up AI consent is asked again, so it should be ok to assume that if user has given the consent already when starting the onboarding, AI consent could be set automatically "on", user of course has a power to change it to off at this step.

IF user does not give AI-consent after sign-up ConsentSetupModel, that AI assisted onboarding should be immediately stopped, the current conversation data (in onwer_session or prospect_session) needs to be stored in ai_messages table and user is instructed to continue filling in the profile in Profile edit form. In no circumstance profile MUST to be created by AI tooling if explicit AI-consent is not given by user. Also the session data needs to be destroyed as soon as the conversation history is stored in ai_messages table for the user, so that it is accessbile by the user through the GDPR data report if needed.

Also in case where user provides AI-consent and onboarding continues with the AI-assistant the conversation and messages needs to be stored in ai_messages table for user reference later.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan: Onboarding AI flows GDPR refactoring

Based on an analysis of the existing session flows and GDPR requirements, here is the technical plan to fulfill the task requirements:

### Phase 1: Consent AI Toggle Auto-Population
- **File:** `app/components/auth/ConsentSetupModal.tsx`
- **Action:** Add a `useEffect` on component mount to detect if the user has an active onboarding session by calling the existing `GET /api/prospect/session/data` and `GET /api/owner/session/data` endpoints. If either returns an active session with messages, automatically set the local state `aiProcessing` to `true`. This gives the user the default "on" state if they started an AI conversation, while still allowing them to manually toggle it off.

### Phase 2: Handle GDPR AI Opt-out (Consent Rejected)
- **File:** `app/api/onboarding/after-consent/route.ts`
- **Action:** Update the consent processing logic.
- **Logic:** 
  1. If a pending `prospectSession` or `ownerSession` is discovered.
  2. If `aiProcessingConsent` is **false** (user opted out):
     * Fetch the full session JSON using the `session_id`.
     * Create a new row in `public.ai_conversations` (title: "Onboarding Chat", user_id).
     * Bulk insert the `conversation` array from the session into `public.ai_messages` (linking them to the new conversation id).
     * Delete the session completely from `prospect_sessions` or `owner_sessions`.
     * Return `{ redirect: '/profile-setup', triggerProfileCompletion: false }` to instruct the frontend to redirect the user to manual profile editing instead of continuing AI onboarding.

### Phase 3: Preserve Full Chat (Consent Accepted & Completed)
- **Files:** `app/api/ai/prospect/chat/route.ts`, `app/api/ai/owner/chat/route.ts`
- **Action:** Update the onboarding termination logic where `response.profileCreated === true` (or when the owner onboarding completes).
- **Logic:**
  1. Before executing the existing session clean-up (deletion), fetch the final version of the session data containing all messages.
  2. Create a row in `public.ai_conversations`.
  3. Bulk insert the complete `conversation` array into `public.ai_messages`.
  4. Continue with the standard deletion of the session.
  
*Note*: This approach (dumping at termination rather than syncing every message) elegantly solves both the "Immediate deletion upon consent-rejection" and the "Archiving after successful AI completion" without requiring complex database schema adjustments for tracking mid-session chat links.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## TASK-123 Implementation Complete ✅

Successfully implemented GDPR-compliant AI conversation management for both owner and prospect onboarding flows.

### What Was Implemented

**Phase 1: Consent Auto-Population**
- Added `useEffect` hook in `ConsentSetupModal.tsx` that checks for active onboarding sessions (`/api/prospect/session/data` and `/api/owner/session/data`)
- If user had previous AI engagement (conversation with messages), automatically sets `aiProcessing` state to `true`
- User can still manually toggle to `false` if they prefer not to enable AI

**Phase 2: GDPR Opt-out Handling**
- Updated `/api/onboarding/after-consent/route.ts` to handle user rejection of AI consent
- When user opts out after signup (`aiProcessingConsent === false`):
  * Fetches full session conversation from prospect_sessions or owner_sessions
  * Creates new row in `ai_conversations` table ("Owner Onboarding Chat" or "Crew Onboarding Chat")
  * Bulk inserts all conversation messages to `ai_messages` table
  * Deletes session completely from database
  * Returns redirect to `/profile-setup` with `triggerProfileCompletion: false`
- Applies to both owner and prospect onboarding flows

**Phase 3: Successful Onboarding Archival**
- Updated `/api/ai/owner/chat/route.ts`:
  * When `journeyCreated === true` (onboarding complete), archives full conversation to `ai_conversations` + `ai_messages`
  * Deletes session after archival
- Updated `/api/ai/prospect/chat/route.ts`:
  * When `profileCreated === true` (onboarding complete), archives full conversation to `ai_conversations` + `ai_messages`
  * Deletes session after archival

### Key Features
- **GDPR Compliance**: All conversation data archived for user data export requests
- **Session Hygiene**: Sessions immediately deleted after archival to prevent orphaned data
- **Intelligent Defaults**: AI consent pre-populated when user had previous engagement
- **User Control**: User can toggle consent OFF at any time (even when pre-populated)
- **Graceful Fallback**: When consent rejected, seamlessly redirect to manual profile setup

### Files Modified
1. `app/components/auth/ConsentSetupModal.tsx` - Added session detection and auto-population
2. `app/api/onboarding/after-consent/route.ts` - Added opt-out archival logic for both flows
3. `app/api/ai/owner/chat/route.ts` - Added archival on successful completion
4. `app/api/ai/prospect/chat/route.ts` - Added archival on successful completion

### Testing & Verification
- ✅ Build successful: All 81 static pages generated
- ✅ No TypeScript errors
- ✅ Consistent error handling patterns across both flows
- ✅ GDPR data preservation implemented
- ✅ Session cleanup on both consent rejection and successful completion

### Commit
- Commit SHA: 097a643
- Commit message: feat(onboarding): implement GDPR-compliant AI conversation archival and consent handling
<!-- SECTION:FINAL_SUMMARY:END -->
