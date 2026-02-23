---
id: TASK-126.05
title: 'Phase 3: Update OwnerChat message handling and rendering'
status: To Do
assignee: []
created_date: '2026-02-23 08:37'
labels: []
dependencies: []
references:
  - app/components/owner/OwnerChat.tsx
  - app/types.ts
  - app/contexts/OwnerChatContext.tsx
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update OwnerChat.tsx to handle the three new response types via message metadata.

Changes needed:
1. Extend OwnerMessage type in types.ts with metadata fields:
   - responseType: 'clarification' | 'confirmation' | 'auth_nudge' | 'info'
   - questionType?: 'radio-select' | 'text-input' | 'date-select' | 'multi-select'
   - dataType?: 'profile-summary' | 'boat-summary' | 'journey-summary' | 'skipper-profile' | 'crew-requirements'

2. Update OwnerChat rendering logic (around lines 296-410):
   - After rendering assistant message, check metadata.responseType
   - If 'clarification': render ClarificationInput component
   - If 'confirmation': render ConfirmationDisplay component
   - If 'auth_nudge': render AuthNudge component
   - If 'info' or undefined: render plain message

3. Create handler functions:
   - handleClarificationSubmit(value): Submit answer as follow-up message to AI
   - handleConfirmationConfirm(): Call API to save data, proceed
   - handleConfirmationEdit(feedback): Send feedback to AI for refinement
   - handleAuthSignIn/SignUp: Trigger auth modals

4. Wire handlers to component callbacks

5. Update auto-save logic to persist all messages including new response metadata
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OwnerMessage type extended with response metadata
- [ ] #2 Message rendering checks responseType and renders appropriate component
- [ ] #3 ClarificationInput submits answers correctly
- [ ] #4 ConfirmationDisplay confirm/edit/feedback flow works
- [ ] #5 AuthNudge buttons trigger auth modals
- [ ] #6 All handlers properly implemented
- [ ] #7 Auto-save persists metadata correctly
- [ ] #8 TypeScript compiles without errors
- [ ] #9 No breaking changes to existing message rendering
<!-- AC:END -->
