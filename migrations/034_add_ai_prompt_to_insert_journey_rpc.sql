-- Migration: Add ai_prompt and is_ai_generated to insert_journey_with_risk RPC
-- Purpose: Save the AI prompt used to generate journeys for debugging, reproducibility, and analytics
-- When journeys are created via AI chat (generate_journey_route or create_journey tools), 
-- the full prompt (system + conversation) will be saved to the journeys table

DROP FUNCTION IF EXISTS public.insert_journey_with_risk(
  uuid, text, text, date, date, text[], text[], integer, text, text, text
);

CREATE OR REPLACE FUNCTION public.insert_journey_with_risk(
  p_boat_id uuid,
  p_name text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_risk_level text[],
  p_skills text[],
  p_min_experience_level integer,
  p_cost_model text,
  p_cost_info text,
  p_state text DEFAULT 'In planning',
  p_ai_prompt text DEFAULT NULL,
  p_is_ai_generated boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journey_id uuid;
  v_owner_id uuid;
  v_risk_level risk_level;  -- scalar enum
BEGIN
  -- Verify boat ownership
  SELECT owner_id INTO v_owner_id FROM boats WHERE id = p_boat_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Boat not found: %', p_boat_id;
  END IF;
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this boat';
  END IF;

  -- Take first valid risk_level from array (column is scalar enum)
  SELECT (array_agg(r::risk_level))[1] INTO v_risk_level
  FROM unnest(COALESCE(p_risk_level, ARRAY[]::text[])) AS r
  WHERE r IN ('Coastal sailing', 'Offshore sailing', 'Extreme sailing');

  INSERT INTO journeys (
    boat_id, name, description, start_date, end_date,
    risk_level, skills, min_experience_level, cost_model, cost_info, state,
    ai_prompt, is_ai_generated
  )
  VALUES (
    p_boat_id, p_name, p_description, p_start_date, p_end_date,
    v_risk_level,
    COALESCE(p_skills, '{}'),
    COALESCE(p_min_experience_level, 1),
    COALESCE(p_cost_model, 'Not defined')::cost_model,
    p_cost_info,
    COALESCE(p_state, 'In planning')::journey_state,
    p_ai_prompt,
    p_is_ai_generated
  )
  RETURNING id INTO v_journey_id;

  RETURN v_journey_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_journey_with_risk(
  uuid, text, text, date, date, text[], text[], integer, text, text, text, text, boolean
) TO authenticated;

COMMENT ON FUNCTION public.insert_journey_with_risk IS
'Inserts a journey with risk_level as text[] (cast to risk_level[] in SQL).
Bypasses PostgREST enum[] serialization issues.
Now includes ai_prompt and is_ai_generated fields for AI-generated journeys.
Authorization: Caller must own the boat.';
