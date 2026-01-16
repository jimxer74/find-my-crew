# PostGIS Geospatial Migration - Phase 1

This directory contains the migration files for implementing PostGIS-based geospatial waypoint management.

## Execution Order

Execute these migrations in the following order:

1. **enable_postgis.sql** - Enable PostGIS extension
2. **create_waypoints_table.sql** - Create normalized waypoints table
3. **create_waypoints_indexes.sql** - Create spatial indexes on waypoints
4. **add_legs_bbox.sql** - Add bounding box column to legs table
5. **create_bbox_update_trigger.sql** - Create trigger to auto-update bbox
6. **create_waypoints_rpc_functions.sql** - Create RPC functions for waypoint operations
7. **fix_waypoints_geometry_types.sql** - Fix geometry type issues (run if you encounter geometry type errors)
8. **remove_legs_waypoints_jsonb.sql** - Remove old JSONB column (only if database is empty)

## Important Notes

- **Database must be empty** or all waypoint data migrated before running `remove_legs_waypoints_jsonb.sql`
- PostGIS extension requires superuser privileges (usually handled by Supabase)
- All geometry uses **SRID 4326** (WGS84) - standard for web maps
- Coordinates are stored as **[lng, lat]** format (longitude first, then latitude)

## Verification

After running migrations, verify with:

```sql
-- Check PostGIS version
SELECT PostGIS_version();

-- Check waypoints table exists
SELECT * FROM information_schema.tables WHERE table_name = 'waypoints';

-- Check indexes exist
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'waypoints';

-- Check bbox column exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'legs' AND column_name = 'bbox';

-- Check RPC functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('insert_leg_waypoints', 'get_leg_waypoints');

-- Test RPC function (after creating a leg with waypoints)
-- SELECT * FROM get_leg_waypoints('your-leg-id-here');
```

## Migration Phases

### Phase 1: Database Schema & PostGIS Setup ✅
- Enable PostGIS extension
- Create normalized waypoints table
- Create spatial indexes
- Add bounding box column to legs
- Create trigger for automatic bbox updates
- Create RPC functions for waypoint operations

### Phase 2: Update Write Operations ✅
- Update `LegFormModal.tsx` to write waypoints using RPC function
- Update `app/owner/journeys/[journeyId]/legs/page.tsx` to write waypoints using RPC function
- Update `AIGenerateJourneyModal.tsx` to write waypoints using RPC function
- Create helper functions for PostGIS conversions

### Phase 3: Create API Endpoints for Viewport Queries (Future)
- Create API endpoints for efficient geospatial queries
- Implement viewport-based filtering for crew browsing interface

### Phase 4: Update Read Operations ✅
- Update `LegFormModal.tsx` to read waypoints from new table (completed in Phase 2)
- Update `app/owner/journeys/[journeyId]/legs/page.tsx` to read waypoints from new table (completed in Phase 2)
- Update `AIGenerateJourneyModal.tsx` to write waypoints using RPC function (completed in Phase 2)
- All owner interface read operations now use PostGIS waypoints table

## Notes

- `BrowseJourneys.tsx` is intentionally not refactored as it will be decommissioned
- All waypoint operations now use PostGIS-native storage for optimal geospatial query performance
