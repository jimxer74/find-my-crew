---
id: TASK-099
title: Crew profile arrival & departure and availability preferences
status: To Do
assignee: []
created_date: '2026-02-13 14:09'
updated_date: '2026-02-16 08:52'
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
- Tool definition in `app/lib/ai/shared/tools/definitions.ts` (line 305)
- Tool execution handler in `app/lib/ai/prospect/service.ts` (line 698), allowedFields at line 724

**Profile Edit Page (`/app/profile/page.tsx`):**
- `SailingPreferencesSection` has: risk level selector + sailing preferences textarea
- **MISSING:** No location picker, no date range picker, no availability fields

**ComboSearchBox (`app/components/ui/ComboSearchBox.tsx`):**
- Front page search already captures `whereFrom` / `whereTo` as `Location` objects
- `Location` type (from `LocationAutocomplete.tsx`) includes: `name`, `lat`, `lng`, `isCruisingRegion?`, `bbox?`, `countryCode?`, `countryName?`
- When user selects a cruising region (e.g. "Western Mediterranean"), `LocationAutocomplete` returns a `Location` with `isCruisingRegion: true` and a `bbox` object `{minLng, minLat, maxLng, maxLat}`
- When user selects a Mapbox city/region, it returns `isCruisingRegion: false` with no bbox

**FilterContext (`app/contexts/FilterContext.tsx`):**
- `FilterState.location` and `FilterState.arrivalLocation` are typed as `Location | null` — already supports bbox
- Loaded from / saved to sessionStorage

**CrewBrowseMap (`app/components/crew/CrewBrowseMap.tsx`):**
- When filtering by location, checks `location.bbox` — if present, uses bbox directly for API params (`departure_min_lng`, etc.)
- If no bbox, falls back to center point + calculated margin
- **This means profile preferences MUST preserve bbox** so that cruising region preferences flow correctly into dashboard filters

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

**Why jsonb instead of individual columns:** The `Location` type has variable shape — cruising regions include `bbox` + `isCruisingRegion`, Mapbox locations include `countryCode`/`countryName`. Using jsonb stores the complete `Location` object as-is, matching the exact type used by `LocationAutocomplete`, `FilterContext`, and `CrewBrowseMap`. This avoids needing to decompose/recompose the object at every boundary and ensures bbox data flows intact from profile → filter → API.

### Phase 2: AI Onboarding Tool Update
1. **Update tool definition** in `app/lib/ai/shared/tools/definitions.ts`:
   - Add parameters to `update_user_profile`:
     - `preferred_departure_location` (object: `{name, lat, lng}`) — AI provides name + coordinates from geography knowledge
     - `preferred_arrival_location` (object: `{name, lat, lng}`)
     - `availability_start_date` (string, ISO date YYYY-MM-DD)
     - `availability_end_date` (string, ISO date YYYY-MM-DD)
   - Note: AI won't produce bbox/isCruisingRegion — those come only from `LocationAutocomplete`. The AI provides center-point locations only, which is fine for distance-based matching.
2. **Update tool execution handler** in `app/lib/ai/prospect/service.ts` (line 698+):
   - Add new fields to `allowedFields` array (line 724)
   - Add normalization: wrap AI-provided location `{name, lat, lng}` into full `Location` shape (no bbox, `isCruisingRegion: false`)
   - Validate date strings are valid ISO dates
   - Store as jsonb in the profile
3. **Update AI system prompt** in `app/lib/ai/prospect/service.ts`:
   - Tell AI to ask about preferred departure/arrival locations and availability dates during profile gathering
   - Update the example `update_user_profile` call to include new fields
   - Instruct AI to provide lat/lng from geography knowledge (same pattern as `search_legs_by_location`)

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
   - Since profile stores full `Location` objects (including bbox for cruising regions), no data loss when populating filters
2. Update `/app/crew/dashboard/page.tsx`:
   - On mount: if no session filters exist, populate from profile preferences
3. Logic: session storage > profile preferences > empty defaults

### Phase 5: /crew Listing Sort Enhancement
1. Update `CruisingRegionSection.tsx`:
   - Fetch user's location preferences from profile
   - Calculate distance from preferred departure/arrival to each leg's start/end points
   - Multi-factor score: skillMatch (50%) + departureProximity (25%) + arrivalProximity (25%)
   - Sort carousel by score (best matches first)
2. For cruising region preferences (with bbox), check if leg start/end point falls within the bbox

---

### Key Files to Modify
| File | Change |
|------|--------|
| `specs/tables.sql` | Add jsonb location + date columns to profiles |
| `migrations/035_*.sql` | New migration |
| `app/lib/ai/shared/tools/definitions.ts` | Add location/availability params to `update_user_profile` |
| `app/lib/ai/prospect/service.ts` | Update tool handler (allowedFields, normalization) + system prompt |
| `app/components/profile/sections/SailingPreferencesSection.tsx` | Add location/availability UI using `LocationAutocomplete` |
| `app/profile/page.tsx` | Load/save new jsonb fields |
| `app/crew/dashboard/page.tsx` | Filter initialization from profile preferences |
| `app/components/crew/CruisingRegionSection.tsx` | Location-aware sorting |
| `app/contexts/FilterContext.tsx` | Possible helper for preference loading |
| GDPR deletion logic | Include new columns |

### Key Decisions
- **jsonb for location storage** — stores the complete `Location` object (name, lat, lng, bbox, isCruisingRegion, countryCode, countryName) matching the exact type used throughout the frontend. Cruising region bbox data flows intact from profile → FilterContext → CrewBrowseMap → API.
- **AI provides center-point only** — during onboarding, the AI gives `{name, lat, lng}` from geography knowledge. Only `LocationAutocomplete` (profile edit page) can produce cruising region selections with bbox. This is acceptable because AI-provided locations are approximate anyway.
- **Location/availability NOT in completion calculator** — optional enhancements, not required profile fields
- **Session storage > profile preferences** — active session filters override profile defaults
- **Reuse `LocationAutocomplete`** for profile edit page — supports both Mapbox and cruising region search with bbox
<!-- SECTION:PLAN:END -->
