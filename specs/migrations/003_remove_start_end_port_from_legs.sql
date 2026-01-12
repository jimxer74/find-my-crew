-- Migration: Remove start_port and end_port columns from legs table
-- These columns are no longer needed as waypoint information is stored in the waypoints JSONB array

-- Remove start_port column
ALTER TABLE public.legs DROP COLUMN IF EXISTS start_port;

-- Remove end_port column
ALTER TABLE public.legs DROP COLUMN IF EXISTS end_port;
