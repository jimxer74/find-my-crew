---
id: TASK-126.08
title: 'Phase 6a: Create database migration for skipper/crew data separation'
status: To Do
assignee: []
created_date: '2026-02-23 08:37'
labels: []
dependencies: []
references:
  - migrations/
  - specs/tables.sql
parent_task_id: TASK-126
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create database migration to separate skipper profile and crew requirements data structures.

Following project guidelines in CLAUDE.md:
1. Create migration file in /migrations/ with next sequential number (e.g., 005_separate_skipper_crew_data.sql)
2. Update /specs/tables.sql to reflect new schema

Migration should:
- Add new columns to owner_sessions table OR create new related structure to separate:
  - skipper_profile (boat name, model, length, experience, certifications, availability)
  - crew_requirements (needed roles, experience, skills, risk tolerance, schedule)
- Preserve existing conversation data in conversation column
- Be backward compatible (no data loss)
- Can be run in development and production safely

New structure in owner_sessions should allow clear separation:
- skipper_profile: JSON or separate columns
- crew_requirements: JSON or separate columns
- conversation: stays as is (array of messages)

Update /specs/tables.sql to document:
- New columns/fields
- Data types
- Relationships
- Constraints
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Migration file created with sequential number
- [ ] #2 /specs/tables.sql updated with new schema
- [ ] #3 Migration is backward compatible (no data loss)
- [ ] #4 New columns allow clear separation of skipper and crew data
- [ ] #5 Migration can be safely run
- [ ] #6 Schema properly documented in specs
- [ ] #7 No breaking changes to existing queries
<!-- AC:END -->
