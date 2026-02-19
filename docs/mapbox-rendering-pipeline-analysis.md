# Mapbox Rendering Pipeline - Complete Analysis (No Changes)

## Overview

The waypoint rendering on the map involves a complex pipeline from RPC function → API response → React state → GeoJSON sources → Mapbox layers. This analysis traces every step to identify potential issues.

---

## 1. Data Flow Pipeline

```
┌─────────────────────────────────────────┐
│ 1. RPC Function (migration/044)          │
│ get_legs_in_viewport()                   │
│ ├─ Filters by bbox intersection (&& op)  │
│ ├─ Filters by start_waypoint EXISTS      │
│ └─ Returns legs with start + end wppts   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 2. API Endpoint (/api/legs/viewport)     │
│ ├─ Receives bounds from frontend        │
│ ├─ Calls RPC with bounds                │
│ ├─ Transforms waypoints:                │
│ │  {coordinates: [lng,lat]} →           │
│ │  {lng, lat, name}                     │
│ └─ Returns: {legs: [], count}           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 3. Frontend API Call                     │
│ (handleViewportChange in CrewBrowseMap) │
│ ├─ Location: Line 1130-1173             │
│ ├─ fetch(/api/legs/viewport?params)     │
│ ├─ Calculates match%, experience match  │
│ └─ setLegs(legsWithMatch) → state       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 4. GeoJSON Conversion Effect             │
│ (useEffect at Line 682-789)             │
│ ├─ Triggers when: legs, filters,        │
│ │  userRegistrations, user change       │
│ ├─ Separates approved from others       │
│ ├─ Generates GeoJSON features           │
│ ├─ Calls source.setData(geoJsonData)    │
│ └─ Updates BOTH sources                 │
│   └─ legs-source (clustered)            │
│   └─ approved-legs-source (non-clust)   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 5. Mapbox Layer Rendering                │
│ ├─ clusters layer (cluster circles)      │
│ ├─ cluster-count layer (numbers)         │
│ ├─ registered-approved layer (pins)      │
│ ├─ registered-pending layer (pins)       │
│ └─ unclustered-point layer (circles)     │
│                                          │
│ These layers have paint & filter rules   │
│ that determine which features display    │
└─────────────────────────────────────────┘
```

---

## 2. Critical Rendering Points

### 2.1 GeoJSON Feature Generation (Lines 700-732, 746-778)

**Location**: `useEffect` at line 682-789

**What it does**:
- Converts legs (from API) into Mapbox GeoJSON features
- Creates TWO feature collections:
  1. **Clustered**: All non-approved legs
  2. **Non-Clustered**: Only approved legs

**Code Structure**:
```typescript
// Determines if waypoint is shown
const showEndWaypoints = !filters.location && !!filters.arrivalLocation;
// Line 688 - CRITICAL FILTER LOGIC

// Then for EACH leg:
let waypoint = showEndWaypoints ? leg.end_waypoint : leg.start_waypoint;

// If preferred waypoint missing:
if (!waypoint) {
  waypoint = showEndWaypoints ? leg.start_waypoint : leg.end_waypoint;
}

// Skip if BOTH missing:
if (!waypoint) continue;  // Line 716

// Create feature with waypoint coords
features.push({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [waypoint.lng, waypoint.lat],  // Line 722
  },
  properties: {
    leg_id: leg.leg_id,
    has_user: hasUser,
    match_percentage: hasUser ? (leg.skill_match_percentage ?? 100) : null,
    experience_matches: hasUser ? (leg.experience_level_matches ?? true) : null,
    registration_status: userRegistrations.get(leg.leg_id) || null,  // Line 729
  },
});
```

**Potential Issues Here**:
- ❓ `showEndWaypoints` logic at line 688 - switches waypoints based on filters
  - If only arrival filter is set, uses END waypoint
  - Otherwise uses START waypoint
  - What if filters change rapidly? Effect re-runs, could cause flicker
- ❓ `userRegistrations.get(leg.leg_id)` at line 729
  - If registration data is stale/mismatched, could show wrong status
  - Could affect layer filtering logic downstream

### 2.2 Source Data Update (Lines 739-743, 785-788)

**Location**: After GeoJSON creation

```typescript
const source = map.current.getSource('legs-source') as mapboxgl.GeoJSONSource;
if (source) {
  source.setData(geoJsonData);  // Line 742
}

const approvedSource = map.current.getSource('approved-legs-source') as mapboxgl.GeoJSONSource;
if (approvedSource) {
  source.setData(approvedGeoJsonData);  // Line 787
}
```

**Potential Issues Here**:
- ❓ **NO error handling** if `source` or `approvedSource` is null
  - If source not initialized yet, setData silently fails
  - GeoJSON never updates on the map
  - User sees stale data or no waypoints
