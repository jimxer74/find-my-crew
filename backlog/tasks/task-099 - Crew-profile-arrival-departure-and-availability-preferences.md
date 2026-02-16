---
id: TASK-099
title: Crew profile arrival & departure and availability preferences
status: To Do
assignee: []
created_date: '2026-02-13 14:09'
updated_date: '2026-02-16 08:16'
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

### Phase 1: Database & Types
1. Create migration `005_add_crew_location_availability_preferences.sql` adding to `profiles`:
   - `departure_location_name` (text), `departure_location_lat` (numeric), `departure_location_lng` (numeric), `departure_location_bbox` (geometry)
   - `arrival_location_name` (text), `arrival_location_lat` (numeric), `arrival_location_lng` (numeric), `arrival_location_bbox` (geometry)
   - `availability_start_date` (date), `availability_end_date` (date)
   - GIST indexes on bbox columns, composite index on dates
2. Update `/specs/tables.sql` with new columns
3. Add TypeScript types (`LocationPreference`, `CrewPreferences`) in `app/types/`
4. Update GDPR deletion logic to clear new fields

### Phase 2: UI Components
1. Create `LocationPreferenceInput.tsx` — reusable wrapper around existing `LocationAutocomplete`
2. Create `AvailabilityDateRangeInput.tsx` — date range selector using existing `DateRangePicker`

### Phase 3: Profile Edit (`/app/profile/page.tsx`)
1. Update `FormData` type with new location/availability fields
2. Add location & availability section to `SailingPreferencesSection`
3. Update `loadProfile()` to read new fields
4. Update `handleSubmit()` to save new fields
5. Update profile completion calculator

### Phase 4: Onboarding (`ProfileCreationWizard.tsx`)
1. Add location & availability preferences step (or expand existing step)
2. Show in review step with edit capability
3. Include in `handleSaveProfile()` submission

### Phase 5: Dashboard Filter Initialization
1. Create `useProfilePreferencesAsFilters()` hook
2. Update `/app/crew/dashboard/page.tsx` to call hook on mount
3. Logic: session storage filters > profile preferences > empty defaults

### Phase 6: /crew Listing Sort Enhancement
1. Add distance calculation utilities (haversine or PostGIS)
2. Update `CruisingRegionSection.tsx` sorting:
   - Score = (skillMatch × 0.5) + (departurProximity × 0.25) + (arrivalProximity × 0.25)
3. Best-matching legs appear first in carousel

### Phase 7: Testing & Refinement
- Test profile edit save/load round-trip
- Test onboarding with/without preferences
- Test dashboard filter pre-population
- Test /crew sorting with various preference combinations
- Verify GDPR deletion

## Key Architectural Decisions

**Location storage:** Individual columns + PostGIS bbox (not JSON) — enables spatial queries and indexing.

**Preference defaults:** All new fields nullable. Profiles work without preferences; they only enhance results when present.

**Session vs profile filters:** Session storage takes precedence. Profile preferences are only used as initial defaults when no session filters exist.

**Sorting algorithm:** Multi-factor weighted score combining skill match (50%), departure proximity (25%), and arrival proximity (25%). Weights can be tuned later.

## Reuse of Existing Components
- `LocationAutocomplete` — supports Mapbox locations + cruising regions
- `DateRangePicker` — date range selection
- `FilterContext` — already has location/date fields in its state
- `skillMatching.ts` — extend for location-based scoring

## Files to Modify
- `/specs/tables.sql` — schema update
- `/migrations/005_*.sql` — new migration
- `/app/profile/page.tsx` — add preference fields to profile edit
- `/app/components/profile/ProfileCreationWizard.tsx` — add onboarding step
- `/app/components/crew/CruisingRegionSection.tsx` — location-aware sorting
- `/app/crew/dashboard/page.tsx` — filter initialization from preferences
- `/app/contexts/FilterContext.tsx` — possible helper for preference loading
- GDPR deletion logic file — add new columns
<!-- SECTION:PLAN:END -->
