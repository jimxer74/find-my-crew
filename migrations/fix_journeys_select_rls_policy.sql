-- Fix RLS policy for journeys SELECT to ensure it works correctly
-- The policy allows viewing published journeys and journeys for boats owned by the user
-- 
-- SOLUTION: Use the same check_boat_ownership function to avoid RLS subquery issues

-- First, ensure the check_boat_ownership function exists (from fix_journeys_insert_rls_policy.sql)
-- If it doesn't exist, create it:
CREATE OR REPLACE FUNCTION public.check_boat_ownership(boat_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  boat_owner_id uuid;
BEGIN
  -- Directly query boats table (bypasses RLS due to SECURITY DEFINER)
  SELECT owner_id INTO boat_owner_id
  FROM public.boats
  WHERE id = boat_id_param;
  
  -- Return true if boat exists and belongs to authenticated user
  RETURN boat_owner_id IS NOT NULL AND boat_owner_id = auth.uid();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_boat_ownership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_boat_ownership(uuid) TO anon;

-- Ensure boats table SELECT policy explicitly allows authenticated role
DROP POLICY IF EXISTS "Boats are accessible to all" ON public.boats;

CREATE POLICY "Boats are accessible to all"
ON public.boats FOR SELECT
TO authenticated, anon, public
USING (true);

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Published journeys are viewable by all" ON public.journeys;

-- Recreate SELECT policy using the helper function
-- This avoids RLS issues with subqueries
CREATE POLICY "Published journeys are viewable by all"
ON public.journeys
FOR SELECT
USING (
  state = 'Published'::journey_state
  OR (
    auth.uid() IS NOT NULL
    AND journeys.boat_id IS NOT NULL
    AND public.check_boat_ownership(journeys.boat_id)
  )
);
