-- ALTERNATIVE FIX: Simpler approach without SECURITY DEFINER function
-- Use this if the function-based approach doesn't work
-- 
-- This approach relies on ensuring the boats table is fully readable
-- and uses a direct subquery with proper type casting

-- STEP 1: Ensure boats table SELECT policy explicitly allows authenticated role
DROP POLICY IF EXISTS "Boats are accessible to all" ON public.boats;

CREATE POLICY "Boats are accessible to all"
ON public.boats FOR SELECT
TO authenticated, anon, public
USING (true);

-- STEP 2: Drop existing insert policy
DROP POLICY IF EXISTS "Owners can insert journeys for their boats" ON public.journeys;

-- STEP 3: Create policy with direct subquery (no function)
-- Using explicit type casting and ensuring all conditions are met
CREATE POLICY "Owners can insert journeys for their boats"
ON public.journeys
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND journeys.boat_id IS NOT NULL
  AND (
    SELECT boats.owner_id 
    FROM public.boats 
    WHERE boats.id = journeys.boat_id
    LIMIT 1
  ) = auth.uid()
);
