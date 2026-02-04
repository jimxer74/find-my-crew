-- Migration: Combine make and model fields into make_model field
-- This migration adds a new make_model column, populates it with concatenated make/model values,
-- adds an index for performance, and updates RLS policies if needed.

-- Add new make_model column
ALTER TABLE boats ADD COLUMN make_model TEXT;

-- Populate make_model by concatenating existing make and model
-- Handle cases where either field might be null or empty
UPDATE boats SET make_model = TRIM(CONCAT(
    COALESCE(NULLIF(make, ''), ''),
    ' ',
    COALESCE(NULLIF(model, ''), '')
)) WHERE make IS NOT NULL OR model IS NOT NULL;

-- Remove any trailing spaces that may have been added
UPDATE boats SET make_model = TRIM(make_model) WHERE make_model IS NOT NULL;

-- Add index on make_model for performance
CREATE INDEX IF NOT EXISTS boats_make_model_idx ON boats (make_model);

-- Update RLS policies - no changes needed for basic policies as they remain the same
-- Owners can still insert/update/delete their boats, public can still select all boats