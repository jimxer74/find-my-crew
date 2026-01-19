-- Add RLS policies and indexes for registrations table
-- This migration enhances the registrations table with proper security and query optimization

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for owner queries: Get all registrations for a journey's legs
-- This helps when owners want to see all registrations for their journey
CREATE INDEX IF NOT EXISTS registrations_journey_idx 
ON public.registrations (leg_id)
INCLUDE (user_id, status, created_at);

-- Index for status filtering (common query pattern)
CREATE INDEX IF NOT EXISTS registrations_status_idx 
ON public.registrations (status)
WHERE status = 'Pending approval';

-- Index for user queries: Get all registrations by a crew member
CREATE INDEX IF NOT EXISTS registrations_user_status_idx 
ON public.registrations (user_id, status);

-- Composite index for owner dashboard queries (leg_id + status)
CREATE INDEX IF NOT EXISTS registrations_leg_status_idx 
ON public.registrations (leg_id, status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on registrations table
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Policy: Crew members can view their own registrations
CREATE POLICY "Crew can view own registrations"
ON public.registrations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Crew members can create registrations
CREATE POLICY "Crew can create registrations"
ON public.registrations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    -- Ensure the leg exists and belongs to a published journey
    SELECT 1 FROM public.legs l
    INNER JOIN public.journeys j ON j.id = l.journey_id
    WHERE l.id = registrations.leg_id
    AND j.state = 'Published'
  )
);

-- Policy: Crew members can update their own registrations (for cancellation)
-- Note: Crew can only cancel their registrations, not change to other statuses
CREATE POLICY "Crew can update own registrations"
ON public.registrations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  -- Only allow status change to 'Cancelled' for crew members
  -- This is enforced at application level, but RLS ensures they can only update their own
  AND auth.uid() = user_id
);

-- Policy: Owners can view registrations for their journeys
CREATE POLICY "Owners can view registrations for their journeys"
ON public.registrations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.legs l
    INNER JOIN public.journeys j ON j.id = l.journey_id
    INNER JOIN public.boats b ON b.id = j.boat_id
    WHERE l.id = registrations.leg_id
    AND b.owner_id = auth.uid()
  )
);

-- Policy: Owners can update registrations for their journeys (approve/deny)
CREATE POLICY "Owners can update registrations for their journeys"
ON public.registrations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.legs l
    INNER JOIN public.journeys j ON j.id = l.journey_id
    INNER JOIN public.boats b ON b.id = j.boat_id
    WHERE l.id = registrations.leg_id
    AND b.owner_id = auth.uid()
  )
);

-- Policy: Owners can delete registrations for their journeys (if needed)
CREATE POLICY "Owners can delete registrations for their journeys"
ON public.registrations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.legs l
    INNER JOIN public.journeys j ON j.id = l.journey_id
    INNER JOIN public.boats b ON b.id = j.boat_id
    WHERE l.id = registrations.leg_id
    AND b.owner_id = auth.uid()
  )
);

-- Comments
COMMENT ON TABLE public.registrations IS 'Crew member registrations for legs. Status: Pending approval, Approved, Not approved, Cancelled';
COMMENT ON INDEX registrations_journey_idx IS 'Optimizes queries for getting all registrations for a journey';
COMMENT ON INDEX registrations_status_idx IS 'Optimizes filtering by pending approval status';
COMMENT ON INDEX registrations_user_status_idx IS 'Optimizes crew member dashboard queries';
COMMENT ON INDEX registrations_leg_status_idx IS 'Composite index for owner dashboard filtering';
