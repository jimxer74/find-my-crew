-- Add bounding box column to legs table for fast viewport intersection checks
ALTER TABLE public.legs
ADD COLUMN IF NOT EXISTS bbox geometry(Polygon, 4326);

-- Create GIST index on bbox for fast viewport queries
CREATE INDEX IF NOT EXISTS legs_bbox_idx 
  ON public.legs 
  USING GIST (bbox);

-- Add comment
COMMENT ON COLUMN public.legs.bbox IS 'Bounding box (Polygon) of all waypoints in this leg, pre-calculated for fast viewport intersection queries. SRID 4326 (WGS84)';
