-- Create normalized waypoints table with PostGIS geometry support
CREATE TABLE IF NOT EXISTS public.waypoints (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id       uuid NOT NULL REFERENCES public.legs (id) ON DELETE CASCADE,
  index        integer NOT NULL,  -- Order within leg (0 = start, 1+ = waypoints, last = end)
  name         text,  -- Location name
  location     geometry(Point, 4326) NOT NULL,  -- PostGIS geometry (lng, lat) in WGS84
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waypoints_leg_index_unique UNIQUE (leg_id, index)
);

-- Add comment
COMMENT ON TABLE public.waypoints IS 'Waypoints for journey legs, stored as PostGIS geometry for efficient spatial queries';
COMMENT ON COLUMN public.waypoints.location IS 'PostGIS Point geometry in WGS84 (SRID 4326). Coordinates are stored as [lng, lat]';
COMMENT ON COLUMN public.waypoints.index IS 'Order of waypoint within leg: 0 = start, 1+ = intermediate waypoints, last = end';