- ❓ **Silent failures** - no logging if setData fails
  - Could fail if map not fully loaded
  - Could fail if source was removed
  - No way to know what happened
- ❓ **Race condition**: What if source doesn't exist yet?
  - Effect runs before sources are added to map
  - setData called on undefined source
  - Features never render

### 2.3 Dependencies Array (Line 789)

```typescript
}, [legs, mapLoaded, userRegistrations, filters.location, filters.arrivalLocation, user]);
```

**What triggers re-render**:
- `legs` changes → API returned new data
- `mapLoaded` changes → map initialization
- `userRegistrations` changes → registration status updated
- `filters.location` changes → departure filter changed
- `filters.arrivalLocation` changes → arrival filter changed
- `user` changes → login/logout

**Potential Issues**:
- ❓ **Missing `showEndWaypoints` calculation dependency**
  - Line 688 depends on `filters.location` and `filters.arrivalLocation`
  - These ARE in dependencies, so OK
- ❓ **High frequency updates**: If any dependency changes frequently:
  - Effect runs → features rebuilt → source.setData() called
  - Map re-renders all layers
  - Could cause flickering if deps update multiple times per second

---

## 3. Mapbox Layer Configuration & Filtering

### 3.1 Cluster Layer (Lines 1264-1293)

```typescript
map.current.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'legs-source',
  filter: ['has', 'point_count'],  // Only show if clustered
  paint: {
    'circle-color': '#0E1D34',
    'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40],
  },
});
```

**Filter Logic**: `['has', 'point_count']`
- Mapbox automatically adds `point_count` to clustered features
- This layer ONLY shows clusters, not individual points

### 3.2 Non-Clustered Individual Legs Layer (Lines 1401-1459)

```typescript
map.current.addLayer({
  id: 'unclustered-point',
  type: 'circle',
  source: 'legs-source',
  filter: [
    'all',
    ['!', ['has', 'point_count']],  // NOT clustered (individual point)
    ['==', ['get', 'registration_status'], null],  // NOT registered
  ],
  paint: {
    'circle-color': [
      'case',
      ['==', ['get', 'has_user'], false], '#22276E',  // dark blue if no user
      ['==', ['get', 'experience_matches'], false], '#ef4444',  // red if exp doesn't match
      ['>=', ['get', 'match_percentage'], 80], '#22c55e',  // green
      ['>=', ['get', 'match_percentage'], 50], '#fde047',  // yellow
      ['>=', ['get', 'match_percentage'], 25], '#fdba74',  // orange
      '#ef4444',  // red fallback
    ],
  },
});
```

**Filter Chain**:
1. `['!', ['has', 'point_count']]` - Must NOT be clustered
2. `['==', ['get', 'registration_status'], null]` - Must NOT be registered

---

## 7. The "Arbitrary Disappearing" Issue - Root Causes

Based on analysis, here are the MOST likely causes:

### 7.1 **CRITICAL: Missing Source Error Handling** (Lines 740-743, 785-788)

```typescript
const source = map.current.getSource('legs-source') as mapboxgl.GeoJSONSource;
if (source) {
  source.setData(geoJsonData);
}
```

**Issue**:
- If source is NULL → setData never called
- GeoJSON never updates
- Map still shows OLD data or NOTHING
- No error logged, silent failure

### 7.2 **userRegistrations Data Staleness** (Lines 729, 691-695)

```typescript
userRegistrations.get(leg.leg_id)  // Line 729
```

**Issue**:
- Registration status from context
- If not synchronized with API data
- Could show wrong status badge
- If status changes mid-render, leg might disappear/reappear

### 7.3 **Rapid Filter/State Updates** (Line 789)

**Issue**:
- Effect runs when ANY dependency changes
- If multiple dependencies change rapidly, GeoJSON rebuilt multiple times
- Could cause momentary flicker or disappearing

### 7.4 **Clustering Boundary Effects** (Line 1248)

**Issue**:
- At zoom 14: clustering switches on/off
- Points in cluster radius (50px) get grouped
- When cluster boundary shifts, looks like waypoint appeared/disappeared

---

## Summary of Suspicious Areas

| Area | Risk | Symptom | Code |
|------|------|---------|------|
| Source null check | HIGH | Silent failure | 740-743, 785-788 |
| userRegistrations sync | HIGH | Wrong layer grouping | 729, 691-695 |
| Effect dependencies | MEDIUM | Rapid flicker | 789 |
| Icon loading timing | MEDIUM | Pins not show | 1215-1238 |
| Cluster boundaries | MEDIUM | Appearing/disappearing | 1248 |
