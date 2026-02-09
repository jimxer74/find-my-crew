---
id: TASK-006.08
title: 'Phase 4.2: Profile Completion Within Chat'
status: Done
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-09 14:14'
labels:
  - profile
  - phase-4
dependencies: []
parent_task_id: TASK-006
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to complete their profile within the chat after signing up, using information already gathered during the conversation.

**Depends on:** Phase 3 tasks

**Flow:**
Previous phase:
option a) Email sign-up
- User signs-in via email and is notified to go to email and confirm registration.
- User clicks the https://www.sailsm.art -homepage in email link and is directed to /page.tsx
option b) OAuth (Facebook sign-up)
- User signs using Facebook identity and is rediredect to https://www.sailsm.art/ -homepage

1. After redirection to homepage, there must be a logic to check that if sign-up process was started in AI assistant. If yes, redirect user to AI assistant and AI suggest completing the profile
2. Shows what information was already gathered
3. Asks for any missing required fields
4. Updates profile via existing API
5. Calculates profile completion percentage

**Pre-populated Fields (from conversation):**
- `user_description` - From sailing goals discussion
- `sailing_experience` - From experience level questions
- `risk_level` - From adventure preference questions
- `skills` - From skills/certifications discussion
- `sailing_preferences` - From location preferences

**Missing Fields to Collect:**
- `full_name` (if not from Facebook)
- `phone` (optional)
- `certifications` (if not discussed)
- Profile image (optional, can skip in chat)

**Components:**
- `InlineChatProfileCompletion.tsx` - Profile fields in chat
- Show profile completion progress
- Link to full profile page for advanced editing
- 

**Additional notes**
- Create tools for fetching the Decriptions for Sailing Experience Levels: (Beginner, Competent crew, Coastal Skipper, Offshore Skipper), Risk Levels and Skills definitions so that AI can show them in chat if needed
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AI shows gathered information after signup
- [x] #2 Missing fields requested in chat
- [x] #3 Profile updated via API
- [x] #4 Profile completion percentage calculated
- [x] #5 Option to continue to full profile page
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Notes (2026-02-09)

### Redirect Logic
- Added `ai_assistant_signup_pending` flag to localStorage when user starts signup from chat
- Homepage checks for this flag and authenticated user, redirects to `/welcome/chat?profile_completion=true`

### Profile Completion Mode
- ProspectChatContext detects `profile_completion=true` param and checks authentication
- When authenticated, sets `profileCompletionMode`, `isAuthenticated`, and `userId` state
- Auto-generates welcome message with gathered preferences summary

### New AI Tools Added
- `get_experience_level_definitions` - Returns descriptions for experience levels 1-4
- `get_risk_level_definitions` - Returns descriptions for Coastal/Offshore/Extreme sailing
- `get_skills_definitions` - Returns list of available sailing skills
- `update_user_profile` - Allows AI to update profile fields (full_name, user_description, sailing_experience, risk_level, skills, sailing_preferences, certifications)
- `get_profile_completion_status` - Returns filled/missing fields and completion percentage

### System Prompt Updates
- Added PROFILE COMPLETION MODE section with instructions for authenticated users
- AI guides users through completing profile, uses tools to save confirmed values

### Components Created
- `InlineChatProfileProgress.tsx` - Visual progress indicator with field checklist and link to full profile page

### Files Modified
- `app/components/prospect/InlineChatSignupForm.tsx` - Store signup flag
- `app/page.tsx` - Check for signup flag and redirect
- `app/contexts/ProspectChatContext.tsx` - Profile completion mode handling
- `app/api/ai/prospect/chat/route.ts` - Authenticated user context
- `app/lib/ai/prospect/service.ts` - New tools and profile completion prompt
- `app/lib/ai/prospect/types.ts` - Extended request type
- `app/lib/ai/shared/tools/definitions.ts` - New tool definitions
- `app/lib/ai/shared/tools/types.ts` - Added min/max to parameter type
<!-- SECTION:NOTES:END -->
