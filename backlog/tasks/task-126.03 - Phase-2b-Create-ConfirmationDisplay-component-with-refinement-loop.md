---
id: TASK-126.03
title: 'Phase 2b: Create ConfirmationDisplay component with refinement loop'
status: To Do
assignee: []
created_date: '2026-02-23 08:37'
labels: []
dependencies: []
references:
  - app/components/owner/OwnerChat.tsx
  - app/types.ts
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create ConfirmationDisplay.tsx component that shows collected data with confirm/edit workflow.

Props: { dataType: string; data: Record<string, any>; onConfirm: () => void; onCancel: () => void; onEdit: (feedback: string) => void; disabled: boolean }

Supported data types:
- profile-summary: Display user profile data
- boat-summary: Display boat details
- journey-summary: Display journey data
- skipper-profile: Display skipper profile
- crew-requirements: Display crew requirements

Component behavior:
1. Display collected data in readable format
2. Show [Confirm] button (primary) to save data
3. Show [Edit] button (secondary) to provide refinement feedback
4. When Edit clicked, show text input: \"What would you like to change?\"
5. User types feedback → calls onEdit() → AI processes → new data returned
6. Display updated data again → user can Confirm or Edit again (loop)

Styling:
- Clean card layout with clear data sections
- Different styling for each data type
- Button states (enabled/disabled/loading)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Component renders data in readable format based on dataType
- [ ] #2 Confirm button saves data via onConfirm()
- [ ] #3 Edit button shows feedback text input
- [ ] #4 Feedback text input calls onEdit() with user text
- [ ] #5 Component handles iterative refinement (edit → new data → edit again)
- [ ] #6 Disabled state prevents all interactions
- [ ] #7 Data sections clearly separated by type
- [ ] #8 TypeScript properly typed for all data structures
<!-- AC:END -->
