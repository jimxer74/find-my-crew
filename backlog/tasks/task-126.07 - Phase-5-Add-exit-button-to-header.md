---
id: TASK-126.07
title: 'Phase 5: Add exit button to header'
status: To Do
assignee: []
created_date: '2026-02-23 08:37'
labels: []
dependencies: []
references:
  - app/components/Header.tsx
  - app/components/owner/OwnerChat.tsx
  - app/contexts/OwnerChatContext.tsx
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add \"Exit Assistant\" button to app/components/Header.tsx that appears only for authenticated users on onboarding page.

Changes needed:
1. In Header.tsx right section (lines 169-244), add conditional exit button:
   - Show only if: user is authenticated AND on /owner/onboarding page
   - Button text: \"Exit Assistant\"
   - Button style: secondary variant

2. Wire button to ExitConfirmationDialog:
   - On click, open confirmation dialog
   - Dialog asks: \"Are you sure you want to exit the onboarding assistant?\"
   - [Continue] button: closes dialog, stays in assistant
   - [Exit] button: calls closeSession() and navigates to /owner/profile

3. Implement closeSession() function in OwnerChat context or hook:
   - Marks session as completed (similar to normal completion)
   - Updates owner_sessions.onboarding_state to 'completed'
   - Archives session to ai_conversations table
   - Clears local state

4. Expose closeSession via context or custom hook for header to access

Conditional rendering:
- Check if user authenticated: useAuth().user !== null
- Check current page: usePathname() === '/owner/onboarding'
- Only show when BOTH conditions true
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Exit button shows only when user authenticated
- [ ] #2 Exit button shows only on /owner/onboarding page
- [ ] #3 Click button opens confirmation dialog
- [ ] #4 Dialog text clear: "Are you sure you want to exit?"
- [ ] #5 Continue button closes dialog, stays in assistant
- [ ] #6 Exit button closes session and navigates to /owner/profile
- [ ] #7 Session properly cleaned up (archived, marked complete)
- [ ] #8 TypeScript compiles without errors
- [ ] #9 No visual layout issues in header
<!-- AC:END -->
