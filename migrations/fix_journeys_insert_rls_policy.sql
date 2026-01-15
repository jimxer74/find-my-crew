-- Fix RLS policy for journeys insert to ensure it works correctly
-- The policy checks that the boat exists and belongs to the authenticated user
-- 
-- SOLUTION: Use a security definer function to check boat ownership
-- This bypasses RLS issues when checking boat ownership in the subquery

-- STEP 1: First, ensure boats table SELECT policy explicitly allows authenticated role
-- This is CRITICAL for any subqueries to work
DROP POLICY IF EXISTS "Boats are accessible to all" ON public.boats;

CREATE POLICY "Boats are accessible to all"
ON public.boats FOR SELECT
TO authenticated, anon, public
USING (true);

-- STEP 2: Create a helper function that checks if a boat belongs to the authenticated user
-- Using SECURITY DEFINER to bypass RLS when checking boat ownership
-- IMPORTANT: In Supabase, this function must be created in the SQL Editor (not via migrations)
-- as it needs superuser privileges. The function runs with the privileges of the function creator.
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

-- STEP 3: Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Owners can insert journeys for their boats" ON public.journeys;

-- STEP 4: Recreate the insert policy using the helper function
-- This avoids RLS issues with subqueries
CREATE POLICY "Owners can insert journeys for their boats"
ON public.journeys
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND journeys.boat_id IS NOT NULL
  AND public.check_boat_ownership(journeys.boat_id)
);

-- TEST: To verify the function works, run this query manually:
-- SELECT public.check_boat_ownership('06638e5a-5eba-4aa5-b9b6-6e152512ab42'::uuid);
-- It should return true if the boat belongs to the authenticated user
