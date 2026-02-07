---
id: TASK-089
title: New homepage for Crew role users
status: To Do
assignee: []
created_date: '2026-02-07 21:30'
updated_date: '2026-02-07 21:35'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Completely new Front Page for crew users. Concept is to display best matching sailing legs from the popular cruising areas that are defined in /lib/gecoding/locations.ts

- first users current location is retrieved by it's user agent for example
- display a list of cruising locations starting from the closes one to users current location
- Per each cruising location display the name of the cruising location as header, and make it also a link that opens up the map page filtering the legs with that cruising area bounding box as departure box
- Per each cruising location, render found legs in best matching order, use the LegListItem and render list the legs from left to right, display as many as fits in screen width. Use prev / next buttons in desktop adn swipe gesture in mobile to load more legs
- if there are no legs for a specific cruising area, do not show the header of it

--> Leave the old homepage still as a backup, do not delete it, this is added as new. Default crew user after login to new page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User's location is detected via browser Geolocation API on page load
- [ ] #2 Cruising regions are displayed sorted by distance from user's location
- [ ] #3 Each cruising region shows a horizontal scrollable list of matching legs
- [ ] #4 Legs are sorted by match score (best matches first) within each region
- [ ] #5 Region headers link to map view filtered by that region's bounding box
- [ ] #6 Desktop: Previous/Next navigation buttons for leg carousel
- [ ] #7 Mobile: Swipe gesture works for horizontal scrolling
- [ ] #8 LegListItem component is reused for consistent leg display
- [ ] #9 Graceful fallback when location permission is denied
- [ ] #10 Old /crew/dashboard page remains functional as map-based browse
- [ ] #11 Crew users are redirected to new homepage after login
- [ ] #12 All UI text is localized (EN and FI)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan for Crew Homepage

### Overview
Create a new homepage for Crew role users that displays sailing legs organized by cruising regions, sorted by proximity to the user's current location.

### Phase 1: Create New Page and Core Components

#### 1.1 Create New Crew Homepage Route
- **File:** `app/crew/home/page.tsx`
- New page that will become the default landing for crew users
- Keep existing `/crew/dashboard` as the map-based browse page

#### 1.2 Create Cruising Region Section Component
- **File:** `app/components/crew/CruisingRegionSection.tsx`
- Props: `region: LocationRegion`, `legs: LegListItemData[]`, `onLegClick: (leg) => void`
- Features:
  - Region name as header (clickable link to map with bbox filter)
  - Horizontal scrollable list of `LegListItem` components
  - Desktop: prev/next navigation buttons
  - Mobile: swipe gesture support (touch events or CSS scroll-snap)
  - "Load more" pagination within each region

#### 1.3 Create Horizontal Leg Carousel Component
- **File:** `app/components/crew/LegCarousel.tsx`
- Reusable horizontal scrolling list of LegListItem cards
- Features:
  - CSS scroll-snap for smooth mobile swiping
  - Navigation arrows for desktop (show on hover)
  - Responsive card sizing (fit as many as screen width allows)
  - Lazy loading for performance

### Phase 2: User Location Detection

#### 2.1 Create Geolocation Hook
- **File:** `app/hooks/useUserLocation.ts`
- Use browser Geolocation API to get user's current position
- Fallback handling if permission denied (default to popular region like Mediterranean)
- Return: `{ lat, lng, loading, error, permissionState }`

#### 2.2 Create Distance Calculation Utility
- **File:** Add to `app/lib/geocoding/locations.ts`
- Function: `calculateDistanceToRegion(userLat, userLng, region: LocationRegion): number`
- Use Haversine formula to calculate distance to region center
- Function: `sortRegionsByDistance(userLat, userLng, regions: LocationRegion[]): LocationRegion[]`

### Phase 3: API Integration

#### 3.1 Create New API Endpoint for Region-Based Legs
- **File:** `app/api/legs/by-region/route.ts`
- Parameters:
  - `region_bbox` (minLng, minLat, maxLng, maxLat)
  - `limit` (number of legs to return, default 10)
  - `offset` (for pagination)
  - Standard filters (date, risk level, experience level)
- Returns legs within the region's bbox, sorted by match score
- Reuses existing `get_legs_in_viewport` RPC function

#### 3.2 Create Data Fetching Hook
- **File:** `app/hooks/useCruisingRegionLegs.ts`
- Fetches legs for a specific region
- Handles loading, error states, and pagination
- Caches results to avoid refetching

### Phase 4: Main Homepage Assembly

#### 4.1 Implement Crew Home Page
- **File:** `app/crew/home/page.tsx`
- Flow:
  1. Request user's location (with loading state)
  2. Sort `LOCATION_REGISTRY` by distance to user
  3. Render list of `CruisingRegionSection` components
  4. Each section fetches its own legs independently
  5. Infinite scroll or "Show more regions" button

#### 4.2 Update Navigation/Routing
- Update auth redirect for crew users to `/crew/home` instead of `/crew/dashboard`
- Add navigation link to switch between home and map views
- Keep existing map functionality at `/crew/dashboard`

### Phase 5: UI/UX Polish

#### 5.1 Loading States
- Skeleton loaders for regions while fetching
- Placeholder cards while legs are loading
- Smooth transitions between states

#### 5.2 Empty States
- Handle regions with no available legs
- Message encouraging users to check back later or explore other regions

#### 5.3 Responsive Design
- Mobile: Full-width cards, swipe to scroll
- Tablet: 2-3 cards visible
- Desktop: 4-5 cards visible with navigation arrows

#### 5.4 Link Generation for Map View
- Region header links to: `/crew/dashboard?departure_min_lng=X&departure_min_lat=X&departure_max_lng=X&departure_max_lat=X`
- This will open the map pre-filtered to show legs in that cruising region

### Phase 6: Localization

#### 6.1 Add Translation Keys
- Add to `messages/en.json` and `messages/fi.json`:
  - `crewHome.title`
  - `crewHome.subtitle`
  - `crewHome.nearYou`
  - `crewHome.viewOnMap`
  - `crewHome.noLegsInRegion`
  - `crewHome.loadMore`
  - `crewHome.locationPermission`

### Technical Considerations

1. **Performance:**
   - Lazy load regions below the fold
   - Use intersection observer for visibility-based loading
   - Cache API responses with SWR or React Query pattern

2. **State Management:**
   - Use FilterContext for consistency with existing filters
   - Each region manages its own pagination state

3. **Match Score Calculation:**
   - Reuse existing `calculateSkillMatch` and `userExperienceMeetsRequirement` from CrewBrowseMap
   - Extract to shared utility for reuse

4. **Error Handling:**
   - Graceful fallback if location permission denied
   - Individual region error states don't break entire page

### File Structure Summary

```
app/
├── crew/
│   ├── home/
│   │   └── page.tsx           # New crew homepage
│   └── dashboard/
│       └── page.tsx           # Existing map view (unchanged)
├── components/
│   └── crew/
│       ├── CruisingRegionSection.tsx
│       └── LegCarousel.tsx
├── hooks/
│   ├── useUserLocation.ts
│   └── useCruisingRegionLegs.ts
├── api/
│   └── legs/
│       └── by-region/
│           └── route.ts
└── lib/
    └── geocoding/
        └── locations.ts       # Add distance calculation functions
```

### Dependencies
- No new external dependencies required
- Uses existing LegListItem component
- Uses existing viewport API patterns
<!-- SECTION:PLAN:END -->
