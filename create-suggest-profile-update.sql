-- SQL INSERT for suggest_profile_update_user_description action
-- This creates a manual suggestion for updating a user's profile description

-- Example 1: Basic profile description update suggestion
-- Replace 'YOUR_USER_ID_HERE' with the actual user UUID
INSERT INTO ai_pending_actions (
  user_id,
  conversation_id,
  action_type,
  action_payload,
  explanation,
  status,
  input_prompt,
  input_type
) VALUES (
  'YOUR_USER_ID_HERE', -- Replace with actual user UUID from auth.users table
  NULL, -- No conversation ID for manually created suggestions
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

-- Example 2: Profile description update with current user data
-- This example assumes you have the current user description available
INSERT INTO ai_pending_actions (
  user_id,
  conversation_id,
  action_type,
  action_payload,
  explanation,
  status,
  input_prompt,
  input_type
) VALUES (
  'YOUR_USER_ID_HERE', -- Replace with actual user UUID
  NULL,
  'suggest_profile_update_user_description',
  '{
    "field": "user_description",
    "old_value": "Experienced sailor with a passion for the sea",
    "suggestions": [
      "Include specific sailing experience (years, types of boats)",
      "Mention any certifications or special skills",
      "Describe what type of sailing opportunities you''re seeking"
    ]
  }'::jsonb,
  'Your profile description could be more detailed to help boat owners understand your experience and preferences. Consider adding more specific information about your sailing background and what you''re looking for.',
  'pending',
  'Please provide a more detailed user description including your sailing experience, certifications, and what type of opportunities you''re seeking',
  'text'
);

-- Example 3: Profile description update suggestion with context
-- This example provides more context about why the update is suggested
INSERT INTO ai_pending_actions (
  user_id,
  conversation_id,
  action_type,
  action_payload,
  explanation,
  status,
  input_prompt,
  input_type
) VALUES (
  'YOUR_USER_ID_HERE', -- Replace with actual user UUID
  NULL,
  'suggest_profile_update_user_description',
  '{
    "field": "user_description",
    "old_value": "Sailing enthusiast",
    "reasoning": "Profile description is too generic and doesn''t showcase sailing experience or preferences",
    "improvement_areas": ["sailing experience", "certifications", "preferences", "availability"]
  }'::jsonb,
  'Analysis shows your profile description is quite generic. A detailed description highlighting your sailing experience, certifications, and preferences will significantly improve your chances of finding suitable sailing opportunities.',
  'pending',
  'Please write a comprehensive user description (3-5 sentences) that includes your sailing experience, certifications, preferred sailing conditions, and what you''re looking for in sailing opportunities',
  'text'
);

-- To find a user ID, you can run this query first:
-- SELECT id, email, username FROM auth.users WHERE email = 'user@example.com' LIMIT 1;

-- To verify the action was created:
-- SELECT id, user_id, action_type, explanation, input_prompt, input_type, status, created_at
-- FROM ai_pending_actions
-- WHERE action_type = 'suggest_profile_update_user_description'
-- ORDER BY created_at DESC
-- LIMIT 5;

-- To see the action payload details:
-- SELECT id, action_payload->>'field' as field, action_payload->>'old_value' as old_value
-- FROM ai_pending_actions
-- WHERE action_type = 'suggest_profile_update_user_description'
-- AND status = 'pending';