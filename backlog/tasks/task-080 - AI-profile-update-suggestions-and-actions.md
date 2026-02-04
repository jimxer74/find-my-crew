---
id: TASK-080
title: AI profile update suggestions and actions
status: To Do
assignee: []
created_date: '2026-02-04 07:52'
updated_date: '2026-02-04 08:01'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently the AI can suggest profile update and create an action to update the full profile. This approach does not work well and poses risks of losing important and relevant information in users profile. Instead the AI suggested profile update and profile update action needs to be further dividided into smaller scope suggestions and respective actions:

** AI should identify a specific field in profile that could be updated to increase chance of finding matching sailing trips --> all the content of the updates MUST BE asked and provided by the user, AI assistant MUST NOT assume any values or create content by itself without specific approval by user.

 (e.g. if AI identifies for example that sailing_preferences is not desriptive enough, AI assistant could suggest to update the sailing preferences and if user agrees, it needs to prompt the user to provide a description of to be updated sailing_preferences and iteratively suggest improvements on it if needed and finally user can either approve the update or cancel)
  
**For skills specifically, there needs to be a suggestion to update or add a single skill with the user provided description, e.g:
(if AI assistant identifies that user may have a missing skill for example night_sailing, AI coud suggest user to add night_sailing skill, if user agrees, AI asks clarifying questions to user to provide a description of the skill and can iteratively ask to improve it and then user can either approve the update or cancel.

**Each of the fields that are allowed to be updated by AI in profile should have it's own suggestion / action pair defined.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implementation Plan Created                                                                                                                                                                                                                                                   I've broken down the complex task-080 into 6 specific, actionable tasks:                                                                                                                                                                                                      1. Task #10: Create field-specific action types for profile updates                                                                      - Replace bulk update approach with individual field actions                                                                           - Create action types for each updatable field: full_name, user_description, certifications, phone, risk_level,                      sailing_preferences, skills                                                                                                            2. Task #11: Update AI tool definitions for field-specific suggestions                                                                   - Replace current bulk suggest_profile_update tool                                                                                     - Create field-specific suggestion tools
    - Enforce user-provided content requirements
  3. Task #12: Implement skills iterative refinement workflow
    - Specialized workflow for skills updates
    - Iterative refinement process with user feedback
    - Content creation strictly from user input
  4. Task #13: Update database schema for field-specific actions
    - Modify pending_actions table structure
    - Support individual field updates
    - Maintain backward compatibility
  5. Task #14: Update system prompts for field-specific approach
    - Modify AI guidelines in context.ts
    - Prevent AI from creating content
    - Enforce field-specific suggestions
  6. Task #15: Test and validate field-specific update system
    - Comprehensive testing of all new functionality
    - Validate user experience improvements
    - Ensure data integrity

  Current Status

  - Task #9 (creating the implementation plan) has been completed
  - All 6 implementation tasks are ready and pending approval

  The plan addresses all requirements from task-080:
  - ✅ Field-specific suggestions instead of bulk updates
  - ✅ AI never creates content, only suggests and refines
  - ✅ User provides all content for updates
  - ✅ Specialized workflow for skills with iterative refinement
  - ✅ Individual action types for each updatable field

  Ready for Approval

  The detailed implementation plan is now documented and ready for your approval. Once approved, I can proceed with implementing these
  tasks in the specified order to create the improved AI profile update system that addresses all the issues identified in task-080.

✻ Cogitated for 5m 44s

  7 tasks (1 done, 6 open) · ctrl+t to hide tasks
  □ Create field-specific action types for profile updates
  □ Update AI tool definitions for field-specific suggestions
  □ Implement skills iterative refinement workflow
  □ Update database schema for field-specific actions
  □ Update system prompts for field-specific approach
  □ Test and validate field-specific update system
  √ Create detailed implementation plan for AI profile update suggestions and actions
<!-- SECTION:PLAN:END -->
