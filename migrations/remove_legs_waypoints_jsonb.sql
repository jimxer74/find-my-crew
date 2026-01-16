-- Remove old JSONB waypoints column from legs table
-- Note: This assumes the database is empty or all data has been migrated to the waypoints table

-- Drop the old GIN index on waypoints JSONB column
DROP INDEX IF EXISTS public.legs_waypoints_idx;

-- Remove the waypoints JSONB column
ALTER TABLE public.legs
DROP COLUMN IF EXISTS waypoints;

-- Add comment documenting the change
COMMENT ON TABLE public.legs IS 'Journey legs. Waypoints are now stored in the normalized waypoints table with PostGIS geometry support.';
