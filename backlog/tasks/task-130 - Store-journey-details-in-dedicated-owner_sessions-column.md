---
id: TASK-130
title: Store journey details in dedicated owner_sessions column
status: Done
assignee: []
created_date: '2026-02-23 14:33'
updated_date: '2026-02-23 14:37'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a `journey_details` text column to `owner_sessions` to persist the parsed journey text (locations, dates, waypoints) from the front page ComboSearchBox, and label it as `[JOURNEY DETAILS]:` in the AI message — mirroring the skipper_profile/crew_requirements pattern so the AI has clearly-labelled, reliably-available context throughout the session.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Complete

Added `journey_details` text column to `owner_sessions`, persisted through the full stack, and improved AI prompt labelling.

### Files Changed

**`migrations/046_add_journey_details_to_owner_sessions.sql`** (NEW)
- `alter table owner_sessions add column if not exists journey_details text`

**`specs/tables.sql`** — added column to table definition

**`app/lib/ai/owner/types.ts`** — added `journeyDetails?: string | null` to `OwnerSession`

**`app/contexts/OwnerChatContext.tsx`**
- `OwnerChatState` gains `journeyDetails: string | null`
- URL-param processing: stores parsed journey text into state (`storedJourneyDetails`)
- First message now includes `[JOURNEY DETAILS]:\n...` section alongside `[SKIPPER PROFILE]` and `[CREW REQUIREMENTS]`
- Always updates all three fields in one `setState` call (no conditional guard)
- Hydrates from saved session on restore; included in auto-save dependency array

**`app/api/owner/session/data/route.ts`**
- GET: returns `journeyDetails` from `session.journey_details`
- POST upsertData: includes `journey_details`
- Both UPDATE paths include `journey_details`

**`app/lib/ai/owner/service.ts`**
- `create_profile` step: added "LABELLED SECTIONS" block explaining all three labels, restricting profile extraction to `[SKIPPER PROFILE]` only
- `post_journey` step: references `[JOURNEY DETAILS]` as PRIMARY source for coordinates/dates, replaces generic "scan conversation history" wording

**Build**: ✅ 82 pages compiled successfully
<!-- SECTION:FINAL_SUMMARY:END -->
