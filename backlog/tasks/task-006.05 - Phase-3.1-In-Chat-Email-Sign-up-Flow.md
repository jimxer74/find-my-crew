---
id: TASK-006.05
title: 'Phase 3.1: In-Chat Email Sign-up Flow'
status: In Progress
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-09 12:28'
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
- [ ] #1 Sign-up form appears inline within chat
- [ ] #2 Form validates email and password
- [ ] #3 Successful signup triggers email confirmation
- [ ] #4 User profile created with gathered preferences
- [ ] #5 Error states handled gracefully in chat context
<!-- AC:END -->
