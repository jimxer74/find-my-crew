---
id: TASK-072
title: >-
  AI-assistant enhancement: Location based sailing opportunities matching for
  crew
status: In Progress
assignee: []
created_date: '2026-02-01 20:49'
updated_date: '2026-02-02 05:43'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enhance the AI assistant to support location-based searching for sailing opportunities (legs). 

**Problem Statement:**
Currently, the `search_legs` tool can filter by dates, journey ID, skills, and crew availability, but cannot filter by geographic location. Users should be able to ask questions like:
- "Find sailing opportunities departing from Barcelona"
- "Show me legs arriving in the Caribbean"
- "What sailing trips are available from the Mediterranean to the Atlantic?"

**Solution Overview:**
Add a new AI tool `search_legs_by_location` that:
1. Accepts location names (e.g., "Barcelona", "Caribbean", "Mediterranean")
2. Geocodes these locations using Mapbox Search Box API (already used in the app)
3. Creates a bounding box with appropriate margin for spatial queries
4. Uses PostGIS spatial filtering (similar to existing `get_legs_per_viewport`)
5. Combines location filtering with other criteria (dates, skills, experience, risk level)

**Key Technical Details:**
- App already uses Mapbox for geocoding (see `LocationAutocomplete.tsx`)
- PostGIS spatial queries are already set up (see `get_legs_per_viewport` in `functions.sql`)
- Legs table has `bbox` column with GIST index for efficient spatial queries
- Waypoints table stores start/end locations for each leg
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AI can understand user requests for location-based sailing opportunity searches
- [ ] #2 Departure location filtering works (e.g., 'legs from Barcelona')
- [ ] #3 Arrival/destination location filtering works (e.g., 'legs to Caribbean')
- [ ] #4 Both departure AND arrival locations can be specified together
- [ ] #5 Location search combines with existing filters (dates, skills, experience, risk level)
- [ ] #6 Appropriate margin/buffer is applied to location searches to ensure comprehensive results
- [ ] #7 Tool returns meaningful results with location context (waypoint names)
- [ ] #8 Error handling for invalid or unrecognized locations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Create Geocoding Service (Backend)

**File:** `app/lib/ai/assistant/geocoding.ts` (new)

Create a server-side geocoding service that:
1. Calls Mapbox Search Box API to geocode location names
2. Returns coordinates and bounding box for the location
3. Handles errors gracefully (invalid locations, API failures)

```typescript
interface GeocodedLocation {
  name: string;
  center: { lat: number; lng: number };
  bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  type: string; // 'city', 'region', 'country', etc.
}

async function geocodeLocation(query: string): Promise<GeocodedLocation | null>
```

**Margin Calculation:**
- For point results (cities), apply ~50-100km margin
- For regions/countries, use the returned bbox or apply larger margin
- Consider location type when determining margin size

---

### Phase 2: Add New AI Tool Definition

**File:** `app/lib/ai/assistant/tools.ts`

Add new tool `search_legs_by_location`:

```typescript
{
  name: 'search_legs_by_location',
  description: 'Search for sailing legs/opportunities by geographic location. Use when user mentions specific places, regions, or areas for departure or arrival.',
  parameters: {
    type: 'object',
    properties: {
      departureLocation: {
        type: 'string',
        description: 'Departure location name (e.g., "Barcelona", "Mediterranean")'
      },
      arrivalLocation: {
        type: 'string',
        description: 'Arrival/destination location name'
      },
      startDate: {
        type: 'string',
        description: 'Filter legs starting after this date (ISO format)'
      },
      endDate: {
        type: 'string',
        description: 'Filter legs ending before this date (ISO format)'
      },
      skillsRequired: {
        type: 'string',
        description: 'Comma-separated list of required skills'
      },
      riskLevels: {
        type: 'string',
        description: 'Comma-separated risk levels (Coastal sailing, Offshore sailing, Extreme sailing)'
      },
      minExperienceLevel: {
        type: 'number',
        description: 'Minimum experience level (1=Beginner to 4=Offshore Skipper)'
      },
      limit: {
        type: 'number',
        description: 'Maximum results (default 10)'
      }
    }
  }
}
```

---

### Phase 3: Implement Tool Executor

**File:** `app/lib/ai/assistant/toolExecutor.ts`

Add case handler for `search_legs_by_location`:

1. Geocode departure and/or arrival locations
2. Calculate appropriate bounding boxes with margins
3. Query legs table with spatial filtering:
   - For departure: filter where start waypoint (index=0) is within departure bbox
   - For arrival: filter where end waypoint (max index) is within arrival bbox
4. Apply additional filters (dates, skills, experience, risk)
5. Return results with waypoint location names

**Query Strategy:**
```sql
-- Find legs where start waypoint is within departure bbox
SELECT l.*, 
  (SELECT name FROM waypoints WHERE leg_id = l.id AND index = 0) as start_location,
  (SELECT name FROM waypoints WHERE leg_id = l.id AND index = (SELECT MAX(index) FROM waypoints WHERE leg_id = l.id)) as end_location
FROM legs l
JOIN journeys j ON j.id = l.journey_id
WHERE j.state = 'Published'
  AND EXISTS (
    SELECT 1 FROM waypoints w 
    WHERE w.leg_id = l.id 
    AND w.index = 0  -- Start waypoint
    AND ST_Within(w.location, ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326))
  )
  -- Similar for arrival location with max index
```

---

### Phase 4: Enhance System Prompt

**File:** `app/lib/ai/assistant/context.ts`

Update `buildSystemPrompt` to guide AI on when to use location-based search:
- Detect location-related keywords ("from", "to", "near", "around", "in")
- Distinguish between departure and arrival intent
- Handle regional queries (Mediterranean, Caribbean, Atlantic)

---

### Phase 5: Testing & Edge Cases

1. **Test single location** (departure only, arrival only)
2. **Test both locations** (departure AND arrival)
3. **Test with additional filters** (dates + location + skills)
4. **Test ambiguous locations** (handle multiple matches)
5. **Test large regions** (Caribbean, Mediterranean - larger margins)
6. **Test invalid locations** (graceful error handling)
7. **Test location + existing filters** (ensure compatibility)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `app/lib/ai/assistant/geocoding.ts` | CREATE | Geocoding service using Mapbox API |
| `app/lib/ai/assistant/tools.ts` | MODIFY | Add `search_legs_by_location` tool definition |
| `app/lib/ai/assistant/toolExecutor.ts` | MODIFY | Implement tool execution with spatial queries |
| `app/lib/ai/assistant/context.ts` | MODIFY | Update system prompt for location awareness |
| `app/lib/ai/assistant/types.ts` | MODIFY | Add types for geocoding (if needed) |

---

## Dependencies

- Mapbox Access Token (already configured: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`)
- PostGIS extension (already enabled)
- Existing `waypoints` table with spatial index

---

## Considerations

1. **API Rate Limits:** Mapbox has rate limits; cache results if needed
2. **Margin Size:** Balance between coverage and precision
3. **User Experience:** Return helpful messages for no-results scenarios
4. **Performance:** Spatial queries are indexed but verify performance with real data
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 New geocoding service created and tested
- [ ] #2 AI tool definition added to tools.ts
- [ ] #3 Tool executor implementation complete with spatial queries
- [ ] #4 System prompt updated for location awareness
- [ ] #5 Manual testing with various location queries successful
- [ ] #6 Error handling verified for invalid locations
<!-- DOD:END -->
