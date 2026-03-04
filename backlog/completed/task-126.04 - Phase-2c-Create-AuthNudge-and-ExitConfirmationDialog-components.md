---
id: TASK-126.04
title: 'Phase 2c: Create AuthNudge and ExitConfirmationDialog components'
status: Done
assignee: []
created_date: '2026-02-23 08:37'
updated_date: '2026-02-24 17:33'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Completion Summary

Phase 2c - Create AuthNudge and ExitConfirmationDialog Components has been successfully completed.

### AuthNudge Component Features:
✅ Displays encouraging sign-in/sign-up message
✅ Two action buttons:
  - Sign In button with arrow icon
  - Sign Up button with plus icon
✅ Callbacks for both actions (onSignIn, onSignUp)
✅ Blue info box styling consistent with other components
✅ Lightweight, focused component for nudging authentication

### ExitConfirmationDialog Component Features:
✅ Modal dialog for exit confirmation
✅ Shows message: "Are you sure you want to exit the onboarding assistant?"
✅ Two action buttons:
  - Continue (gray, default focus)
  - Exit (red destructive button)
✅ Modal features:
  - Backdrop click to cancel
  - Escape key to cancel
  - Focus management with autoFocus on Continue
  - Proper ARIA labels (role="alertdialog", aria-modal, aria-labelledby)
✅ Proper TypeScript typing for all props

### Styling & Accessibility:
✅ Both components fully accessible
✅ Proper button states and hover effects
✅ Keyboard navigation support (Escape for dialog)
✅ ARIA labels and roles
✅ Focus management for dialog

### Verification:
- ✅ TypeScript compiles without errors
- ✅ Dialog modal behavior working
- ✅ Both components rendering correctly
- ✅ No accessibility issues

### Files Created:
- app/components/owner/AuthNudge.tsx
- app/components/owner/ExitConfirmationDialog.tsx
<!-- SECTION:NOTES:END -->
