-- ============================================================================
-- Migration: Add departure/arrival location filters to get_legs_in_viewport
-- Description: Extends the get_legs_in_viewport RPC function to support filtering
--              by departure and arrival locations using bounding boxes
-- ============================================================================

-- Drop the existing function first (with old parameter signature)
DROP FUNCTION IF EXISTS public.get_legs_in_viewport(double precision, double precision, double precision, double precision, date, date, risk_level[], text[], integer);

-- Create the updated function with location filter parameters
CREATE OR REPLACE FUNCTION public.get_legs_in_viewport(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  start_date_filter date DEFAULT NULL,
  end_date_filter date DEFAULT NULL,
  risk_levels_filter risk_level[] DEFAULT NULL,
  skills_filter text[] DEFAULT NULL,
  min_experience_level_filter integer DEFAULT NULL,
  -- New: Departure location bounding box (filters start waypoint)
  departure_min_lng double precision DEFAULT NULL,
  departure_min_lat double precision DEFAULT NULL,
  departure_max_lng double precision DEFAULT NULL,
  departure_max_lat double precision DEFAULT NULL,
  -- New: Arrival location bounding box (filters end waypoint)
  arrival_min_lng double precision DEFAULT NULL,
  arrival_min_lat double precision DEFAULT NULL,
  arrival_max_lng double precision DEFAULT NULL,
  arrival_max_lat double precision DEFAULT NULL
)
RETURNS TABLE (
  leg_id uuid,
  leg_name text,
  leg_description text,
  journey_id uuid,
  journey_name text,
  start_date timestamptz,
  end_date timestamptz,
  crew_needed integer,
  leg_risk_level risk_level,
  journey_risk_level risk_level[],
  cost_model cost_model,
  journey_images text[],
  skills text[],
  boat_id uuid,
  boat_name text,
  boat_type sailboat_category,
  boat_image_url text,
  boat_average_speed_knots numeric,
  boat_make_model text,
  owner_name text,
  owner_image_url text,
  min_experience_level integer,
  start_waypoint jsonb,
  end_waypoint jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS leg_id,
    l.name AS leg_name,
    l.description AS leg_description,
    j.id AS journey_id,
    j.name AS journey_name,
    l.start_date,
    l.end_date,
    l.crew_needed,
    l.risk_level AS leg_risk_level,
    -- Convert scalar journey.risk_level to array for consistent API
    CASE WHEN j.risk_level IS NULL THEN NULL ELSE ARRAY[j.risk_level] END AS journey_risk_level,
    -- Include cost_model from journey
    j.cost_model,
    -- Include journey images
    j.images AS journey_images,
    -- Combine journey skills and leg-specific skills (remove duplicates)
    (
      SELECT array_agg(DISTINCT skill)
      FROM (
        SELECT unnest(j.skills) AS skill
        UNION
        SELECT unnest(l.skills) AS skill
      ) combined_skills
      WHERE skill IS NOT NULL AND skill != ''
    ) AS skills,
    b.id AS boat_id,
    b.name AS boat_name,
    b.type AS boat_type,
    -- Get first image from images array, or NULL if array is empty
    CASE
      WHEN array_length(b.images, 1) > 0 THEN b.images[1]
      ELSE NULL
    END AS boat_image_url,
    b.average_speed_knots AS boat_average_speed_knots,
    b.make_model AS boat_make_model,
    -- Get owner name and image from profiles
    p.full_name AS owner_name,
    p.profile_image_url AS owner_image_url,
    -- Get minimum required experience level: use leg's if set, otherwise journey's
    COALESCE(l.min_experience_level, j.min_experience_level) AS min_experience_level,
    -- Start waypoint (index = 0) with name and coordinates
    (
      SELECT jsonb_build_object(
        'coordinates', (ST_AsGeoJSON(w_start.location)::jsonb->'coordinates'),
        'name', COALESCE(w_start.name, '')
      )
      FROM public.waypoints w_start
      WHERE w_start.leg_id = l.id
        AND w_start.index = 0
      LIMIT 1
    ) AS start_waypoint,
    -- End waypoint (highest index) with name and coordinates
    (
      SELECT jsonb_build_object(
        'coordinates', (ST_AsGeoJSON(w_end.location)::jsonb->'coordinates'),
        'name', COALESCE(w_end.name, '')
      )
      FROM public.waypoints w_end
      WHERE w_end.leg_id = l.id
        AND w_end.index = (
          SELECT MAX(w_max.index)
          FROM public.waypoints w_max
          WHERE w_max.leg_id = l.id
        )
      LIMIT 1
    ) AS end_waypoint
  FROM public.legs l
  INNER JOIN public.journeys j ON j.id = l.journey_id
  INNER JOIN public.boats b ON b.id = j.boat_id
  LEFT JOIN public.profiles p ON p.id = b.owner_id
  WHERE
    -- Only show published journeys
    j.state = 'Published'::journey_state
    -- Viewport filtering using PostGIS bbox (fast spatial query)
    AND l.bbox IS NOT NULL
    AND l.bbox && ST_MakeEnvelope(
      min_lng, min_lat,
      max_lng, max_lat,
      4326
    )::geometry(Polygon, 4326)
    -- Optional date filters
    AND (start_date_filter IS NULL OR l.start_date::date >= start_date_filter)
    AND (end_date_filter IS NULL OR l.end_date::date <= end_date_filter)
    -- Optional risk level filter (multi-select filter with complex logic)
    AND (
      risk_levels_filter IS NULL
      OR risk_levels_filter = ARRAY[]::risk_level[]
      OR (
        -- Case 1: Leg has risk_level defined
        (l.risk_level IS NOT NULL AND l.risk_level = ANY(risk_levels_filter))
        OR
        -- Case 2: Leg doesn't have risk_level, check journey
        (
          l.risk_level IS NULL
          AND (
            j.risk_level IS NULL
            OR j.risk_level = ANY(risk_levels_filter)
          )
        )
      )
    )
    -- Optional skills filter
    AND (
      skills_filter IS NULL
      OR skills_filter = ARRAY[]::text[]
      OR (
        SELECT bool_and(
          skill_filter = ANY(
            COALESCE(
              (
                SELECT array_agg(DISTINCT skill)
                FROM (
                  SELECT unnest(j.skills) AS skill
                  UNION
                  SELECT unnest(l.skills) AS skill
                ) combined_skills
                WHERE skill IS NOT NULL AND skill != ''
              ),
              ARRAY[]::text[]
            )
          )
        )
        FROM unnest(skills_filter) AS skill_filter
      )
    )
    -- Optional experience level filter
    AND (
      min_experience_level_filter IS NULL
      OR COALESCE(l.min_experience_level, j.min_experience_level) IS NULL
      OR COALESCE(l.min_experience_level, j.min_experience_level) <= min_experience_level_filter
    )
    -- NEW: Departure location filter (start waypoint with index = 0)
    AND (
      -- If any departure bbox param is NULL, skip this filter
      (departure_min_lng IS NULL OR departure_min_lat IS NULL OR
       departure_max_lng IS NULL OR departure_max_lat IS NULL)
      OR
      EXISTS (
        SELECT 1 FROM public.waypoints w
        WHERE w.leg_id = l.id
        AND w.index = 0
        AND ST_Within(
          w.location,
          ST_MakeEnvelope(departure_min_lng, departure_min_lat, departure_max_lng, departure_max_lat, 4326)
        )
      )
    )
    -- NEW: Arrival location filter (end waypoint with max index)
    AND (
      -- If any arrival bbox param is NULL, skip this filter
      (arrival_min_lng IS NULL OR arrival_min_lat IS NULL OR
       arrival_max_lng IS NULL OR arrival_max_lat IS NULL)
      OR
      EXISTS (
        SELECT 1 FROM public.waypoints w
        WHERE w.leg_id = l.id
        AND w.index = (SELECT MAX(w2.index) FROM public.waypoints w2 WHERE w2.leg_id = l.id)
        AND ST_Within(
          w.location,
          ST_MakeEnvelope(arrival_min_lng, arrival_min_lat, arrival_max_lng, arrival_max_lat, 4326)
        )
      )
    )
  ORDER BY l.start_date ASC NULLS LAST, l.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_legs_in_viewport(
  double precision, double precision, double precision, double precision,
  date, date, risk_level[], text[], integer,
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_legs_in_viewport(
  double precision, double precision, double precision, double precision,
  date, date, risk_level[], text[], integer,
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_legs_in_viewport IS
'Get legs within a viewport with optional filters for crew browsing.
Parameters:
  - min_lng, min_lat, max_lng, max_lat: Viewport bounding box (required)
  - start_date_filter, end_date_filter: Optional date range filter
  - risk_levels_filter: Optional array of risk levels to filter by
  - skills_filter: Optional array of required skills
  - min_experience_level_filter: Optional user experience level for matching
  - departure_min_lng, departure_min_lat, departure_max_lng, departure_max_lat:
      Optional bounding box for departure location (filters start waypoint)
  - arrival_min_lng, arrival_min_lat, arrival_max_lng, arrival_max_lat:
      Optional bounding box for arrival location (filters end waypoint)

Returns legs where:
  - Leg bbox intersects the viewport
  - Optional filters are satisfied
  - Start waypoint is within departure bbox (if specified)
  - End waypoint is within arrival bbox (if specified)';
