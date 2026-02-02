-- ============================================================================
-- Migration: Add find_legs_by_location RPC function
-- Description: Stored procedure for efficient location-based leg searching
--              Used by AI assistant's search_legs_by_location tool
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.find_legs_by_location(
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
);

-- Create the function to find legs by departure and/or arrival location
CREATE OR REPLACE FUNCTION public.find_legs_by_location(
  departure_min_lng double precision DEFAULT NULL,
  departure_min_lat double precision DEFAULT NULL,
  departure_max_lng double precision DEFAULT NULL,
  departure_max_lat double precision DEFAULT NULL,
  arrival_min_lng double precision DEFAULT NULL,
  arrival_min_lat double precision DEFAULT NULL,
  arrival_max_lng double precision DEFAULT NULL,
  arrival_max_lat double precision DEFAULT NULL
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT l.id
  FROM legs l
  INNER JOIN journeys j ON j.id = l.journey_id
  WHERE j.state = 'Published'::journey_state
    -- Departure location filter (start waypoint with index = 0)
    AND (
      -- If no departure bbox specified, skip this filter
      (departure_min_lng IS NULL OR departure_min_lat IS NULL OR
       departure_max_lng IS NULL OR departure_max_lat IS NULL)
      OR
      EXISTS (
        SELECT 1 FROM waypoints w
        WHERE w.leg_id = l.id
        AND w.index = 0
        AND ST_Within(
          w.location,
          ST_MakeEnvelope(departure_min_lng, departure_min_lat, departure_max_lng, departure_max_lat, 4326)
        )
      )
    )
    -- Arrival location filter (end waypoint with max index)
    AND (
      -- If no arrival bbox specified, skip this filter
      (arrival_min_lng IS NULL OR arrival_min_lat IS NULL OR
       arrival_max_lng IS NULL OR arrival_max_lat IS NULL)
      OR
      EXISTS (
        SELECT 1 FROM waypoints w
        WHERE w.leg_id = l.id
        AND w.index = (SELECT MAX(w2.index) FROM waypoints w2 WHERE w2.leg_id = l.id)
        AND ST_Within(
          w.location,
          ST_MakeEnvelope(arrival_min_lng, arrival_min_lat, arrival_max_lng, arrival_max_lat, 4326)
        )
      )
    )
  LIMIT 100;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_legs_by_location(
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.find_legs_by_location IS
'Find leg IDs by departure and/or arrival location using PostGIS spatial queries.
Parameters:
  - departure_min_lng, departure_min_lat, departure_max_lng, departure_max_lat: Bounding box for departure location (start waypoint)
  - arrival_min_lng, arrival_min_lat, arrival_max_lng, arrival_max_lat: Bounding box for arrival location (end waypoint)

Both bounding boxes are optional. If departure bbox is not provided, only arrival is filtered (and vice versa).
Returns leg IDs where:
  - Start waypoint (index=0) is within departure bbox (if specified)
  - End waypoint (max index) is within arrival bbox (if specified)
Limited to 100 results.';
