-- Migration: Create boat_registry table
-- This table caches boat specifications fetched from external sources (sailboatdata.com)
-- to reduce external API calls and improve performance.
--
-- The registry stores boat model specifications (not owner-specific data like name, home_port, owner_id)
-- and is used as a cache layer before fetching from external sources.

-- Create boat_registry table
CREATE TABLE IF NOT EXISTS public.boat_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make_model text NOT NULL,
  slug text, -- Optional slug from sailboatdata.com (e.g., "bavaria-46")
  type sailboat_category,
  capacity int,
  loa_m numeric,
  beam_m numeric,
  max_draft_m numeric,
  displcmt_m numeric,
  average_speed_knots numeric,
  link_to_specs text,
  characteristics text,
  capabilities text,
  accommodations text,
  sa_displ_ratio numeric,
  ballast_displ_ratio numeric,
  displ_len_ratio numeric,
  comfort_ratio numeric,
  capsize_screening numeric,
  hull_speed_knots numeric,
  ppi_pounds_per_inch numeric,
  fetch_count int DEFAULT 0, -- Track how many times this registry entry was used
  last_fetched_at timestamptz, -- When external source was last checked
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure make_model is unique (one registry entry per boat model)
  CONSTRAINT boat_registry_make_model_unique UNIQUE (make_model)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS boat_registry_make_model_idx ON public.boat_registry (make_model);
CREATE INDEX IF NOT EXISTS boat_registry_slug_idx ON public.boat_registry (slug) WHERE slug IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.boat_registry ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read registry (public data)
CREATE POLICY "Boat registry is viewable by all"
ON public.boat_registry FOR SELECT
USING (true);

-- Policy: Allow authenticated users to insert/update (for server-side code)
-- Note: In production, registry writes should be done via service role or server-side code
CREATE POLICY "Authenticated users can insert boat registry entries"
ON public.boat_registry FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update boat registry entries"
ON public.boat_registry FOR UPDATE
USING (auth.role() = 'authenticated');

-- Comments for documentation
COMMENT ON TABLE public.boat_registry IS 'Cache table for boat specifications fetched from external sources. Stores boat model data (not owner-specific fields like name, home_port, owner_id).';
COMMENT ON COLUMN public.boat_registry.make_model IS 'Boat make and model (e.g., "Bavaria 46") - unique identifier';
COMMENT ON COLUMN public.boat_registry.slug IS 'URL slug from sailboatdata.com for more reliable lookups';
COMMENT ON COLUMN public.boat_registry.fetch_count IS 'Number of times this registry entry was used (for analytics)';
COMMENT ON COLUMN public.boat_registry.last_fetched_at IS 'Timestamp when external source was last checked for this boat model';
