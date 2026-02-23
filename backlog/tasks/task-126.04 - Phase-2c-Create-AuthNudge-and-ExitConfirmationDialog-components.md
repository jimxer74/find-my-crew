---
id: TASK-126.04
title: 'Phase 2c: Create AuthNudge and ExitConfirmationDialog components'
status: To Do
assignee: []
created_date: '2026-02-23 08:37'
labels: []
dependencies: []
references:
  - app/components/owner/OwnerChat.tsx
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create two lightweight components:

**AuthNudge.tsx**
Props: { message: string; onSignIn: () => void; onSignUp: () => void }
- Displays encouraging message for user to sign in/sign up
- Shows [Sign In] and [Sign Up] buttons
- Triggers existing auth modals via callbacks

**ExitConfirmationDialog.tsx**
Props: { onConfirm: () => void; onCancel: () => void; isOpen: boolean }
- Modal dialog asking \"Are you sure you want to exit the onboarding assistant?\"
- Shows [Continue] and [Exit] buttons
- onConfirm closes session and navigates to /owner/profile
- onCancel just closes dialog, stays in assistant

Both components should have:
- Proper accessibility (modal focus trap, ARIA labels)
- Consistent styling with rest of app
- Proper TypeScript typing
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AuthNudge displays message and two buttons
- [ ] #2 AuthNudge buttons trigger onSignIn/onSignUp callbacks
- [ ] #3 ExitConfirmationDialog shows confirmation message
- [ ] #4 ExitConfirmationDialog has Continue and Exit buttons
- [ ] #5 ExitConfirmationDialog properly manages open/close state
- [ ] #6 Both components have proper TypeScript typing
- [ ] #7 Both components accessible (labels, ARIA, focus management)
<!-- AC:END -->
