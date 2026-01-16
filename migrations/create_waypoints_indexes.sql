-- Create spatial indexes for waypoints table

-- GIST index on location for fast spatial queries (viewport filtering, distance queries, etc.)
CREATE INDEX IF NOT EXISTS waypoints_location_idx 
  ON public.waypoints 
  USING GIST (location);

-- Index on leg_id for fast joins with legs table
CREATE INDEX IF NOT EXISTS waypoints_leg_id_idx 
  ON public.waypoints (leg_id);

-- Composite index on (leg_id, index) for ordered retrieval of waypoints per leg
CREATE INDEX IF NOT EXISTS waypoints_leg_id_index_idx 
  ON public.waypoints (leg_id, index);

-- Add comment
COMMENT ON INDEX waypoints_location_idx IS 'GIST spatial index for efficient geospatial queries on waypoint locations';
