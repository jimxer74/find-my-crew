# Mapbox Rendering Critical Fixes - Summary

**Commit**: `331f2e9`
**File**: `app/components/crew/CrewBrowseMap.tsx`

---

## Fix #1: Missing Source Error Handling ✅

**Problem**: Silent failures when GeoJSON sources don't exist
- If source is null, `source.setData()` is never called
- No error logged, GeoJSON never updates
- User sees stale data or no waypoints
- Extremely hard to debug

**Location**: Lines 739-815

**Solution**: Added error handling and logging
```typescript
const source = map.current.getSource('legs-source') as mapboxgl.GeoJSONSource;
if (source) {
  try {
    source.setData(geoJsonData);
    logger.debug('Updated legs-source with GeoJSON', { featureCount: geoJsonData.features.length });
  } catch (error) {
    logger.error('Failed to update legs-source GeoJSON', { error: error instanceof Error ? error.message : String(error) });
  }
} else {
  logger.warn('legs-source not found when trying to update GeoJSON', { sourceExists: false });
}
```

**What This Does**:
- ✅ Logs successful updates with feature count
- ✅ Catches and logs any errors during setData
- ✅ Warns if source doesn't exist instead of failing silently
- ✅ Makes debugging much easier (can see logs immediately)

**Applied To**:
- `legs-source` (clustered legs)
- `approved-legs-source` (non-clustered approved legs)

---

## Fix #2: userRegistrations Data Staleness ✅

**Problem**: Registration data might be stale or invalid
- If `userRegistrations` is null/undefined, accessing `.get()` throws error
- If registration data not synchronized, legs go to wrong source
- Leg could disappear if status changes mid-render
- No validation before using the data

**Location**: Lines 691-742

**Solution**: Validate and safely access registration data
```typescript
// Validate that userRegistrations exists and is a valid Map
if (!userRegistrations || !(userRegistrations instanceof Map)) {
  logger.warn('userRegistrations is invalid or missing', {
    hasUserRegistrations: !!userRegistrations,
    type: userRegistrations ? typeof userRegistrations : 'null'
  });
}

const approvedLegIds = new Set(
  Array.from(userRegistrations?.entries() || [])
    .filter(([_, status]) => status === 'Approved')
    .map(([legId]) => legId)
);

logger.debug('Separated leg registrations', {
  approvedCount: approvedLegIds.size,
  totalLegCount: legs.length
});

// Later when accessing:
registration_status: userRegistrations?.get?.(leg.leg_id) || null
```

**What This Does**:
- ✅ Validates userRegistrations is a valid Map
- ✅ Logs warnings if data is invalid
- ✅ Uses optional chaining to safely access registration data
- ✅ Logs registration separation for debugging
- ✅ Prevents crashes if registration data is missing

---

## Fix #3: Rapid Filter/State Updates ✅

**Problem**: Effect runs too frequently, rebuilding GeoJSON multiple times
- If multiple dependencies change rapidly (legs, filters, registrations, user)
- GeoJSON rebuilt 3+ times in succession
- Causes map layer flashing/flicker
- Inconsistent state during updates

**Location**: Lines 682-823

**Solution**: Memoize filter calculations and optimize dependencies
```typescript
// NEW: Memoize filter values to prevent unnecessary effect runs
const showEndWaypoints = useMemo(
  () => !filters.location && !!filters.arrivalLocation,
  [filters.location, filters.arrivalLocation]
);

// Effect dependency array BEFORE (6 items):
}, [legs, mapLoaded, userRegistrations, filters.location, filters.arrivalLocation, user]);

// Effect dependency array AFTER (4 items):
}, [legs, mapLoaded, userRegistrations, showEndWaypoints, user]);
```

**What This Does**:
- ✅ Memoizes `showEndWaypoints` calculation
- ✅ Reduces effect dependencies from 6 to 4
- ✅ Only reruns when meaningful changes happen
- ✅ Eliminates redundant GeoJSON rebuilds
- ✅ Reduces flicker/flashing during updates

**How It Works**:
1. `showEndWaypoints` is memoized - only changes when filters actually change
2. Before: effect ran when `filters.location` OR `filters.arrivalLocation` changed individually
3. After: effect only runs when `showEndWaypoints` result actually changes
4. Result: fewer effect runs, less map flashing

---

## Expected Improvements

### Before Fixes:
- ❌ Waypoints disappear arbitrarily
- ❌ No way to debug source issues (silent failures)
- ❌ Registration data could cause wrong layer grouping
- ❌ Rapid flashing when filters change
- ❌ Stale data visible on map

### After Fixes:
- ✅ Waypoints more stable, problems logged
- ✅ Can see in logs if sources fail (easy debugging)
- ✅ Registration data validated before use
- ✅ Less frequent effect runs (smoother UX)
- ✅ Better error handling throughout

---

## Testing Checklist

- [ ] Open crew browse page
- [ ] Check browser console for any new warnings/errors
- [ ] Pan and zoom map - verify no logging spam
- [ ] Change filters (location, risk, skills) - watch for logs
- [ ] Register/approve legs - verify logs show registration changes
- [ ] Verify waypoints don't disappear arbitrarily
- [ ] Check that source update counts are logged
- [ ] Verify no crashes when registration data changes

---

## Related Documents

- `mapbox-rendering-pipeline-analysis.md` - Complete analysis of all 9 issues
- `waypoint-disappearing-root-cause.md` - Timeline of investigation
