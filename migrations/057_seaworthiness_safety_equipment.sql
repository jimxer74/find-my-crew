-- Migration: 057_seaworthiness_safety_equipment
-- Purpose: Add offshore experience fields to boats,
--          and service/expiry date tracking to boat_equipment (safety category).

-- ============================================================================
-- 1. Boats: offshore experience fields
-- ============================================================================

alter table public.boats
  add column if not exists miles_on_vessel numeric default null;   -- nautical miles sailed on this specific vessel

alter table public.boats
  add column if not exists offshore_passage_experience boolean default false;  -- has skipper done offshore passages on this boat

-- ============================================================================
-- 3. Boat Equipment: service and expiry date tracking
-- Applicable to all equipment but especially used for safety category items.
-- ============================================================================

alter table public.boat_equipment
  add column if not exists service_date      date default null;   -- date of last service / inspection
alter table public.boat_equipment
  add column if not exists next_service_date date default null;   -- date next service is due
alter table public.boat_equipment
  add column if not exists expiry_date       date default null;   -- item expiry (flares, fire ext., life raft cert.)

-- Index for quick safety equipment queries (used for voyage detail page)
create index if not exists idx_boat_equipment_safety
  on public.boat_equipment(boat_id, category)
  where category = 'safety';
