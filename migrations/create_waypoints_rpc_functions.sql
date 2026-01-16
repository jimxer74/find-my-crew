-- RPC Functions for waypoint operations with PostGIS support

-- Function to insert waypoints for a leg
-- This function handles PostGIS ST_MakePoint conversion
CREATE OR REPLACE FUNCTION insert_leg_waypoints(
  leg_id_param uuid,
  waypoints_param jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  waypoint jsonb;
  lng_val double precision;
  lat_val double precision;
  index_val integer;
  name_val text;
BEGIN
  -- Delete existing waypoints for this leg
  DELETE FROM public.waypoints WHERE leg_id = leg_id_param;
  
  -- Insert new waypoints
  FOR waypoint IN SELECT * FROM jsonb_array_elements(waypoints_param)
  LOOP
    lng_val := (waypoint->>'lng')::double precision;
    lat_val := (waypoint->>'lat')::double precision;
    index_val := (waypoint->>'index')::integer;
    name_val := waypoint->>'name';
    
    -- Insert waypoint with PostGIS geometry
    -- Explicitly cast to ensure correct geometry type
    INSERT INTO public.waypoints (leg_id, index, name, location)
    VALUES (
      leg_id_param,
      index_val,
      NULLIF(name_val, ''),
      ST_SetSRID(ST_MakePoint(lng_val, lat_val), 4326)::geometry(Point, 4326)
    );
  END LOOP;
  
  -- Bounding box will be automatically updated by trigger
END;
$$;

-- Function to get waypoints for a leg with GeoJSON format
CREATE OR REPLACE FUNCTION get_leg_waypoints(leg_id_param uuid)
RETURNS TABLE (
  index integer,
  name text,
  location jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.index,
    w.name,
    ST_AsGeoJSON(w.location)::jsonb as location
  FROM public.waypoints w
  WHERE w.leg_id = leg_id_param
  ORDER BY w.index ASC;
END;
$$;

-- Add comments
COMMENT ON FUNCTION insert_leg_waypoints IS 'Inserts waypoints for a leg using PostGIS ST_MakePoint. Automatically updates leg bbox via trigger.';
COMMENT ON FUNCTION get_leg_waypoints IS 'Returns waypoints for a leg in GeoJSON format for frontend consumption.';
