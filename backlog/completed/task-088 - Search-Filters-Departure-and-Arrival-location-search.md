---
id: TASK-088
title: Search / Filters Departure and Arrival location search
status: Done
assignee: []
created_date: '2026-02-07 16:27'
updated_date: '2026-02-07 16:59'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Departure and Arrival location search capability in the search / filters functionality when user wants to search sailing trips using specific locations.

The search must work so, that if Departure location is given, it must search starting legs in that location so that it is changed to a bigger bounding box with enough margins that possible legs are found. Same thing with the Arrival location. 

If Arrival or Departure location is not given then that is of course not used in searching legs. 

There is existing functions to get bounding boxes in /lib/geocoding, check that and use it if it is suitable. Propose changes if needed, check any depedendencies to existing code that might use those functions of course.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Summary

Added departure and arrival location search filters to the crew browse map, allowing users to filter legs by specifying departure and/or arrival locations.

### Changes Made

**1. Migration file: `migrations/020_add_location_filters_to_viewport.sql`**
- Updated `get_legs_in_viewport` RPC function with 8 new optional parameters for location filtering:
  - `departure_min_lng`, `departure_min_lat`, `departure_max_lng`, `departure_max_lat`
  - `arrival_min_lng`, `arrival_min_lat`, `arrival_max_lng`, `arrival_max_lat`
- Added WHERE clauses using PostGIS `ST_Within` to filter:
  - Start waypoint (index=0) within departure bounding box
  - End waypoint (max index) within arrival bounding box

**2. API Route: `app/api/legs/viewport/route.ts`**
- Added support for `departure_lat`, `departure_lng`, `arrival_lat`, `arrival_lng` query parameters
- Calculates bounding boxes with 1 degree margin (~111km) from location center points
- Clamps latitude values to valid -90/+90 range
- Passes bounding box parameters to the RPC function

**3. CrewBrowseMap: `app/components/crew/CrewBrowseMap.tsx`**
- Updated `handleViewportChange` to extract location filters from FilterContext
- Appends `departure_lat`, `departure_lng`, `arrival_lat`, `arrival_lng` params to API calls
- Added `arrivalLocation` to the useEffect dependencies for filter change detection
- Updated logging to include location filters

**4. Documentation: `specs/functions.sql`**
- Added parameter documentation for the new location filter parameters
- Added WHERE clause documentation for departure and arrival filtering

### How It Works
1. User selects a departure location (e.g., "Barcelona") in the FiltersDialog
2. The location's lat/lng is stored in FilterContext
3. CrewBrowseMap passes these coordinates to the API
4. API calculates a 1-degree bounding box around the location
5. RPC function filters legs where start waypoint is within this box
6. Same process for arrival location filtering end waypoint
<!-- SECTION:FINAL_SUMMARY:END -->
