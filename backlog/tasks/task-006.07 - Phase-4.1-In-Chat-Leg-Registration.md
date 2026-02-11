---
id: TASK-006.07
title: 'Phase 4.1: In-Chat Leg Registration'
status: Done
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-11 08:28'
labels:
  - registration
  - phase-4
dependencies: []
parent_task_id: TASK-006
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow signed-up users to register for sailing legs directly within the chat interface.

**Depends on:** Phase 3 tasks (user must be authenticated)

**Flow:**
Scenario a) prospect user, not  logged in 
1. User clicks "join" for the leg in prospect AI assistant when not singed-up or logged-in yet
2. User goes through the whole sign-up and profile creation conversation flow and gets finally logged in
** IMPORTANT** an UUID of the leg that user registered or joined, must be carried over to main registration flow below, so that after successful signup, profile creation and login, user can directly continue registration process for the leg.

Scenario b) known logged in user
1. User clicks on a leg badge or says "I want to register for [leg name]"

Main Registration flow, after a or b scenario
2. AI confirms the leg details and requirements
3. AI informs user if the leg or journey requirements or type of sailing does not match users profile or aspirations
3. AI checks if a Journey has registration questions for autoapproval
4. AI asks the required registration questions to be filled by user and provides immediate improvement ideas and suggestions for better possibilities for autoapproval
3. Once all the regisration questions has been asked and answered, AI asks to "Approve" the registration 
4. If Approved by user registration is submitted to existing API
5. Confirmation shown in chat
6. AI suggests next steps (e.g. preparation for the journey, or improving the profile)
7. As final message AI provides some nice encouraging words to say goodbuy
8. A button to close the chat is displayed and clicking it redirects user to /crew homepage

**Components:**
- `InlineChatRegistrationForm.tsx` - Registration form for chat
- Reuse existing registration API (`/api/registrations`)
- Show leg summary before registration

**Integration:**
- Use existing registration logic from `RegistrationRequirementsForm`
- Match percentage calculation
- Notification to boat owner
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Registration questions asked conversationally by AI (no inline forms)
- [ ] #2 Leg details shown before confirming registration
- [ ] #3 Registration creates record in database via existing API
- [ ] #4 Confirmation message shown in chat after success
- [ ] #5 Owner notified of new registration
- [ ] #6 Prospect leg UUID carried over through signup flow
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Approach: Conversational Registration (No Inline Forms)

The AI will ask registration questions directly in the conversation, NOT via inline forms. This provides a more natural and guided experience.

### Changes Required:

#### 1. Add new tool: `submit_leg_registration` (in `definitions.ts`)
- Action tool that creates a pending action for registration
- Accepts: `legId`, `answers` (array of requirement answers), `notes`
- The AI collects answers conversationally and passes them when submitting

#### 2. Update `get_leg_registration_info` tool
- Already returns requirements - ensure it has all data needed for conversational Q&A
- Returns: `requirements` array with question_text, question_type, options, is_required

#### 3. Update CREW_REGISTER prompt template (in `modular-prompts.ts`)
- Guide AI to:
  1. Fetch leg details and requirements using `get_leg_registration_info`
  2. Show leg summary and confirm user wants to proceed
  3. Ask each requirement question conversationally (one at a time or grouped)
  4. Provide suggestions for better auto-approval chances
  5. Once all questions answered, summarize and ask user to confirm
  6. Call `submit_leg_registration` with collected answers
  7. Show success message with next steps

#### 4. Add tool executor for `submit_leg_registration` (in `toolExecutor.ts`)
- Creates pending action with registration data
- On approval, calls `/api/registrations` with answers

#### 5. Handle leg UUID carry-over for prospect signup
- Store `pending_leg_registration` in localStorage when prospect clicks "Join"
- After signup completion, detect and start registration flow

#### 6. Add close/redirect functionality after success
- After successful registration, AI provides farewell message
- Show button to close chat and redirect to /crew

### Flow Diagram:

```
User: "I want to register for [leg]"
  ↓
AI: get_leg_registration_info(legId)
  ↓
AI: Shows leg summary, asks "Would you like to proceed?"
  ↓
User: "Yes"
  ↓
AI: Asks Question 1 (from requirements)
  ↓
User: [Answer 1]
  ↓
AI: Asks Question 2...
  ↓
... (all questions asked conversationally)
  ↓
AI: "Here's a summary of your answers. Ready to submit?"
  ↓
User: "Yes" / Clicks Approve button
  ↓
AI: submit_leg_registration(legId, answers, notes)
  ↓
Registration created → Success message → Close button
```
<!-- SECTION:PLAN:END -->
