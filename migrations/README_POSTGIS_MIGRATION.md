# PostGIS Geospatial Migration - Phase 1

This directory contains the migration files for implementing PostGIS-based geospatial waypoint management.

## Execution Order

Execute these migrations in the following order:

1. **enable_postgis.sql** - Enable PostGIS extension
2. **create_waypoints_table.sql** - Create normalized waypoints table
3. **create_waypoints_indexes.sql** - Create spatial indexes on waypoints
4. **add_legs_bbox.sql** - Add bounding box column to legs table
5. **create_bbox_update_trigger.sql** - Create trigger to auto-update bbox
6. **remove_legs_waypoints_jsonb.sql** - Remove old JSONB column (only if database is empty)

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
```

## Next Steps

After Phase 1 is complete:
- Phase 2: Update application code to write to new waypoints table
- Phase 3: Create API endpoints for viewport queries
- Phase 4: Update read operations in owner interface
