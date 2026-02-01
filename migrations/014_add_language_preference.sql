-- Migration: Add language preference to profiles
-- This allows users to persist their language preference across sessions

-- Add language column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en';

-- Add check constraint for supported languages
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_language_check
CHECK (language IN ('en', 'fi'));

-- Add index for potential language-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_language ON public.profiles(language);

-- Comment
COMMENT ON COLUMN public.profiles.language IS 'User preferred language code (ISO 639-1). Supported: en, fi';
