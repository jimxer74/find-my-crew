-- Migration: Create insert_leg_waypoints RPC function
-- This function inserts waypoints with PostGIS geometry conversion
-- Uses SECURITY DEFINER to bypass RLS for atomic leg+waypoints creation

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.insert_leg_waypoints(UUID, JSONB);

-- Create the RPC function
CREATE OR REPLACE FUNCTION public.insert_leg_waypoints(
  leg_id_param UUID,
  waypoints_param JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with owner privileges to bypass RLS during atomic operations
SET search_path = public
AS $$
DECLARE
  waypoint JSONB;
  waypoint_index INTEGER;
  waypoint_name TEXT;
  waypoint_lng NUMERIC;
  waypoint_lat NUMERIC;
  boat_owner_id UUID;
BEGIN
  -- Verify the leg exists and the caller owns the boat (authorization check)
  SELECT boats.owner_id INTO boat_owner_id
  FROM legs
  JOIN journeys ON journeys.id = legs.journey_id
  JOIN boats ON boats.id = journeys.boat_id
  WHERE legs.id = leg_id_param;

  IF boat_owner_id IS NULL THEN
    RAISE EXCEPTION 'Leg not found: %', leg_id_param;
  END IF;

  IF boat_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this leg''s boat';
  END IF;

  -- Delete existing waypoints for this leg (for updates)
  DELETE FROM waypoints WHERE leg_id = leg_id_param;

  -- Insert each waypoint
  FOR waypoint IN SELECT * FROM jsonb_array_elements(waypoints_param)
  LOOP
    waypoint_index := (waypoint->>'index')::INTEGER;
    waypoint_name := waypoint->>'name';
    waypoint_lng := (waypoint->>'lng')::NUMERIC;
    waypoint_lat := (waypoint->>'lat')::NUMERIC;

    INSERT INTO waypoints (leg_id, index, name, location)
    VALUES (
      leg_id_param,
      waypoint_index,
      waypoint_name,
      ST_SetSRID(ST_MakePoint(waypoint_lng, waypoint_lat), 4326)
    );
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_leg_waypoints(UUID, JSONB) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.insert_leg_waypoints IS
'Inserts waypoints for a leg with PostGIS geometry conversion.
Parameters:
  - leg_id_param: UUID of the leg
  - waypoints_param: JSONB array of {index, name, lng, lat}
Authorization: Caller must own the boat associated with the leg.';
