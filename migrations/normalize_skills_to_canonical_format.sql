-- Migration: Normalize skills to canonical format (lowercase with underscores)
-- This ensures consistent storage format across profiles, journeys, and legs
-- 
-- Format conversion:
--   "Navigation" -> "navigation"
--   "Sailing Experience" -> "sailing_experience"
--   "First Aid" -> "first_aid"
--   etc.

-- Function to convert display format to canonical format
CREATE OR REPLACE FUNCTION normalize_skill_name(skill_name text)
RETURNS text AS $$
BEGIN
  IF skill_name IS NULL OR skill_name = '' THEN
    RETURN '';
  END IF;
  
  -- Convert to lowercase and replace spaces with underscores
  RETURN lower(trim(replace(skill_name, ' ', '_')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Normalize skills in journeys table
-- Update each element in the skills array
UPDATE public.journeys
SET skills = (
  SELECT COALESCE(array_agg(normalize_skill_name(skill)), ARRAY[]::text[])
  FROM unnest(skills) AS skill
  WHERE normalize_skill_name(skill) != ''
)
WHERE skills IS NOT NULL AND array_length(skills, 1) > 0;

-- Normalize skills in legs table
-- Update each element in the skills array
UPDATE public.legs
SET skills = (
  SELECT array_agg(normalize_skill_name(skill))
  FROM unnest(skills) AS skill
  WHERE normalize_skill_name(skill) != ''
)
WHERE skills IS NOT NULL AND array_length(skills, 1) > 0;

-- Normalize skills in profiles table
-- Profiles store skills as JSON strings: '{"skill_name": "...", "description": "..."}'
-- We need to update the skill_name field within each JSON string
UPDATE public.profiles
SET skills = (
  SELECT COALESCE(
    array_agg(
      CASE 
        WHEN skill_json::text LIKE '{%}' THEN
          -- It's a JSON object, extract and normalize skill_name
          jsonb_set(
            skill_json::jsonb,
            '{skill_name}',
            to_jsonb(normalize_skill_name(skill_json::jsonb->>'skill_name'))
          )::text
        ELSE
          -- It's a plain string, normalize it and wrap in JSON
          json_build_object(
            'skill_name',
            normalize_skill_name(skill_json::text),
            'description',
            ''
          )::text
      END
    ),
    ARRAY[]::text[]
  )
  FROM unnest(skills) AS skill_json
)
WHERE skills IS NOT NULL AND array_length(skills, 1) > 0;

-- Drop the temporary function (optional, can keep for future use)
-- DROP FUNCTION IF EXISTS normalize_skill_name(text);

-- Add comment explaining the canonical format
COMMENT ON COLUMN public.journeys.skills IS 'Array of skill names in canonical format (lowercase with underscores, e.g., "navigation", "sailing_experience"). Use skillUtils.ts functions to convert to/from display format.';
COMMENT ON COLUMN public.legs.skills IS 'Array of skill names in canonical format (lowercase with underscores, e.g., "navigation", "sailing_experience"). Use skillUtils.ts functions to convert to/from display format.';
COMMENT ON COLUMN public.profiles.skills IS 'Array of JSON strings with skill_name in canonical format (lowercase with underscores) and description. Format: [''{"skill_name": "navigation", "description": "..."}'', ...]';
