-- Add cost model enum type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_model') THEN
        CREATE TYPE cost_model AS ENUM (
            'Shared contribution',
            'Owner covers all costs',
            'Crew pays a fee',
            'Delivery/paid crew',
            'Not defined'
        );
    END IF;
END$$;

-- Add cost_model column to journeys table
ALTER TABLE journeys
ADD COLUMN IF NOT EXISTS cost_model cost_model DEFAULT 'Not defined';

-- Update journey table schema in specs/tables.sql
-- Note: This migration updates the schema, the actual table.sql file should be updated manually