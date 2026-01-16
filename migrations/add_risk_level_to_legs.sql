-- Add risk_level column to legs table (single value, not array)
ALTER TABLE public.legs
ADD COLUMN IF NOT EXISTS risk_level risk_level;

-- Add comment
COMMENT ON COLUMN public.legs.risk_level IS 'Risk level for this leg: Coastal sailing, Offshore sailing, or Extreme sailing (single selection)';
