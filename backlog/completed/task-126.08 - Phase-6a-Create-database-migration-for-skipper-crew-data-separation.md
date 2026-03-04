---
id: TASK-126.08
title: 'Phase 6a: Create database migration for skipper/crew data separation'
status: Done
assignee: []
created_date: '2026-02-23 08:37'
updated_date: '2026-02-24 17:33'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Completion Summary

Phase 6a - Create database migration for skipper/crew data separation has been successfully completed.

### Changes Made:

#### 1. Database Migration (migrations/045_separate_skipper_crew_data.sql)
✅ Created migration 045:
  - Added skipper_profile JSONB column with default {}
  - Added crew_requirements JSONB column with default {}
  - Added documentation comments for both columns
  - RLS policies automatically inherited from table level

✅ Schema design:
```sql
skipper_profile: {
  boatName, boatMakeModel, boatLength, boatType, boatCapacity,
  boatHomePort, boatCountryFlag, experienceLevel, certifications,
  availability, boatDetails
}

crew_requirements: {
  neededRoles, requiredExperience, requiredSkills,
  riskTolerance, preferredSchedule
}
```

#### 2. Schema Documentation Update (specs/tables.sql)
✅ Updated owner_sessions table definition:
  - Added skipper_profile column definition
  - Added crew_requirements column definition
  - Added column comments for clarity
  - Specs file now matches actual schema

#### 3. TypeScript Type Updates (app/lib/ai/owner/types.ts)
✅ Created new type interfaces:
  - SkipperProfile: Boat owner/skipper information
  - CrewRequirements: Crew member requirements

✅ Updated OwnerPreferences:
  - Added skipperProfile?: SkipperProfile
  - Added crewRequirements?: CrewRequirements
  - Maintained backward compatibility

✅ Updated OwnerSession:
  - Added skipperProfile?: SkipperProfile
  - Added crewRequirements?: CrewRequirements

### Verification:
- ✅ TypeScript compiles without errors
- ✅ Build successful with 82 pages generated
- ✅ No breaking changes to existing code
- ✅ GDPR deletion logic already handles new fields (part of owner_sessions)

### Migration Notes:
- New columns default to empty objects {}
- Existing data in gathered_preferences remains unchanged
- Gradual migration: new sessions will use separated structure
- Future: data can be backfilled from gathered_preferences if needed

### Next Steps:
Phase 6b - Update UI components for visual separation
<!-- SECTION:NOTES:END -->
