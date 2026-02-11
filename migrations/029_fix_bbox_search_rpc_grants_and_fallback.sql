-- ============================================================================
-- Migration: Fix bbox search - RPC grants and fallback
-- Description: 
--   1. Grant find_legs_by_location to anon and service_role (unauthenticated prospect chat)
--   2. Add get_waypoints_coords_for_bbox_search RPC for fallback when direct select returns EWKB
-- ============================================================================

-- Grant find_legs_by_location to anon and service_role for unauthenticated prospect chat
GRANT EXECUTE ON FUNCTION public.find_legs_by_location(
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
) TO anon;

GRANT EXECUTE ON FUNCTION public.find_legs_by_location(
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
) TO service_role;

-- Create RPC for fallback: returns waypoint coordinates for published legs
-- Used when find_legs_by_location fails and we need to filter in JS
-- Returns GeoJSON coordinates so JS can parse without EWKB handling
DROP FUNCTION IF EXISTS public.get_waypoints_coords_for_bbox_search();

CREATE OR REPLACE FUNCTION public.get_waypoints_coords_for_bbox_search()
RETURNS TABLE (
  leg_id uuid,
  waypoint_index integer,
  lng double precision,
  lat double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    w.leg_id,
    w.index AS waypoint_index,
    (ST_AsGeoJSON(w.location)::json->'coordinates'->>0)::double precision AS lng,
    (ST_AsGeoJSON(w.location)::json->'coordinates'->>1)::double precision AS lat
  FROM waypoints w
  INNER JOIN legs l ON l.id = w.leg_id
  INNER JOIN journeys j ON j.id = l.journey_id
  WHERE j.state = 'Published'::journey_state
  ORDER BY w.leg_id, w.index;
$$;

GRANT EXECUTE ON FUNCTION public.get_waypoints_coords_for_bbox_search() TO anon;
GRANT EXECUTE ON FUNCTION public.get_waypoints_coords_for_bbox_search() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_waypoints_coords_for_bbox_search() TO service_role;

COMMENT ON FUNCTION public.get_waypoints_coords_for_bbox_search IS
'Returns waypoint coordinates for published legs. Used by findLegsInBboxFallback when RPC find_legs_by_location is unavailable.';
