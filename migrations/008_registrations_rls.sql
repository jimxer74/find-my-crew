-- Migration: 008_registrations_rls.sql
-- Description: Add Row Level Security policies to the registrations table
-- Date: 2026-01-25

-- ============================================================================
-- REGISTRATIONS TABLE: Enable RLS and Add Policies
-- ============================================================================

-- Enable Row Level Security on registrations table
alter table public.registrations enable row level security;

-- Policy 1: Users can view their own registrations
-- Allows crew members to see registrations they created
create policy "Users can view their own registrations"
on public.registrations for select
using (auth.uid() = user_id);

-- Policy 2: Journey owners can view registrations for their journeys
-- Allows boat owners to see all registrations for legs belonging to their journeys
create policy "Owners can view registrations for their journeys"
on public.registrations for select
using (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = registrations.leg_id
    and boats.owner_id = auth.uid()
  )
);

-- Policy 3: Users can create registrations for themselves
-- Allows authenticated users to register for legs
create policy "Users can create their own registrations"
on public.registrations for insert
with check (auth.uid() = user_id);

-- Policy 4: Users can update their own registrations (e.g., cancel)
-- Allows crew to modify their own registration (e.g., add notes, cancel)
create policy "Users can update their own registrations"
on public.registrations for update
using (auth.uid() = user_id);

-- Policy 5: Journey owners can update registrations for their journeys
-- Allows owners to approve/reject registrations
create policy "Owners can update registrations for their journeys"
on public.registrations for update
using (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = registrations.leg_id
    and boats.owner_id = auth.uid()
  )
);

-- Policy 6: Users can delete their own registrations
-- Allows crew to withdraw their registration
create policy "Users can delete their own registrations"
on public.registrations for delete
using (auth.uid() = user_id);

-- Policy 7: Journey owners can delete registrations for their journeys
-- Allows owners to remove registrations if needed
create policy "Owners can delete registrations for their journeys"
on public.registrations for delete
using (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = registrations.leg_id
    and boats.owner_id = auth.uid()
  )
);
