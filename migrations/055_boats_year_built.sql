-- ============================================================================
-- Add year_built to boats table
--
-- Enables age-aware reasoning in AI equipment generation:
-- the edge function passes yearBuilt to the prompt so the AI can assess
-- which items are commonly replaced on older boats (engines, electronics, etc.)
-- and flag them for user verification before saving.
-- ============================================================================

alter table public.boats add column if not exists year_built int;
