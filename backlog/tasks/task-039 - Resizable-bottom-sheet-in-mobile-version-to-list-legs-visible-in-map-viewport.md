---
id: TASK-039
title: Resizable bottom sheet in mobile version to list legs visible in map viewport
status: In Progress
assignee: []
created_date: '2026-01-28 06:42'
updated_date: '2026-02-07 13:36'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mobile version:
Similar to Airbnb mobile version, a bottom sheet that user can expand and make smaller. Bottom sheet lists the legs found in the users current viewport, organized in order of the best match. Information displayed:
- Journey images if exist and boat images for the journey (large in top) in single carousel, swiping left and right displays a next image (see existing ImageCarousel)
- Match badge on top left, shows the match percentage
- Under the boat image: Leg Name, Journey name, start and end places, dates, duration
- Clicking  the image and opens the leg detail view
- Sort legs in best match first order

Desktop version:
- In desktop list the Legs in left side pane, clicking the single leg in the list, opens the detail view of the leg in the same pane.
- All other logic sorting etc. same as in mobile version

Important Implementation concepts:
- Create reusable Leg list component that can be used so that the legs to be displayed are provieded as parameters to the component
- This same component will be used in other contexts as well in future
- Make the component configurable by parent caller, so that it can be defined what data to show on the list from the legs
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mobile: Bottom sheet displays legs in viewport, resizable (collapsed/half/full)
- [x] #2 Mobile: Bottom sheet shows leg cards with image carousel, match badge, leg info
- [x] #3 Mobile: Tapping a leg opens LegDetailsPanel full screen
- [x] #4 Desktop: Left side pane lists legs in viewport
- [x] #5 Desktop: Clicking leg shows detail view in same pane with back navigation
- [x] #6 Legs are sorted by best match percentage first
- [x] #7 LegListItem component is reusable and configurable
- [x] #8 LegList component accepts legs as props and is reusable in other contexts
- [x] #9 Image carousel combines journey images + boat image
- [x] #10 Match badge displays on top-left of each leg card
- [x] #11 Leg info shows: leg name, journey name, start/end places, dates, duration
- [x] #12 Header remains visible at all times
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Create Reusable LegListItem Component
**File:** `app/components/crew/LegListItem.tsx`

A configurable card component for displaying a single leg in a list:
- Props interface with configurable display options (what to show/hide)
- Image carousel using existing `ImageCarousel` component
  - Combines `journey_images` + `boat_image_url` in single carousel
- MatchBadge overlay on top-left (using existing component)
- Leg info section below image:
  - Leg name, Journey name
  - Start/end places (from waypoints)
  - Dates with duration calculation
- Click handler prop for navigation to detail view
- Responsive sizing for mobile bottom sheet vs desktop pane

### Phase 2: Create LegList Component
**File:** `app/components/crew/LegList.tsx`

A wrapper component that renders a list of LegListItem:
- Props: `legs: Leg[]`, display configuration, onLegClick handler
- Sorts legs by match percentage (best match first)
- Handles empty state
- Virtualized scrolling for performance (optional, if list can be large)

### Phase 3: Mobile Bottom Sheet Component
**File:** `app/components/ui/BottomSheet.tsx`

Resizable bottom sheet similar to Airbnb mobile:
- Three snap points: collapsed (peek), half-screen, expanded
- Drag handle for resizing
- Swipe gestures (react-swipeable or framer-motion)
- Smooth spring animations
- Backdrop handling
- Body scroll lock when expanded

### Phase 4: Desktop Side Pane Enhancement
Modify or create pane for desktop leg list:
- Uses LegList component
- Fixed left side position (similar pattern to existing LegDetailsPanel)
- Clicking leg opens LegDetailsPanel in same pane (replaces list)
- Back button to return to list view

### Phase 5: Integration with CrewBrowseMap
**File:** `app/components/crew/CrewBrowseMap.tsx`

- Track legs in current viewport (already available via API)
- Pass viewport legs to LegList/BottomSheet
- Handle leg selection flow:
  - Mobile: bottom sheet -> tap item -> LegDetailsPanel full screen
  - Desktop: side pane list -> click item -> detail view in pane
- Maintain sorted order by match percentage

---

## Component Architecture

```
CrewBrowseMap
├── Map (Mapbox)
├── [Mobile] BottomSheet
│   └── LegList
│       └── LegListItem (multiple)
├── [Desktop] SidePane
│   ├── LegList (list view)
│   │   └── LegListItem (multiple)
│   └── LegDetailsPanel (detail view, replaces list)
```

---

## Files to Create
1. `app/components/crew/LegListItem.tsx` - Configurable leg card
2. `app/components/crew/LegList.tsx` - List wrapper with sorting
3. `app/components/ui/BottomSheet.tsx` - Resizable mobile sheet

## Files to Modify
1. `app/components/crew/CrewBrowseMap.tsx` - Integration
2. `app/components/crew/LegDetailsPanel.tsx` - Possible adjustments for pane mode

---

## Technical Considerations
- Use framer-motion or react-spring for smooth bottom sheet animations
- Ensure header remains visible (top-16 offset)
- Use existing Tailwind responsive patterns (md: breakpoint)
- Leverage existing match calculation from `skillMatching.ts`
- Reuse ImageCarousel and MatchBadge components
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete

### Files Created:
1. `app/components/crew/LegListItem.tsx` - Reusable, configurable leg card with image carousel, match badge, and leg info
2. `app/components/crew/LegList.tsx` - List wrapper that accepts legs as props, sorts by match %, handles empty state
3. `app/components/ui/BottomSheet.tsx` - Resizable mobile bottom sheet with 3 snap points (collapsed/half/expanded), drag gestures
4. `app/components/crew/LegBrowsePane.tsx` - Desktop left side pane showing leg list

### Files Modified:
1. `app/components/crew/CrewBrowseMap.tsx` - Integrated all new components

### Key Features:
- Mobile: BottomSheet displays legs in viewport with drag-to-resize (3 snap points)
- Desktop: LegBrowsePane shows leg list, hides when detail panel opens
- LegListItem is fully configurable with display options
- Images carousel combines journey_images + boat_image_url
- Match badge on top-left of each card
- Sorted by best match percentage first
- Header remains visible at all times (top-16 offset)
<!-- SECTION:NOTES:END -->
