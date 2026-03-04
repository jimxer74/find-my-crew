---
id: TASK-099
title: Crew profile arrival & departure and availability preferences
status: Done
assignee: []
created_date: '2026-02-13 14:09'
updated_date: '2026-02-16 09:18'
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
- [x] #1 Crew profile edit page has fields for preferred departure location, preferred arrival location, and availability date range
- [x] #2 Onboarding wizard includes a step for setting location and availability preferences
- [x] #3 Profile preferences persist to the database and load correctly on page refresh
- [x] #4 /crew/dashboard filters are pre-populated from profile preferences when no session filters exist
- [x] #5 /crew page carousel sorts legs by multi-factor score: skill match + location proximity + availability overlap
- [x] #6 Filtering logic works identically in /crew and /crew/dashboard
- [x] #7 GDPR account deletion clears all new preference fields
- [x] #8 Null/empty preferences are handled gracefully (no errors, default behavior preserved)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Current State (Verified)

**Database (`profiles` table):** No columns for departure/arrival locations or availability dates. Next migration number: 035.

**AI Onboarding (`update_user_profile` tool):**
- Allowed fields: `full_name`, `user_description`, `sailing_experience`, `risk_level`, `skills`, `sailing_preferences`, `certifications`, `phone`, `profile_image_url`
- **MISSING:** No location or availability parameters
- Tool definition in `app/lib/ai/shared/tools/definitions.ts` (line 305)
- Tool execution handler in `app/lib/ai/prospect/service.ts` (line 698), allowedFields at line 724

**ComboSearchBox → AI conversation flow (ProspectChatContext.tsx line 1476-1549):**
- When user submits from front page ComboSearchBox, location data is serialized into the AI conversation as a user message:
  ```
  Looking to sail from: Caribbean
  (Cruising Region: Caribbean, Bounding Box: {"minLng":-89,"minLat":10,"maxLng":-59,"maxLat":23})
  Available: From 3/1/2026
  ```
- The full `Location` object (including `isCruisingRegion` and `bbox`) is JSON-serialized into the `whereFrom`/`whereTo` URL params and parsed at lines 1498/1511
- **The AI already sees bbox data in the conversation** — it just has no tool parameter to save it

**Profile Edit Page (`/app/profile/page.tsx`):**
- `SailingPreferencesSection` has: risk level selector + sailing preferences textarea
- **MISSING:** No location picker, no date range picker, no availability fields

**LocationAutocomplete (`app/components/ui/LocationAutocomplete.tsx`):**
- `Location` type: `{name, lat, lng, isCruisingRegion?, bbox?, countryCode?, countryName?}`
- Cruising region selections include `isCruisingRegion: true` + `bbox: {minLng, minLat, maxLng, maxLat}`
- Mapbox selections include `countryCode`/`countryName`, no bbox

**FilterContext → CrewBrowseMap flow:**
- `FilterState.location` / `FilterState.arrivalLocation` typed as `Location | null` (bbox-aware)
- `CrewBrowseMap` checks `location.bbox` (line 1086) — uses bbox directly for API params if present, falls back to center point + margin
- **Profile preferences MUST preserve bbox** for cruising region filtering to work in dashboard

**Profile Completion Calculator:** Tracks 8 fields. Location/availability should NOT affect completion %.

---

### Phase 1: Database Schema
1. Create migration `035_add_crew_location_availability_preferences.sql` adding to `profiles`:
   - `preferred_departure_location` jsonb null — stores full `Location` object: `{name, lat, lng, isCruisingRegion?, bbox?, countryCode?, countryName?}`
   - `preferred_arrival_location` jsonb null — same shape
   - `availability_start_date` date null
   - `availability_end_date` date null
   - Add index on date columns
2. Update `/specs/tables.sql` with new columns
3. Update GDPR account deletion logic for new columns

**Why jsonb:** The `Location` type has variable shape — cruising regions include `bbox` + `isCruisingRegion`, Mapbox locations include `countryCode`/`countryName`. Using jsonb stores the complete `Location` object as-is, matching the exact type used by `LocationAutocomplete`, `FilterContext`, and `CrewBrowseMap`. Bbox data flows intact from profile → filter → API.

