---
id: TASK-126.11
title: 'Phase 7: End-to-end testing and validation'
status: To Do
assignee: []
created_date: '2026-02-23 08:38'
labels: []
dependencies: []
references:
  - app/components/owner/OwnerChat.tsx
  - app/components/Header.tsx
  - All new components
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Comprehensive testing of the refactored onboarding flow.

Test scenarios:
1. **No suggestions** - Start onboarding → verify no suggested prompts appear anywhere
2. **Clarification inputs** - Verify auto-detection works:
   - Radio buttons for multiple-choice questions
   - Text input for open-ended questions
   - Date picker for date questions
   - Multi-select for multi-item questions
3. **Question flow** - Answer clarification → AI processes → next question appears
4. **Data confirmation** - After gathering data → confirmation display shows collected data
5. **Refinement loop** - Click Edit → feedback input → type feedback → submit → AI updates → confirmation displays again → can iterate
6. **Auth flow** - Complete profile gathering → auth nudge appears → sign in → continues
7. **Exit button** - After authentication:
   - Exit button appears in header
   - Click exit → confirmation dialog \"Are you sure?\"
   - Click Continue → dialog closes, stays in assistant
   - Click Exit → session closes, navigates to /owner/profile
8. **Intermediate messages** - Verify blue AI reasoning boxes still display with tool calls
9. **Pending actions** - Verify yellow pending action boxes still work
10. **Session cleanup** - After completion → session archived, marked complete
11. **Skipper/crew separation** - Data visually separated in UI and backend structure

No console errors or warnings during any flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No suggested prompts appear in flow
- [ ] #2 Clarification inputs auto-detect correctly
- [ ] #3 AI responses processed through clarifications
- [ ] #4 Confirmation display shows data correctly
- [ ] #5 Edit feedback loop works (iterate 2+ times)
- [ ] #6 Auth sign-in triggers and continues
- [ ] #7 Exit button shows when authenticated
- [ ] #8 Exit confirmation dialog works as expected
- [ ] #9 Navigation to /owner/profile on exit works
- [ ] #10 Intermediate messages display correctly
- [ ] #11 Pending action boxes work
- [ ] #12 Session properly cleaned up
- [ ] #13 Skipper/crew data separated in UI and code
- [ ] #14 No console errors or warnings
- [ ] #15 Build passes, no TypeScript errors
<!-- AC:END -->
