---
id: TASK-006.07
title: 'Phase 4.1: In-Chat Leg Registration'
status: To Do
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-09 18:41'
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
2. AI confirms the leg details
3. Chat displays inline registration form (notes, confirm)
4. Registration submitted to existing API
5. Confirmation shown in chat
6. AI suggests next steps (view other legs, complete profile)

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
