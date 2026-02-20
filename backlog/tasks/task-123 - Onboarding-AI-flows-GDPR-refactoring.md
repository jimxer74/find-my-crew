---
id: TASK-123
title: Onboarding AI flows GDPR refactoring
status: To Do
assignee: []
created_date: '2026-02-20 10:08'
updated_date: '2026-02-20 10:59'
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