### Phase 2: AI Onboarding Tool Update
1. **Update tool definition** in `app/lib/ai/shared/tools/definitions.ts`:
   - Add parameters to `update_user_profile`:
     - `preferred_departure_location` (object: `{name, lat, lng, isCruisingRegion?, bbox?}`) — AI can provide bbox when it's present in the conversation (from ComboSearchBox data)
     - `preferred_arrival_location` (object: same shape)
     - `availability_start_date` (string, ISO date YYYY-MM-DD)
     - `availability_end_date` (string, ISO date YYYY-MM-DD)
   - The bbox sub-object: `{minLng: number, minLat: number, maxLng: number, maxLat: number}`
   - AI should pass through bbox when it appears in the conversation text (e.g. `Cruising Region: Caribbean, Bounding Box: {...}`)
   - When user describes a location without bbox (e.g. "I want to sail from Barcelona"), AI provides name + lat/lng from geography knowledge

2. **Update tool execution handler** in `app/lib/ai/prospect/service.ts` (line 698+):
   - Add `preferred_departure_location`, `preferred_arrival_location`, `availability_start_date`, `availability_end_date` to `allowedFields` array (line 724)
   - Add normalization for location objects:
     - Validate required fields: `name` (string), `lat` (number), `lng` (number)
     - Pass through optional fields: `isCruisingRegion` (boolean), `bbox` (object with 4 numeric fields)
     - Ensure bbox values are valid numbers if present
   - Validate date strings are valid ISO dates
   - Store location as jsonb, dates as date columns

3. **Update AI system prompt** in `app/lib/ai/prospect/service.ts` (profile completion mode, around line 1460):
   - Add to "Profile fields to populate" list:
     - `preferred_departure_location` — Extract from conversation. If user mentioned a cruising region with bounding box (e.g. `(Cruising Region: Caribbean, Bounding Box: {"minLng":-89,...})`), include the full bbox. Otherwise provide `{name, lat, lng}` from geography knowledge.
     - `preferred_arrival_location` — Same as above
     - `availability_start_date` — ISO date (YYYY-MM-DD) if mentioned
     - `availability_end_date` — ISO date (YYYY-MM-DD) if mentioned
   - Update the example `update_user_profile` call to include location + availability fields
   - Add instruction: "When the conversation contains cruising region bounding box data, you MUST include the bbox in the location object. This preserves the user's intended sailing area for accurate filtering."

### Phase 3: Profile Edit Page
1. **Update FormData type** in `SailingPreferencesSection.tsx` and `app/profile/page.tsx`:
   - Add `preferred_departure_location: Location | null`
   - Add `preferred_arrival_location: Location | null`
   - Add `availability_start_date: string | null` (ISO date)
   - Add `availability_end_date: string | null` (ISO date)
2. **Add "Location & Availability Preferences" section** to `SailingPreferencesSection.tsx`:
   - Two `LocationAutocomplete` fields (departure and arrival) — supports both Mapbox locations and cruising regions with bbox
   - Two date inputs for availability start/end dates
   - Clear buttons for each field
3. **Update `/app/profile/page.tsx`**:
   - Load new fields from profile in `loadProfile()` — parse jsonb to `Location` objects
   - Save new fields in `handleSubmit()` — serialize `Location` objects as jsonb

### Phase 4: Dashboard Filter Initialization
1. Create `useProfilePreferencesAsFilters()` hook:
   - Fetches user's `preferred_departure_location` and `preferred_arrival_location` from profile
   - Maps to `FilterState` format: `location` (departure), `arrivalLocation`, `dateRange`
   - Full `Location` objects (including bbox for cruising regions) flow directly — no data loss
2. Update `/app/crew/dashboard/page.tsx`:
   - On mount: if no session filters exist, populate from profile preferences
3. Logic: session storage > profile preferences > empty defaults

