-- Simple SQL INSERT for suggest_profile_update_user_description action
-- Replace YOUR_USER_ID_HERE with the actual user UUID

INSERT INTO ai_pending_actions (
  user_id,
  action_type,
  action_payload,
  explanation,
  status,
  input_prompt,
  input_type
) VALUES (
  'YOUR_USER_ID_HERE', -- ← Replace this with actual user UUID
  'suggest_profile_update_user_description',
  '{
    "field": "user_description",
    "old_value": "Sailor looking for opportunities"
  }'::jsonb,
  'Your profile description is quite brief. A more detailed description would help attract better sailing opportunities and make your profile more appealing to boat owners.',
  'pending',
  'Please provide your new user description (3-5 sentences about your sailing experience, interests, and what you''re looking for)',
  'text'
);

-- How to find the user ID:
-- 1. Run: SELECT id, email FROM auth.users WHERE email = 'user@example.com';
-- 2. Copy the UUID from the id column
-- 3. Replace YOUR_USER_ID_HERE with that UUID (including the quotes)

-- Example of finding user ID:
-- SELECT id, email, username FROM auth.users WHERE email = 'test@example.com';

-- After running the INSERT, verify it worked:
-- SELECT id, action_type, explanation, input_prompt, status FROM ai_pending_actions
-- WHERE action_type = 'suggest_profile_update_user_description'
-- ORDER BY created_at DESC LIMIT 1;