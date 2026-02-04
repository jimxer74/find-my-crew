-- Manual AI Assistant Suggestions and Actions
-- Create suggestions and actions without calling external AI models
-- Use this to test AI assistant functionality and save on API costs

-- ============================================================================
-- 1. CREATE SUGGESTIONS (Proactive recommendations)
-- ============================================================================

-- Example 1: Matching leg suggestion for a user
-- This appears as a proactive suggestion in the AI assistant
INSERT INTO ai_suggestions (
  user_id,
  suggestion_type,
  title,
  description,
  metadata,
  dismissed
) VALUES (
  'YOUR_USER_ID_HERE', -- Replace with actual user UUID
  'matching_leg',
  '75% match: Coastal Cruise from Helsinki to Tallinn',
  'Baltic Sea Adventure - Your sailing experience and skills match well with this journey. Matching skills: navigation, cooking. Your experience meets requirements.',
  '{
    "legId": "leg-uuid-here",
    "journeyId": "journey-uuid-here",
    "matchScore": 75,
    "reason": "Skills and experience alignment"
  }'::jsonb,
  false
);

-- Example 2: Profile improvement suggestion
INSERT INTO ai_suggestions (
  user_id,
  suggestion_type,
  title,
  description,
  metadata,
  dismissed
) VALUES (
  'YOUR_USER_ID_HERE', -- Replace with actual user UUID
  'profile_improvement',
  'Profile Enhancement Opportunity',
  'Your profile is 60% complete. Adding certifications and refining your skills could improve your match rate by 40%. Consider updating your sailing preferences.',
  '{
    "improvementAreas": ["certifications", "skills", "sailing_preferences"],
    "completionRate": 60,
    "potentialImprovement": 40
  }'::jsonb,
  false
);

-- Example 3: Journey opportunity suggestion
INSERT INTO ai_suggestions (
  user_id,
  suggestion_type,
  title,
  description,
  metadata,
  dismissed
) VALUES (
  'YOUR_USER_ID_HERE', -- Replace with actual user UUID
  'journey_opportunity',
  'New Journey: Mediterranean Regatta Series',
  'A new journey has been published that matches your risk level and sailing preferences. The owner is looking for experienced crew with navigation and maintenance skills.',
  '{
    "journeyId": "journey-uuid-here",
    "opportunityType": "crew_position",
    "requiredSkills": ["navigation", "maintenance"],
    "riskLevel": "intermediate"
  }'::jsonb,
  false
);

-- ============================================================================
-- 2. CREATE PENDING ACTIONS (User approval required)
-- ============================================================================

-- Example 1: Profile description update action
-- This appears in the AI assistant with a direct text input field
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
  NULL, -- No conversation ID for manually created actions
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

-- Example 2: Skills refinement action
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
  'refine_skills',
  '{
    "targetSkills": ["navigation", "cooking", "maintenance"],
    "currentSkills": ["basic sailing"],
    "suggestions": {
      "navigation": "Consider getting certified in coastal navigation",
      "cooking": "Learn meal planning for extended voyages",
      "maintenance": "Basic engine maintenance skills are valuable"
    }
  }'::jsonb,
  'Your skills could be more specific to attract better matches. The following skills would improve your profile: navigation, cooking, maintenance.',
  'pending',
  'Please provide more specific descriptions for your skills. For example: "Certified in coastal navigation", "Experienced galley chef", "Basic engine maintenance"',
  'text'
);

-- Example 3: Register for leg action
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
  'register_for_leg',
  '{
    "legId": "leg-uuid-here",
    "legName": "Summer Baltic Cruise",
    "journeyName": "Nordic Adventure 2024",
    "reasons": ["Skills match", "Experience level appropriate", "Risk level compatible"]
  }'::jsonb,
  'This leg is a great match for your profile. Your navigation skills and intermediate experience level align well with the requirements.',
  'pending',
  'Are you interested in registering for this leg? This will submit your application to the boat owner.',
  'select'
);

-- ============================================================================
-- 3. HELPER QUERIES
-- ============================================================================

-- Find user IDs by email
-- SELECT id, email, username FROM auth.users WHERE email = 'user@example.com' LIMIT 5;

-- Find leg IDs for actions
-- SELECT id, name, journey_id FROM legs WHERE name ILIKE '%baltic%' LIMIT 5;

-- Find journey IDs
-- SELECT id, name, state FROM journeys WHERE state = 'Published' LIMIT 5;

-- View created suggestions
-- SELECT id, user_id, suggestion_type, title, description, dismissed, created_at
-- FROM ai_suggestions
-- WHERE user_id = 'YOUR_USER_ID_HERE'
-- ORDER BY created_at DESC;

-- View created actions
-- SELECT id, user_id, action_type, explanation, status, input_prompt, input_type, created_at
-- FROM ai_pending_actions
-- WHERE user_id = 'YOUR_USER_ID_HERE'
-- ORDER BY created_at DESC;

-- Clean up test data
-- DELETE FROM ai_suggestions WHERE user_id = 'YOUR_USER_ID_HERE';
-- DELETE FROM ai_pending_actions WHERE user_id = 'YOUR_USER_ID_HERE';

-- ============================================================================
-- 4. QUICK SETUP EXAMPLES
-- ============================================================================

-- Quick user description update action (copy and paste this one)
-- Replace USER_UUID_HERE with actual UUID
/*
INSERT INTO ai_pending_actions (
  user_id, action_type, action_payload, explanation, status, input_prompt, input_type
) VALUES (
  'USER_UUID_HERE',
  'suggest_profile_update_user_description',
  '{"field": "user_description", "old_value": "Sailing enthusiast"}'::jsonb,
  'Your profile description could be more detailed to help boat owners understand your experience and preferences.',
  'pending',
  'Please provide a detailed user description including your sailing experience and preferences',
  'text'
);
*/

-- Quick matching leg suggestion (copy and paste this one)
-- Replace USER_UUID_HERE with actual UUID
/*
INSERT INTO ai_suggestions (
  user_id, suggestion_type, title, description, metadata, dismissed
) VALUES (
  'USER_UUID_HERE',
  'matching_leg',
  '85% match: Atlantic Crossing',
  'Perfect opportunity for your experience level with matching skills in navigation and maintenance.',
  '{"legId": "leg-uuid", "matchScore": 85}'::jsonb,
  false
);
*/