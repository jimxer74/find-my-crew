-- Create function to automatically update legs.bbox when waypoints change
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

-- Create trigger for INSERT
CREATE TRIGGER waypoints_insert_bbox_update
  AFTER INSERT ON public.waypoints
  FOR EACH ROW
  EXECUTE FUNCTION update_leg_bbox();

-- Create trigger for UPDATE
CREATE TRIGGER waypoints_update_bbox_update
  AFTER UPDATE ON public.waypoints
  FOR EACH ROW
  WHEN (OLD.location IS DISTINCT FROM NEW.location)
  EXECUTE FUNCTION update_leg_bbox();

-- Create trigger for DELETE
CREATE TRIGGER waypoints_delete_bbox_update
  AFTER DELETE ON public.waypoints
  FOR EACH ROW
  EXECUTE FUNCTION update_leg_bbox();

-- Add comment
COMMENT ON FUNCTION update_leg_bbox() IS 'Automatically updates the bounding box (bbox) column in legs table when waypoints are modified';
