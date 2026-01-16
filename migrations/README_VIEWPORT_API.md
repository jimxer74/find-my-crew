# Viewport API - Phase 1 Implementation

## Overview
This document describes the implementation of Phase 1: API Endpoints for Geospatial Queries, which enables efficient viewport-based browsing of sailing legs for crew members.

## Files Created

### 1. Database Migration: `create_legs_viewport_query.sql`
**Location**: `migrations/create_legs_viewport_query.sql`

**Purpose**: Creates a PostGIS-optimized RPC function for querying legs within a geographic viewport.

**Key Features**:
- Uses PostGIS `bbox` column with GIST index for fast spatial filtering
- Only returns legs from **Published** journeys
- Combines journey-level and leg-level skills (removes duplicates)
- Returns start and end waypoints with coordinates and names
- Supports optional filters:
  - Date range (start_date, end_date)
  - Risk levels (array)
  - Skills (array - all must be present)

**Function Signature**:
```sql
get_legs_in_viewport(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  start_date_filter date DEFAULT NULL,
  end_date_filter date DEFAULT NULL,
  risk_levels_filter risk_level[] DEFAULT NULL,
  skills_filter text[] DEFAULT NULL
)
```

**Returns**: Table with leg details, journey info, boat info, skipper name, and waypoints.

**Performance**: 
- Uses `bbox && ST_MakeEnvelope(...)` for efficient spatial intersection
- Leverages GIST index on `legs.bbox` column
- Single query with joins (no N+1 queries)

### 2. API Route: `/api/legs/viewport`
**Location**: `app/api/legs/viewport/route.ts`

**Purpose**: Next.js API endpoint that wraps the RPC function with validation and error handling.

**HTTP Method**: `GET`

**Query Parameters**:
- `min_lng` (required): Minimum longitude
- `min_lat` (required): Minimum latitude
- `max_lng` (required): Maximum longitude
- `max_lat` (required): Maximum latitude
- `start_date` (optional): Filter legs starting on or after this date (YYYY-MM-DD)
- `end_date` (optional): Filter legs ending on or before this date (YYYY-MM-DD)
- `risk_levels` (optional): Comma-separated risk levels (e.g., "Coastal sailing,Offshore sailing")
- `skills` (optional): Comma-separated skills (e.g., "First Aid,Navigation")

**Response Format**:
```json
{
  "legs": [
    {
      "leg_id": "uuid",
      "leg_name": "string",
      "leg_description": "string",
      "journey_id": "uuid",
      "journey_name": "string",
      "start_date": "ISO 8601 timestamp",
      "end_date": "ISO 8601 timestamp",
      "crew_needed": number,
      "risk_level": "Coastal sailing" | "Offshore sailing" | "Extreme sailing",
      "skills": ["string"],
      "boat_id": "uuid",
      "boat_name": "string",
      "boat_type": "sailboat_category",
      "boat_image_url": "string" | null,
      "skipper_name": "string" | null,
      "start_waypoint": {
        "lng": number,
        "lat": number,
        "name": "string" | null
      } | null,
      "end_waypoint": {
        "lng": number,
        "lat": number,
        "name": "string" | null
      } | null
    }
  ],
  "count": number
}
```

**Error Responses**:
- `400`: Invalid parameters (missing bounds, invalid coordinates, invalid date format, invalid risk levels)
- `500`: Database error or internal server error

## Usage Example

```typescript
// Example API call
const response = await fetch(
  `/api/legs/viewport?min_lng=-10&min_lat=35&max_lng=10&max_lat=60&start_date=2024-06-01&risk_levels=Coastal sailing,Offshore sailing&skills=First Aid,Navigation`
);
const data = await response.json();
console.log(data.legs); // Array of legs
```

## Database Migration Instructions

1. Run the migration file in your Supabase SQL editor or via migration tool:
   ```sql
   -- Execute: migrations/create_legs_viewport_query.sql
   ```

2. Verify the function was created:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'get_legs_in_viewport';
   ```

3. Test the function (optional):
   ```sql
   SELECT * FROM get_legs_in_viewport(
     -10, 35, 10, 60,  -- Viewport bounds (Europe)
     NULL, NULL,        -- No date filters
     NULL,              -- No risk level filter
     NULL               -- No skills filter
   );
   ```

## Next Steps (Phase 2)

Phase 2 will implement the map-based browsing component that uses this API endpoint:
- Mapbox GL map integration
- Viewport-based loading
- Marker clustering
- Leg details panel

## Notes

- The function only returns legs from journeys with `state = 'Published'`
- Skills are automatically combined from journey and leg levels
- Waypoints are returned as `{ lng, lat, name }` objects for easy frontend consumption
- The `bbox` column must be populated (handled automatically by triggers when waypoints are added/updated)
- Empty skills arrays are handled gracefully (returns all legs if no skills filter is provided)
