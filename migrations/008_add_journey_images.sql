-- Migration: Add images column to journeys table for storing journey images
-- This migration adds support for journey-specific images that can be displayed
-- in the LegDetailPanel alongside boat images

BEGIN;

-- Add images column to journeys table
-- This column stores an array of image URLs from Supabase Storage
ALTER TABLE public.journeys
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- Update the journeys table comment to include image information
COMMENT ON COLUMN public.journeys.images IS 'Array of image URLs from Supabase Storage for journey-specific images';

-- Insert migration record
INSERT INTO public.schema_migrations (version, description)
VALUES ('008_add_journey_images', 'Add images column to journeys table for journey-specific images')
ON CONFLICT (version) DO NOTHING;

COMMIT;