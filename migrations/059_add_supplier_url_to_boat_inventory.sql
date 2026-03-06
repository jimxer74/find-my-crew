-- ============================================================================
-- Migration 059: Add supplier_url to boat_inventory
-- ============================================================================

alter table public.boat_inventory
  add column if not exists supplier_url text;
