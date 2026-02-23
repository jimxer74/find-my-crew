---
id: TASK-126.10
title: 'Phase 6c: Update UI components for skipper/crew separation'
status: To Do
assignee: []
created_date: '2026-02-23 08:38'
labels: []
dependencies: []
references:
  - app/components/owner/
  - app/pages/owner/
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update ComboSearch and mobile wizard to visually separate skipper profile and crew requirements.

Changes needed:
1. **Front Page ComboSearch Box** (app/components/owner/ComboSearch.tsx or similar):
   - Split into two distinct visual sections:
     - Section 1: \"Skipper Profile\" with boat name, model, length input fields
     - Section 2: \"Crew Requirements\" with needed roles, skills input fields
   - Clear visual separation (divider, different colors, clear headers)
   - Each section has own labels and context

2. **Mobile Wizard** (if exists):
   - Create separate pages/steps:
     - Page N: \"Your Skipper Profile\" - boat details, skipper experience, availability
     - Page N+1: \"Crew Requirements\" - skills needed, experience levels, risk tolerance
   - Each page has distinct layout and labels
   - Sequential flow between pages
   - Visual indicators showing which page user is on

3. Both should:
   - Only send data to relevant context structure (skipper vs crew)
   - Display clear labels indicating what data is being collected
   - Be visually distinct and easy to understand
   - Maintain existing validation

This separates data collection at the UI level, preventing confusion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ComboSearch box visually separates skipper and crew sections
- [ ] #2 Skipper section collects boat/skipper data only
- [ ] #3 Crew section collects crew requirement data only
- [ ] #4 Mobile wizard has separate pages for skipper and crew
- [ ] #5 Each page/section clearly labeled
- [ ] #6 Data flows to correct context structure
- [ ] #7 Visual separation is clear and intuitive
- [ ] #8 No mixing of data between sections
<!-- AC:END -->
