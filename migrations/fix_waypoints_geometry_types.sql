-- Fix geometry type issues in waypoint operations
-- This migration updates the RPC function and trigger to properly handle geometry types

-- Update the insert function to be more explicit about geometry types
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
  point_geom geometry(Point, 4326);
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
    
    -- Create point geometry explicitly
    point_geom := ST_SetSRID(ST_MakePoint(lng_val, lat_val), 4326)::geometry(Point, 4326);
    
    -- Insert waypoint with PostGIS geometry
    INSERT INTO public.waypoints (leg_id, index, name, location)
    VALUES (
      leg_id_param,
      index_val,
      NULLIF(name_val, ''),
      point_geom
    );
  END LOOP;
  
  -- Bounding box will be automatically updated by trigger
END;
$$;

-- Update the trigger function to handle single points correctly
CREATE OR REPLACE FUNCTION update_leg_bbox()
RETURNS TRIGGER AS $$
DECLARE
  waypoint_count integer;
  bbox_geom geometry(Polygon, 4326);
  single_point geometry(Point, 4326);
BEGIN
  -- Count waypoints for this leg
  SELECT COUNT(*) INTO waypoint_count
  FROM public.waypoints
  WHERE leg_id = COALESCE(NEW.leg_id, OLD.leg_id);
  
  -- Only update bbox if we have waypoints
  IF waypoint_count >= 2 THEN
    -- Create bounding box from all waypoints (envelope of multiple points creates a polygon)
    SELECT ST_Envelope(ST_Collect(location))::geometry(Polygon, 4326)
    INTO bbox_geom
    FROM public.waypoints
    WHERE leg_id = COALESCE(NEW.leg_id, OLD.leg_id);
    
    -- Update the bounding box
    UPDATE public.legs
    SET bbox = bbox_geom
    WHERE id = COALESCE(NEW.leg_id, OLD.leg_id);
  ELSIF waypoint_count = 1 THEN
    -- For a single point, create a small square buffer around it to make a valid polygon
    SELECT location INTO single_point
    FROM public.waypoints
    WHERE leg_id = COALESCE(NEW.leg_id, OLD.leg_id)
    LIMIT 1;
    
    -- Create a small bounding box around the point (0.01 degrees ≈ 1km)
    bbox_geom := ST_MakeEnvelope(
      ST_X(single_point) - 0.01,
      ST_Y(single_point) - 0.01,
      ST_X(single_point) + 0.01,
      ST_Y(single_point) + 0.01,
      4326
    )::geometry(Polygon, 4326);
    
    UPDATE public.legs
    SET bbox = bbox_geom
    WHERE id = COALESCE(NEW.leg_id, OLD.leg_id);
  ELSE
    -- No waypoints, set bbox to NULL
    UPDATE public.legs
    SET bbox = NULL
    WHERE id = COALESCE(NEW.leg_id, OLD.leg_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION insert_leg_waypoints IS 'Inserts waypoints for a leg using PostGIS ST_MakePoint. Fixed geometry type casting.';
COMMENT ON FUNCTION update_leg_bbox IS 'Automatically updates the bounding box (bbox) column in legs table when waypoints are modified. Handles single points correctly.';
