---
id: TASK-126.06
title: 'Phase 4: Update AI service to use new response format'
status: To Do
assignee: []
created_date: '2026-02-23 08:37'
labels: []
dependencies: []
references:
  - app/lib/ai/owner/service.ts
  - app/lib/ai/shared/message-parsing.ts
  - app/types.ts
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update app/lib/ai/owner/service.ts to generate CLARIFICATION and CONFIRMATION markers instead of [SUGGESTIONS].

Changes needed:
1. Update buildOwnerPromptForStep() (lines 184-330) to include new format instructions:
   - \"If you need information from user, respond with: CLARIFICATION:type:label:options
   - Your friendly question here.\"
   - \"If ready to confirm data, respond with: CONFIRMATION:type
   - Here's what we collected...\"

2. Update AI response parsing (~lines 2300-2315) to:
   - Detect CLARIFICATION: markers and extract type, label, options
   - Detect CONFIRMATION: markers and extract type
   - Create appropriate message metadata based on markers
   - Store metadata in message object before returning to frontend

3. Types to support:
   - CLARIFICATION:radio:experience_level:Beginner,Competent crew,Coastal Skipper
   - CLARIFICATION:text:boat_name
   - CLARIFICATION:date:available_from
   - CLARIFICATION:multi:skills:Navigation,Safety,Meteorology
   - CONFIRMATION:profile-summary
   - CONFIRMATION:boat-summary
   - CONFIRMATION:skipper-profile
   - CONFIRMATION:crew-requirements

4. Remove old [SUGGESTIONS] format completely

5. Ensure backward compatibility with existing message flow
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AI prompts instruct model to use CLARIFICATION/CONFIRMATION format
- [ ] #2 Parser detects and extracts CLARIFICATION markers correctly
- [ ] #3 Parser detects and extracts CONFIRMATION markers correctly
- [ ] #4 Message metadata properly populated with response type
- [ ] #5 No [SUGGESTIONS] markers remain in prompts or parsing
- [ ] #6 Backward compatible with existing message types
- [ ] #7 TypeScript compiles without errors
- [ ] #8 AI responses properly formatted and parsed
<!-- AC:END -->