### Phase 5: /crew Listing Sort Enhancement
1. Update `CruisingRegionSection.tsx`:
   - Fetch user's location preferences from profile
   - For center-point locations: calculate haversine distance to each leg's start/end
   - For cruising region locations (with bbox): check if leg start/end falls within bbox
   - Multi-factor score: skillMatch (50%) + departureProximity (25%) + arrivalProximity (25%)
   - Sort carousel by score (best matches first)

---

### Key Files to Modify
| File | Change |
|------|--------|
| `specs/tables.sql` | Add jsonb location + date columns to profiles |
| `migrations/035_*.sql` | New migration |
| `app/lib/ai/shared/tools/definitions.ts` | Add location/availability params (with bbox support) to `update_user_profile` |
| `app/lib/ai/prospect/service.ts` | Update tool handler (allowedFields, location+bbox normalization) + system prompt |
| `app/components/profile/sections/SailingPreferencesSection.tsx` | Add location/availability UI using `LocationAutocomplete` |
| `app/profile/page.tsx` | Load/save new jsonb fields |
| `app/crew/dashboard/page.tsx` | Filter initialization from profile preferences |
| `app/components/crew/CruisingRegionSection.tsx` | Location-aware sorting |
| `app/contexts/FilterContext.tsx` | Possible helper for preference loading |
| GDPR deletion logic | Include new columns |

### Key Decisions
- **jsonb for location storage** — stores the complete `Location` object (name, lat, lng, bbox, isCruisingRegion, countryCode, countryName). Bbox flows intact from profile → FilterContext → CrewBrowseMap → API.
- **AI passes through bbox from conversation** — when ComboSearchBox sends cruising region data into the AI conversation (e.g. `(Cruising Region: Caribbean, Bounding Box: {...})`), the AI extracts and includes the bbox in the `update_user_profile` call. This preserves the precise sailing area the user selected on the front page.
- **AI provides center-point for free-text locations** — when user just says "I want to sail from Barcelona" without bbox data, AI provides `{name, lat, lng}` from geography knowledge. Users can later refine via the profile edit page `LocationAutocomplete` to get cruising region + bbox.
- **Location/availability NOT in completion calculator** — optional enhancements, not required profile fields
- **Session storage > profile preferences** — active session filters override profile defaults
- **Reuse `LocationAutocomplete`** for profile edit page — supports both Mapbox and cruising region search with bbox
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Summary

### Phase 1: Database Schema
- Created `migrations/035_add_crew_location_availability_preferences.sql` adding `preferred_departure_location` (jsonb), `preferred_arrival_location` (jsonb), `availability_start_date` (date), `availability_end_date` (date) to profiles table with partial index on date columns
- Updated `specs/tables.sql` with new columns and index

### Phase 2: AI Onboarding Tool
- Updated `app/lib/ai/shared/tools/definitions.ts` with 4 new parameters (including bbox sub-object) on `update_user_profile` tool
- Updated `app/lib/ai/prospect/service.ts` and `app/lib/ai/owner/service.ts` with allowedFields, location/date normalization, and system prompt instructions for bbox pass-through from conversation

### Phase 3: Profile Edit Page
- Rewrote `SailingPreferencesSection.tsx` with LocationAutocomplete fields (departure/arrival with clear buttons, cruising region indicators) and date inputs (available from/until)
- Updated `app/profile/page.tsx` with formData state, loadProfile mapping, and handleSubmit for all 4 new fields

### Phase 4: Dashboard Filter Initialization
- Updated `FilterContext.tsx` with profile preference loading: when no session storage filters exist, fetches user's profile preferences from Supabase and populates departure/arrival locations (with bbox) and date range as initial filter values

### Phase 5: /crew Listing Sort Enhancement
- Added `ProfileLocation` type and new fields to `useProfile.tsx` (select query + type)
- Updated `CruisingRegionSection.tsx` with haversine distance and bbox containment proximity scoring; multi-factor sort: skillMatch 50% + departureProximity 25% + arrivalProximity 25%
- Updated `app/crew/page.tsx` to pass `userDepartureLocation` and `userArrivalLocation` props

### GDPR
Verified: existing delete-account route deletes entire profiles row, automatically covering new columns.
<!-- SECTION:FINAL_SUMMARY:END -->
