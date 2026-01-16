-- Create function to automatically update legs.bbox when waypoints change
CREATE OR REPLACE FUNCTION update_leg_bbox()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the bounding box for the leg when waypoints are inserted, updated, or deleted
  UPDATE public.legs
  SET bbox = (
    SELECT ST_Envelope(ST_Collect(location))
    FROM public.waypoints
    WHERE leg_id = COALESCE(NEW.leg_id, OLD.leg_id)
  )
  WHERE id = COALESCE(NEW.leg_id, OLD.leg_id);
  
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
