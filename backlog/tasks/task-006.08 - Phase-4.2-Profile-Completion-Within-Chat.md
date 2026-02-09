---
id: TASK-006.08
title: 'Phase 4.2: Profile Completion Within Chat'
status: In Progress
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-09 14:03'
labels:
  - profile
  - phase-4
dependencies: []
parent_task_id: TASK-006
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to complete their profile within the chat after signing up, using information already gathered during the conversation.

**Depends on:** Phase 3 tasks

**Flow:**
Previous phase:
option a) Email sign-up
- User signs-in via email and is notified to go to email and confirm registration.
- User clicks the https://www.sailsm.art -homepage in email link and is directed to /page.tsx
option b) OAuth (Facebook sign-up)
- User signs using Facebook identity and is rediredect to https://www.sailsm.art/ -homepage

1. After redirection to homepage, there must be a logic to check that if sign-up process was started in AI assistant. If yes, redirect user to AI assistant and AI suggest completing the profile
2. Shows what information was already gathered
3. Asks for any missing required fields
4. Updates profile via existing API
5. Calculates profile completion percentage

**Pre-populated Fields (from conversation):**
- `user_description` - From sailing goals discussion
- `sailing_experience` - From experience level questions
- `risk_level` - From adventure preference questions
- `skills` - From skills/certifications discussion
- `sailing_preferences` - From location preferences

**Missing Fields to Collect:**
- `full_name` (if not from Facebook)
- `phone` (optional)
- `certifications` (if not discussed)
- Profile image (optional, can skip in chat)

**Components:**
- `InlineChatProfileCompletion.tsx` - Profile fields in chat
- Show profile completion progress
- Link to full profile page for advanced editing
- 

**Additional notes**
- Create tools for fetching the Decriptions for Sailing Experience Levels: (Beginner, Competent crew, Coastal Skipper, Offshore Skipper), Risk Levels and Skills definitions so that AI can show them in chat if needed
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AI shows gathered information after signup
- [ ] #2 Missing fields requested in chat
- [ ] #3 Profile updated via API
- [ ] #4 Profile completion percentage calculated
- [ ] #5 Option to continue to full profile page
<!-- AC:END -->
