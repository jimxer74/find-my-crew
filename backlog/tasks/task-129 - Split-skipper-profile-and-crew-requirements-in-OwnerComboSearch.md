---
id: TASK-129
title: Split skipper profile and crew requirements in OwnerComboSearch
status: Done
assignee: []
created_date: '2026-02-23 14:11'
updated_date: '2026-02-23 14:21'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the plan to split the combined skipperCrewProfiles textarea into separate skipperProfile and crewRequirements fields throughout the stack.

## Files to modify:
1. migrations/045_add_skipper_crew_profiles_to_owner_sessions.sql (NEW)
2. specs/tables.sql
3. app/components/ui/OwnerComboSearchBox.tsx
4. app/page.tsx
5. app/lib/ai/owner/types.ts
6. app/contexts/OwnerChatContext.tsx
7. app/api/owner/session/data/route.ts
8. app/lib/ai/owner/service.ts (minor updates for labeled sections)
9. app/api/ai/owner/trigger-profile-completion/route.ts (pass new fields)
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Complete

All 9 files updated to split `skipperCrewProfiles` into separate `skipperProfile` and `crewRequirements` fields.

### Changes Made

**DB Migration** (`migrations/045_add_skipper_crew_profiles_to_owner_sessions.sql`):
- Added `skipper_profile text` and `crew_requirements text` columns to `owner_sessions`

**Schema** (`specs/tables.sql`):
- Added both new columns to the `owner_sessions` table definition

**Interface** (`app/components/ui/OwnerComboSearchBox.tsx`):
- `OwnerComboSearchData`: replaced `skipperCrewProfiles` with separate `skipperProfile` and `crewRequirements` fields
- `ProfileTextDialog`: reusable dialog component replacing `SkipperCrewProfilesDialog`; added `SKIPPER_PROFILE_INSTRUCTIONS` and `CREW_REQUIREMENTS_INSTRUCTIONS` constants
- Desktop: 3 segments (Journey Details + About You (Skipper Profile) + Crew Requirements)
- Mobile: 3 pages (Journey Details → Skipper Profile → Crew Requirements)

**Page** (`app/page.tsx`):
- `handleOwnerComboSearch`: uses `skipperProfile` + `crewRequirements` URL params
- `handleOwnerPost`: legacy single-textarea now sends text as `skipperProfile`

**Types** (`app/lib/ai/owner/types.ts`):
- Added `skipperProfile?: string | null` and `crewRequirements?: string | null` to `OwnerSession`

**Context** (`app/contexts/OwnerChatContext.tsx`):
- State: added `skipperProfile` and `crewRequirements` fields
- Init: reads `skipperProfile` and `crewRequirements` URL params (no more `crewDemand`)
- Message building: labels with `[SKIPPER PROFILE]:` and `[CREW REQUIREMENTS]:` sections
- Stores raw values in state; hydrates from saved session; includes in auto-save

**Session API** (`app/api/owner/session/data/route.ts`):
- GET: returns `skipperProfile` and `crewRequirements` from DB
- POST: persists both columns on insert and update

**Build**: ✅ 82 pages compiled successfully
<!-- SECTION:FINAL_SUMMARY:END -->
