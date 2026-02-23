---
id: TASK-126.01
title: 'Phase 1: Remove suggestion functionality from onboarding'
status: To Do
assignee: []
created_date: '2026-02-23 08:37'
labels: []
dependencies: []
references:
  - app/components/owner/OwnerChat.tsx
  - app/lib/ai/shared/message-parsing.ts
  - app/lib/ai/owner/service.ts
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove all suggestion-related UI and utilities:
- Delete SuggestedPrompts component and its usage in OwnerChat.tsx
- Remove extractSuggestedPrompts() and removeSuggestionsFromContent() from message-parsing.ts
- Remove [SUGGESTIONS]...[/SUGGESTIONS] format from AI prompts in service.ts
- Verify no other files import removed functions
- Update buildOwnerPromptForStep() to stop generating suggestion markers

This phase must be completed first as it clears the foundation for the new approach.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No SuggestedPrompts component or related imports exist
- [ ] #2 extractSuggestedPrompts() completely removed from codebase
- [ ] #3 removeSuggestionsFromContent() completely removed from codebase
- [ ] #4 No [SUGGESTIONS] markers in AI prompts
- [ ] #5 Grep confirms no remaining references to removed functions
- [ ] #6 TypeScript compiles without errors
- [ ] #7 Onboarding UI renders without suggestion boxes
<!-- AC:END -->
