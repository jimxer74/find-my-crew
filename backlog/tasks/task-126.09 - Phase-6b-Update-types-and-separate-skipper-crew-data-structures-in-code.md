---
id: TASK-126.09
title: 'Phase 6b: Update types and separate skipper/crew data structures in code'
status: To Do
assignee: []
created_date: '2026-02-23 08:38'
labels: []
dependencies: []
references:
  - app/types.ts
  - app/contexts/OwnerChatContext.tsx
  - app/lib/ai/owner/service.ts
  - app/lib/profileUtils.ts
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update app/lib/ types and code to separate skipper profile and crew requirements data.

Changes needed:
1. Update app/types.ts to extend OwnerPreferences with separate structures:
   ```
   skipper_profile: {
     boat_name?: string
     boat_make_model?: string
     boat_length?: number
     experience_level?: number
     certifications?: string[]
     availability?: Record<string, any>
   }
   crew_requirements: {
     needed_roles?: string[]
     required_experience?: number
     required_skills?: string[]
     risk_tolerance?: string[]
     preferred_schedule?: Record<string, any>
   }
   ```

2. Update OwnerChatContext.tsx to use separated structures:
   - Initialize with separate skipper_profile and crew_requirements
   - Update state setters to maintain separation
   - No cross-mixing of data

3. Update service.ts to read/write to correct structure based on context:
   - When discussing boat/skipper: only reference skipper_profile
   - When discussing crew needs: only reference crew_requirements
   - Pass only relevant structure to AI in prompts

4. Update ConfirmationDisplay to show skipper and crew in separate visual sections
   - dataType 'skipper-profile' shows only skipper data
   - dataType 'crew-requirements' shows only crew data
   - dataType 'profile-summary' shows both in separate sections

5. Update GDPR deletion logic to handle both structures

TypeScript properly typed, no mixing of data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OwnerPreferences extended with skipper_profile and crew_requirements
- [ ] #2 Context initialized with separated data structures
- [ ] #3 Service reads only relevant structure for each step
- [ ] #4 ConfirmationDisplay shows skipper and crew separately
- [ ] #5 No cross-mixing of data in state or API calls
- [ ] #6 GDPR deletion logic updated for both structures
- [ ] #7 TypeScript compiles without errors
- [ ] #8 All types properly documented
<!-- AC:END -->
