---
id: TASK-006.07
title: 'Phase 4.1: In-Chat Leg Registration'
status: To Do
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-09 18:50'
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
- [ ] #1 Registration form appears inline in chat for authenticated users
- [ ] #2 Leg details shown before confirming registration
- [ ] #3 Registration creates record in database
- [ ] #4 Confirmation message shown in chat
- [ ] #5 Owner notified of new registration
<!-- AC:END -->
