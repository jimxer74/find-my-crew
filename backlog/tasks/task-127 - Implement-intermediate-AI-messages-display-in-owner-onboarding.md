---
id: TASK-127
title: Implement intermediate AI messages display in owner onboarding
status: In Progress
assignee: []
created_date: '2026-02-22 12:28'
updated_date: '2026-02-22 12:31'
labels:
  - ai-onboarding
  - feature
  - ux-improvement
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Display intermediate AI messages (with tool calls) to users during owner onboarding flow, not just the final response.

## Problem
Owner onboarding AI discards intermediate AI messages that contain tool calls and explanations. Only final message is shown to user and stored in history.

## Solution
Implement Solution 1 from doc-012: Return multiple messages in response via new `intermediateMessages` field.

## Implementation Details

### Decisions Made (from doc-012 answers):
- Show collapsible/toggle-able JSON tool calls (Option C)
- Mark intermediate with flag in metadata: `isIntermediate?: boolean`
- Display inline as they arrive (streaming-like visual)
- Save intermediate messages to `owner_sessions.conversation`
- Require client update (no backward compat needed)

### Work Breakdown:
1. **Phase 1**: Update type definitions in `app/lib/ai/owner/types.ts`
   - Add `intermediateMessages?: OwnerMessage[]` to OwnerChatResponse
   - Update OwnerMessage metadata type

2. **Phase 2**: Collect intermediate messages in `app/lib/ai/owner/service.ts`
   - Track intermediate messages during AI loop
   - Create message objects with metadata flags
   - Return intermediateMessages array

3. **Phase 3**: Update route to persist session properly
   - Ensure `owner_sessions.conversation` saves all messages (intermediate + final)
   - Verify archival saves complete history for GDPR

4. **Phase 4**: Client-side integration
   - Update chat component to handle intermediateMessages array
   - Display messages inline with collapsible JSON tool calls
   - Update conversation history storage to include all messages

## Files to Modify
- `app/lib/ai/owner/types.ts`
- `app/lib/ai/owner/service.ts` 
- `app/api/ai/owner/chat/route.ts` (verify session persistence)
- Client chat component (TBD - need to identify exact file)

## Related Documents
- doc-012: Complete analysis and solution plan

## Definition of Done
✅ Intermediate messages shown to user inline
✅ All messages stored in conversation history
✅ Tool calls shown with collapsible JSON
✅ Intermediate marked in metadata
✅ owner_sessions.conversation includes all messages
✅ Build passes, no TypeScript errors
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Progress

### ✅ COMPLETED: Phase 1 & 2 (Type Definitions + Service Tracking)

**Changes Made:**

1. **Phase 1: Updated `app/lib/ai/owner/types.ts`**
   - Added `isIntermediate?: boolean` flag to OwnerMessage.metadata
   - Added `intermediateMessages?: OwnerMessage[]` to OwnerChatResponse

2. **Phase 2: Updated `app/lib/ai/owner/service.ts`**
   - Added `intermediateMessages: OwnerMessage[]` tracking variable
   - Capture intermediate messages when tool calls are found (lines 2287-2302)
   - Store message content (without tool JSON), tool calls, and isIntermediate flag
   - Return intermediateMessages array in response
   - Added logging: '📬 Intermediate messages: N'

**Build Status**: ✅ PASSED - No errors

### Next Steps

3. **Phase 3**: Ensure session persistence saves all messages to owner_sessions.conversation
4. **Phase 4**: Client-side integration - display intermediate messages with collapsible tool calls
<!-- SECTION:PLAN:END -->
