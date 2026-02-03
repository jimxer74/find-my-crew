-- Migration: Add cost_model to get_legs_in_viewport function
-- This adds the cost_model field to the viewport query results

-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS public.get_legs_in_viewport(double precision, double precision, double precision, double precision, date, date, risk_level[], text[], integer);

-- Create the function with the updated return type
CREATE FUNCTION public.get_legs_in_viewport(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  start_date_filter date DEFAULT NULL,
  end_date_filter date DEFAULT NULL,
  risk_levels_filter risk_level[] DEFAULT NULL,
  skills_filter text[] DEFAULT NULL,
  min_experience_level_filter integer DEFAULT NULL
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
  boat_make text,
  boat_model text,
  owner_name text,
  owner_image_url text,
  min_experience_level integer,
  start_waypoint jsonb,
  end_waypoint jsonb
)
LANGUAGE plpgsql
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
    -- Add cost_model from journey
    j.cost_model,
    -- Add journey images
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
    b.make AS boat_make,
    b.model AS boat_model,
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
    -- Logic:
    -- 1. If leg has risk_level defined:
    --    - If leg's risk_level matches any selected filter → include
    --    - If leg's risk_level doesn't match any selected filter → exclude
    -- 2. If leg doesn't have risk_level defined:
    --    - Check journey's risk_level array
    --    - If journey's risk_level array contains any selected filter → include
    --    - If journey's risk_level array doesn't contain any selected filter → exclude
    --    - If journey's risk_level is null or empty → include (no restriction)
    AND (
      risk_levels_filter IS NULL
      OR risk_levels_filter = ARRAY[]::risk_level[]
      OR (
        -- Case 1: Leg has risk_level defined
        (l.risk_level IS NOT NULL AND l.risk_level = ANY(risk_levels_filter))
        OR
        -- Case 2: Leg doesn't have risk_level, check journey
        -- Note: journey.risk_level is a scalar enum (not array), so compare directly
        (
          l.risk_level IS NULL
          AND (
            -- Journey has no risk_level restriction (null) → include
            -- OR Journey has risk_level and it matches any selected filter → include
            j.risk_level IS NULL
            OR j.risk_level = ANY(risk_levels_filter)
          )
        )
      )
    )
    -- Optional skills filter (combined skills must contain all requested skills)
    -- If skills_filter is NULL or empty array: no filtering (returns all legs)
    -- If skills_filter has values: only returns legs where ALL filter skills are present
    -- Note: Legs with no skills are excluded when a skills filter is provided (desired behavior)
    AND (
      skills_filter IS NULL
      OR skills_filter = ARRAY[]::text[]
      OR (
        -- Check if all skills in filter are present in combined skills
        -- COALESCE ensures we have an array (empty if no skills) instead of NULL
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
              ARRAY[]::text[]  -- Use empty array if leg has no skills
            )
          )
        )
        FROM unnest(skills_filter) AS skill_filter
      )
    )
    -- Optional experience level filter
    -- If min_experience_level_filter is NULL: no filtering (returns all legs)
    -- If min_experience_level_filter is provided: only returns legs where user's experience level >= leg's or journey's min_experience_level
    -- Logic: Use leg's min_experience_level if set, otherwise use journey's min_experience_level
    -- User qualifies if: user_experience_level >= effective_min_experience_level
    AND (
      min_experience_level_filter IS NULL
      OR COALESCE(l.min_experience_level, j.min_experience_level) IS NULL
      OR COALESCE(l.min_experience_level, j.min_experience_level) <= min_experience_level_filter
    )
  ORDER BY l.start_date ASC NULLS LAST, l.created_at DESC;
END;
$$;