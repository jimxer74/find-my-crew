-- Add photo_file_data column to registration_answers table
-- This stores the base64-encoded photo file for AI facial verification
-- Only populated when require_photo_validation is true and photo is uploaded

ALTER TABLE public.registration_answers
ADD COLUMN photo_file_data text; -- Base64-encoded image data

-- Add comment for clarity
COMMENT ON COLUMN public.registration_answers.photo_file_data IS 'Base64-encoded photo file for facial verification. Only populated when photo validation is required and user uploads a photo.';
