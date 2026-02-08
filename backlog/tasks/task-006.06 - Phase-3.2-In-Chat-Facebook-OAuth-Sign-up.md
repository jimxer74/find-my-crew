---
id: TASK-006.06
title: 'Phase 3.2: In-Chat Facebook OAuth Sign-up'
status: To Do
assignee: []
created_date: '2026-02-08 17:44'
labels:
  - auth
  - oauth
  - facebook
  - phase-3
dependencies: []
parent_task_id: TASK-006
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Facebook OAuth sign-up within the chat flow.

**Depends on:** TASK-006.05 (Email signup)

**Flow:**
1. AI offers Facebook as sign-up option
2. User clicks Facebook button in chat
3. OAuth popup opens
4. User authenticates with Facebook
5. Popup closes, chat updates with success
6. Profile auto-populated from gathered preferences + Facebook data

**Components:**
- `InlineChatFacebookAuth.tsx` - Facebook OAuth button for chat
- Handle OAuth callback within chat context
- Merge Facebook profile data with gathered preferences

**Considerations:**
- Popup vs redirect (popup preferred for seamless experience)
- Handle popup blockers gracefully
- Fallback to redirect if popup fails
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Facebook OAuth button appears in chat
- [ ] #2 OAuth flow completes without leaving chat page
- [ ] #3 User profile created with merged data
- [ ] #4 Handles popup blockers gracefully
- [ ] #5 Error states handled in chat context
<!-- AC:END -->
