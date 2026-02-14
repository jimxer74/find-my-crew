---
id: TASK-099
title: Crew profile arrival / departure prefenrences
status: To Do
assignee: []
created_date: '2026-02-13 14:09'
updated_date: '2026-02-13 14:17'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User can provide and save predefined preferences for departure and arrival locations, in profile edit, and in onboarding flow.

Considerations / questions:
- User can provide locations in various accuracy levels: e.g. exact location, city, cruising area like 'Caribbean" or very vague large area like 'Australia to New zealand' or 'Trans-atlantic from East to West' --> How handle the different levels or just plain text in profile

- how to utilize the location preferences in crew ui and searches and diffrentiate the in session filters from more static profile level location preferences?
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

### Overview
Add arrival/departure location preferences to crew profiles that can be saved and reused across sessions. These preferences will be separate from session-based filters and can be used to pre-populate search filters and provide context to AI matching.

### Database Schema Changes

#### 1. Add columns to `profiles` table
- `departure_preferences` (JSONB, nullable): Store departure location preferences
  - Structure: `{ locations: string[], description: string | null, bbox: { minLng, minLat, maxLng, maxLat } | null }`
  - Allows multiple preferred departure locations
  - Description field for vague areas like "Trans-atlantic from East to West"
  - Optional bounding box for geospatial queries
- `arrival_preferences` (JSONB, nullable): Store arrival location preferences
  - Same structure as departure_preferences

**Migration file**: `migrations/034_add_location_preferences_to_profiles.sql`

**Update**: `specs/tables.sql` to reflect new columns

### UI Components

#### 2. Profile Edit Page (`app/profile/page.tsx`)
- Add new section: "Location Preferences" (similar to existing sections like "Sailing Preferences")
- Two subsections:
  - **Departure Preferences**
    - Multi-select location input (reuse `LocationSearch` component from `FiltersDialog.tsx`)
    - Text area for vague/descriptive preferences (e.g., "Trans-atlantic routes")
    - Toggle: "Use as default search filter" (optional)
  - **Arrival Preferences**
    - Same structure as departure preferences
- Save preferences to `departure_preferences` and `arrival_preferences` JSONB columns
- Display saved preferences in read-only view when not editing

**Component**: Create `app/components/profile/sections/LocationPreferencesSection.tsx` (follow pattern from `SailingPreferencesSection.tsx`)

#### 3. Onboarding Flow Integration
- **Prospect Chat** (`app/contexts/ProspectChatContext.tsx`):
  - When AI collects location preferences during onboarding, save them to profile preferences
  - Add action: `save_location_preferences` (similar to existing profile update actions)
- **Profile Completion Prompt** (`app/components/profile/ProfileCompletionPrompt.tsx`):
  - If user hasn't set location preferences, suggest adding them
  - Link to profile edit page with location preferences section pre-expanded

### Integration with Search & Filters

#### 4. Filter Context Enhancement (`app/contexts/FilterContext.tsx`)
- Add new filter state properties:
  - `useProfilePreferences: boolean` - Toggle to use profile preferences as default filters
- When `useProfilePreferences` is true:
  - Pre-populate `location` and `arrivalLocation` from profile preferences
  - Show indicator: "Using profile preferences" with option to override
- Distinction:
  - **Profile preferences**: Long-term, reusable preferences stored in profile
  - **Session filters**: Temporary filters for current search session (stored in sessionStorage)

#### 5. Crew Browse Map (`app/components/crew/CrewBrowseMap.tsx`)
- On initial load, if user has profile preferences and no session filters:
  - Optionally auto-apply profile preferences (with user consent prompt)
  - Show badge: "Using profile preferences"
- Allow users to override profile preferences with session-specific filters
- Add button: "Reset to profile preferences" to restore from profile

#### 6. API Integration
- **Profile API** (`app/api/user/profile/route.ts` or extend existing profile update):
  - Handle `departure_preferences` and `arrival_preferences` in PATCH/PUT requests
  - Validate JSONB structure
- **Leg Search API** (`app/api/ai/prospect/legs/route.ts`):
  - Accept optional `use_profile_preferences: boolean` parameter
  - If true and user is authenticated, merge profile preferences with request preferences
  - Priority: Explicit request preferences > Profile preferences > No filter

### Location Handling Strategy

#### 7. Location Format Support
- **Structured locations** (exact coordinates, cities):
  - Use existing `LocationSearch` component with location registry
  - Store as structured data with coordinates/bbox
- **Vague/descriptive locations** (e.g., "Caribbean", "Trans-atlantic"):
  - Store as plain text in `description` field
  - For search, use text matching or AI-assisted interpretation
  - Don't attempt to geocode vague descriptions
- **Hybrid approach**:
  - Allow users to add both structured locations (for precise matching) and descriptions (for flexible matching)
  - Display both types in UI with clear distinction

### AI Matching Integration

#### 8. AI Context Enhancement (`app/lib/ai/assistant/context.ts`)
- Include profile location preferences in system prompt when building context
- Example: "User prefers departures from: Barcelona, Mediterranean. Arrivals: Caribbean, Trans-atlantic routes"
- Use preferences to suggest relevant legs and improve matching

#### 9. Matching Service (`app/lib/ai/assistant/matching.ts`)
- Consider profile preferences when calculating match scores
- Boost match score for legs that align with user's preferred departure/arrival locations

### Translation Updates

#### 10. i18n Support
- Add translations to `messages/en.json` and `messages/fi.json`:
  - `profile.locationPreferences.title`
  - `profile.locationPreferences.departure`
  - `profile.locationPreferences.arrival`
  - `profile.locationPreferences.useAsDefault`
  - `profile.locationPreferences.description`
  - `profile.locationPreferences.saved`
  - `filters.usingProfilePreferences`
  - `filters.resetToProfilePreferences`

### Testing Considerations

#### 11. Test Scenarios
- User saves departure preferences → Verify stored in database
- User saves vague location description → Verify text stored correctly
- User applies profile preferences to search → Verify filters populated correctly
- User overrides profile preferences with session filters → Verify session filters take precedence
- User clears session filters → Verify can reset to profile preferences
- Onboarding flow collects preferences → Verify saved to profile after onboarding

### GDPR Compliance

#### 12. Data Deletion
- Update GDPR deletion logic (`app/api/user/delete-account/route.ts`):
  - Ensure `departure_preferences` and `arrival_preferences` are cleared when user deletes account
  - These are part of `profiles` table, so cascade delete should handle automatically, but verify

### Implementation Order

1. **Phase 1: Database & Backend**
   - Create migration for new columns
   - Update `specs/tables.sql`
   - Update TypeScript types for profile

2. **Phase 2: Profile Edit UI**
   - Create `LocationPreferencesSection.tsx` component
   - Integrate into `app/profile/page.tsx`
   - Add API support for saving preferences

3. **Phase 3: Filter Integration**
   - Enhance `FilterContext` with profile preferences support
   - Update `CrewBrowseMap` to use profile preferences
   - Add UI indicators and controls

4. **Phase 4: Onboarding Integration**
   - Add location preferences collection to prospect chat
   - Update profile completion prompts

5. **Phase 5: AI & Matching**
   - Include preferences in AI context
   - Enhance matching algorithms

6. **Phase 6: Testing & Polish**
   - Add translations
   - Test all scenarios
   - Verify GDPR compliance
