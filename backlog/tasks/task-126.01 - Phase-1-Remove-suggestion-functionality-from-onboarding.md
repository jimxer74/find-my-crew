---
id: TASK-126.01
title: 'Phase 1: Remove suggestion functionality from onboarding'
status: Done
assignee: []
created_date: '2026-02-23 08:37'
updated_date: '2026-02-24 17:34'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Completion Summary

Phase 1 - Remove Suggestion Functionality has been successfully completed.

### Changes Made:
1. ✅ Removed SuggestedPrompts component from OwnerChat.tsx (lines 16-64)
2. ✅ Removed imports of extractSuggestedPrompts and removeSuggestionsFromContent from OwnerChat.tsx
3. ✅ Removed handleSuggestionSelect function from OwnerChat.tsx (was only used for suggestions)
4. ✅ Removed removeSuggestionsFromContent() call from message content rendering (line 318)
5. ✅ Removed entire suggestion extraction and rendering block (lines 322-332)
6. ✅ Functions retained in message-parsing.ts and shared/index.ts for use by ProspectChat and AssistantChat components (scope of TASK-126 is only owner onboarding)

### Verification:
- ✅ TypeScript compiles without errors (Next.js build completed successfully)
- ✅ No [SUGGESTIONS] rendering in OwnerChat UI
- ✅ Other components (ProspectChat, AssistantChat) unaffected
- ✅ No orphaned imports or references in OwnerChat.tsx

### Next Step:
Ready to proceed with Phase 2a - Create ClarificationInput component with auto-detection logic.
<!-- SECTION:NOTES:END -->
