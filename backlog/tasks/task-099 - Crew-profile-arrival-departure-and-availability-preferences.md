---
id: TASK-099
title: Crew profile arrival & departure and availability preferences
status: To Do
assignee: []
created_date: '2026-02-13 14:09'
updated_date: '2026-02-16 08:25'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User can provide and save predefined preferences for departure and arrival locations, and availability in profile edit, and in onboarding flow. This information can be used later in providing crew matches to skippers.

** Considerations:
- in /crew/dashboard set the the Search filters as default from the profile including all the filters e.g availability, locations, risk level, experience leve. 
- in /crew display the list based on the user defined preference in profile, take into consideration all the profile settings and display the locations that user as preferred in profile.

results filtering should work logically the same in /crew and /crew/dashboard. in /crew view show the best matching results first in the carousel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Crew profile edit page has fields for preferred departure location, preferred arrival location, and availability date range
- [ ] #2 Onboarding wizard includes a step for setting location and availability preferences
- [ ] #3 Profile preferences persist to the database and load correctly on page refresh
- [ ] #4 /crew/dashboard filters are pre-populated from profile preferences when no session filters exist
- [ ] #5 /crew page carousel sorts legs by multi-factor score: skill match + location proximity + availability overlap
- [ ] #6 Filtering logic works identically in /crew and /crew/dashboard
- [ ] #7 GDPR account deletion clears all new preference fields
- [ ] #8 Null/empty preferences are handled gracefully (no errors, default behavior preserved)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Current State (Verified)

**Database (`profiles` table):** No columns for departure/arrival locations or availability dates. Next migration number: 035.

**AI Onboarding (`update_user_profile` tool):**
- Allowed fields: `full_name`, `user_description`, `sailing_experience`, `risk_level`, `skills`, `sailing_preferences`, `certifications`, `phone`, `profile_image_url`
- **MISSING:** No location or availability parameters — the AI cannot save these during onboarding
- Field alias mapping exists (e.g., `comfort_zones` → `risk_level`) but nothing for locations
- Tool definition in `app/lib/ai/shared/tools/definitions.ts` (line 305)
- Tool execution handler in `app/lib/ai/prospect/service.ts` (line 698)

**Profile Edit Page (`/app/profile/page.tsx`):**
- SailingPreferencesSection has: risk level selector + sailing preferences textarea
- **MISSING:** No location picker, no date range picker, no availability fields
- FormData type does not include location/availability fields

**Profile Completion Calculator (`app/lib/profile/completionCalculator.ts`):**
- Tracks 8 fields: username, full_name, phone, sailing_experience, risk_level, skills, sailing_preferences, roles
- Mirrored by a DB trigger (`migrations/002_fix_profile_completion_trigger.sql`)
- Decision: Location/availability should NOT affect completion percentage (they're optional enhancements)

---

### Phase 1: Database Schema
1. Create migration `035_add_crew_location_availability_preferences.sql`:
   - Add to `profiles` table:
     - `preferred_departure_location_name` text null
     - `preferred_departure_location_lat` numeric null
     - `preferred_departure_location_lng` numeric null
     - `preferred_arrival_location_name` text null
     - `preferred_arrival_location_lat` numeric null
     - `preferred_arrival_location_lng` numeric null
     - `availability_start_date` date null
     - `availability_end_date` date null
   - Add indexes on date columns
2. Update `/specs/tables.sql` with new columns
3. Update GDPR account deletion logic for new columns

### Phase 2: AI Onboarding Tool Update
1. **Update tool definition** in `app/lib/ai/shared/tools/definitions.ts`:
   - Add parameters to `update_user_profile`:
     - `preferred_departure_location` (object: `{name, lat, lng}`)
     - `preferred_arrival_location` (object: `{name, lat, lng}`)
     - `availability_start_date` (string, ISO date)
     - `availability_end_date` (string, ISO date)
2. **Update tool execution handler** in `app/lib/ai/prospect/service.ts` (line 698+):
   - Add new fields to `allowedFields` array (line 724)
   - Add normalization logic for location objects → individual DB columns
   - Add normalization for date strings
3. **Update AI system prompt** in `app/lib/ai/prospect/service.ts`:
   - Include location and availability in profile completion instructions
   - Tell AI to ask about preferred sailing locations and availability dates
   - Update the example `update_user_profile` call to include new fields
4. **Also update owner service** (`app/lib/ai/owner/service.ts` line 615) if owners can also have these fields

### Phase 3: Profile Edit Page
1. **Update FormData type** in `SailingPreferencesSection.tsx`:
   - Add location and availability fields
2. **Add new section** to `SailingPreferencesSection.tsx`:
   - "Preferred Locations" subsection with:
     - Departure location using `LocationAutocomplete` component
     - Arrival location using `LocationAutocomplete` component
   - "Availability" subsection with:
     - Start date picker
     - End date picker
3. **Update `/app/profile/page.tsx`**:
   - Add new fields to FormData state
   - Load new fields in `loadProfile()`
   - Save new fields in `handleSubmit()`

### Phase 4: Dashboard Filter Initialization
1. Create `useProfilePreferencesAsFilters()` hook:
   - Fetches user profile preferences
   - Returns FilterContext-compatible initial state
2. Update `/app/crew/dashboard/page.tsx`:
   - On mount: if no session filters exist, populate from profile preferences
3. Logic: session storage > profile preferences > empty defaults

### Phase 5: /crew Listing Sort Enhancement
1. Update `CruisingRegionSection.tsx`:
   - Fetch user's location preferences
   - Calculate distance from preferred departure/arrival to each leg
   - Multi-factor score: skillMatch (50%) + departureProximity (25%) + arrivalProximity (25%)
   - Sort carousel by score (best matches first)

---

### Key Files to Modify
| File | Change |
|------|--------|
| `specs/tables.sql` | Add location/availability columns to profiles |
| `migrations/035_*.sql` | New migration |
| `app/lib/ai/shared/tools/definitions.ts` | Add params to `update_user_profile` tool |
| `app/lib/ai/prospect/service.ts` | Update tool handler + system prompt |
| `app/components/profile/sections/SailingPreferencesSection.tsx` | Add location/availability UI |
| `app/profile/page.tsx` | Load/save new fields |
| `app/crew/dashboard/page.tsx` | Filter initialization from preferences |
| `app/components/crew/CruisingRegionSection.tsx` | Location-aware sorting |
| `app/contexts/FilterContext.tsx` | Possible helper for preference loading |
| GDPR deletion logic | Include new columns |

### Key Decisions
- **No bbox for profile locations** — bbox is for search filtering; profile just needs name + lat/lng for distance calculations
- **Location/availability NOT in completion calculator** — they're optional enhancements, not required profile fields
- **AI extracts locations naturally** — during onboarding conversation, AI asks "where would you like to sail from?" and passes structured data to `update_user_profile`
- **Session storage > profile preferences** — active session filters override profile defaults
- **Reuse `LocationAutocomplete`** for profile edit page location pickers
<!-- SECTION:PLAN:END -->
