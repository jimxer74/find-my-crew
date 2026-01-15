-- Complete fix for journeys RLS policies (both INSERT and SELECT)
-- This fixes both the journey creation and reading issues
-- 
-- SOLUTION: Use a security definer function to check boat ownership
-- This bypasses RLS issues when checking boat ownership in subqueries

-- ============================================================================
-- STEP 1: Ensure boats table SELECT policy explicitly allows authenticated role
-- This is CRITICAL for any subqueries to work
-- ============================================================================
DROP POLICY IF EXISTS "Boats are accessible to all" ON public.boats;

CREATE POLICY "Boats are accessible to all"
ON public.boats FOR SELECT
TO authenticated, anon, public
USING (true);

-- ============================================================================
-- STEP 2: Create helper function to check boat ownership
-- Using SECURITY DEFINER to bypass RLS when checking boat ownership
-- IMPORTANT: Run this in Supabase SQL Editor (requires superuser privileges)
-- ============================================================================
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

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.check_boat_ownership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_boat_ownership(uuid) TO anon;

-- ============================================================================
-- STEP 3: Fix INSERT policy for journeys
-- ============================================================================
DROP POLICY IF EXISTS "Owners can insert journeys for their boats" ON public.journeys;

CREATE POLICY "Owners can insert journeys for their boats"
ON public.journeys
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND journeys.boat_id IS NOT NULL
  AND public.check_boat_ownership(journeys.boat_id)
);

-- ============================================================================
-- STEP 4: Fix SELECT policy for journeys
-- ============================================================================
DROP POLICY IF EXISTS "Published journeys are viewable by all" ON public.journeys;

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

-- ============================================================================
-- TEST QUERIES (run these manually to verify everything works)
-- ============================================================================
-- Test function:
-- SELECT public.check_boat_ownership('06638e5a-5eba-4aa5-b9b6-6e152512ab42'::uuid);
-- Should return true if boat belongs to authenticated user

-- Test SELECT policy (should return journeys):
-- SELECT * FROM journeys WHERE state = 'Published';
-- SELECT * FROM journeys; -- Should return user's journeys even if not published
