---
id: TASK-006.06
title: 'Phase 3.2: In-Chat Facebook OAuth Sign-up'
status: Done
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-20 10:36'
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
Implement Facebook OAuth sign-up within the chat flow for both onwers and crew (prospect flow)

**Depends on:** TASK-006.05 (Email signup)

**Flow:**
1. AI offers Facebook as sign-up option
2. User clicks Facebook button in chat
3. OAuth popup opens
4. User authenticates with Facebook
5. Popup closes, chat updates with success

** Important** there is existing functionality fetch user's extended information from Facebook, but it using it would require extensive review by Facebook and practically in this stage it is not realistic to achieve. So do not use the Facebook extended data fetching option for Facebook sign-up / log in as of now. Please do not remove the functionality, lets keep it for future use, if the Facebook app review is made and if the data fetching is possible. However basic user data, such as names, image, email can be retrieved from Facebook if user gives consent for it of course in Facebook auth flow.

**Components:**
- `InlineChatFacebookAuth.tsx` - Facebook OAuth button for chat
- Handle OAuth callback within chat context
- Merge Facebook profile data with gathered information

**Considerations:**
- Popup vs redirect (popup preferred for seamless experience)
- Handle popup blockers gracefully
- Fallback to redirect if popup fails
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Facebook OAuth button appears in chat
- [x] #2 OAuth flow completes without leaving chat page
- [x] #3 User profile created with merged data
- [x] #4 Handles popup blockers gracefully
- [x] #5 Error states handled in chat context
<!-- AC:END -->
