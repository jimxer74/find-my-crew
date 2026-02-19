# Waypoint Disappearing Issue - True Root Cause Analysis

## Timeline of Investigation

1. **Initial Report**: Waypoints disappear when panning/zooming on mobile
2. **Investigation Phase 1**: Found and fixed double client-side filtering
3. **Investigation Phase 2**: Found RPC returning legs without waypoints (migration 042)
4. **Investigation Phase 3**: Thought it was huge bboxes (attempted migration 043)
5. **Reality Check**: Migration 043 made problem WORSE - waypoints disappearing more frequently
6. **Final Understanding**: The real issue is NOT in the RPC - it's in how the RPC result is being used

---

## What Actually Happened

### The False Path (Migration 043)
Added `ST_Within` check requiring waypoints be spatially WITHIN viewport envelope.
- **Result**: More waypoints disappeared
- **Why**: `ST_Within` is too strict for edge cases and zoomed-in views
- **Lesson**: Over-constraining at the database layer creates false negatives

### The Real Issue
The RPC layer should return **all legs that might be visible** based on bbox intersection.
The **client-side rendering** layer should handle the edge cases with fallback logic.

**Reason**:
- Database doesn't know the exact pixel coordinates of the viewport (only lat/lng bounds)
- Client knows exact screen position, zoom level, UI overlays (bottom sheet)
- Client-side rendering with waypoint fallback is the right place to handle edge cases

---

## Correct Architecture

```
┌─────────────────────────────────────────────────────┐
│ RPC Layer (Fast, Loose Filtering)                   │
│ ========================================              │
│ 1. Check j.state = 'Published'                       │
│ 2. Check l.bbox && viewport_bbox (loose check)      │
│ 3. Check leg HAS start_waypoint (exists check)      │
│ → Return all candidate legs                         │
│                                                      │
│ Purpose: Quick elimination of obviously            │
│          out-of-viewport legs                       │
└─────────────────────────────────────────────────────┘
              ↓ API returns results
┌─────────────────────────────────────────────────────┐
│ Client-Side Rendering (Smart, Context-Aware)        │
│ ===============================================      │
│ 1. Create GeoJSON features for legs                  │
│ 2. For each leg:                                     │
│    - Try preferred waypoint (start or end)          │
│    - Fallback to alternate if missing               │
│    - Only skip if BOTH null (malformed)             │
│ 3. Render on map with Mapbox                        │
│                                                      │
│ Purpose: Handle edge cases with full context:       │
│          - Screen pixel positions                   │
│          - Exact zoom level                         │
│          - Bottom sheet overlays                    │
│          - Fallback logic for incomplete data       │
└─────────────────────────────────────────────────────┘
```

---

## Key Lessons

1. **Database layer** (migration 042): Ensure returned data is valid (has waypoints)
2. **Frontend filtering layer**: Don't filter what's already been filtered
3. **Viewport calculation layer**: Include all UI overlays in bounds
4. **Rendering layer**: Use fallback logic for edge cases

**What NOT to do**: Add more constraints at the database layer hoping to fix rendering issues. That creates a false sense of security and fails at boundaries.

---

## Migration 044 - The Correct Solution

Migration 044 effectively **reverts the strict spatial filtering** from 043 and relies on:

1. **Bbox intersection filter** (loose): `l.bbox && ST_MakeEnvelope(...)`
   - Fast due to spatial index
   - Returns all potentially-visible legs
   - Some false positives but that's OK

2. **Exists check** (validation): `EXISTS (SELECT 1 FROM waypoints WHERE index = 0)`
   - Ensures legs have displayable waypoints
   - Prevents unmappable results

3. **Client-side rendering** (smart): GeoJSON generation with fallback logic
   - Handles edge cases with full context
   - Knows screen coordinates, zoom level, UI
   - Can skip truly malformed legs

This is the correct architecture for viewport filtering.
