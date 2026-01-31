---
id: TASK-069
title: Create profile from Facebook
status: In Progress
assignee: []
created_date: '2026-01-31 08:01'
updated_date: '2026-01-31 17:08'
labels:
  - feature
  - ai
  - facebook
  - onboarding
  - profile
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a user logs in via Facebook OAuth, capture extended profile data from Facebook (with user consent), use AI to analyze this data, and generate a proposed profile that the user can review and edit before saving.

## Overview

This feature enhances the Facebook login flow to:
1. Request extended Facebook permissions during OAuth
2. Fetch available Facebook data (user profile image, profile with all data, posts, interests, etc.)
3. Use AI to analyze the data and generate profile suggestions
4. Present the proposed profile to the user for review/edit
5. Save the approved profile

## Technical Context

**Current Architecture:**
- Facebook OAuth via Supabase (basic authentication only)
- Profile schema in `specs/tables.sql` with fields: username, full_name, sailing_experience, experience, certifications, sailing_preferences, skills, risk_level, roles
- AI service infrastructure with multi-provider support (DeepSeek, Groq, Gemini), use AI providers in priority order: Gemini, Groq, DeepSeek
- Consent management system with audit logging

**Key Challenge:**
Supabase OAuth provides limited Facebook data. Extended Facebook data requires:
1. Facebook App configuration with additional permissions
2. Server-side Facebook Graph API calls with the user's access token
3. Explicit user consent for data processing
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Facebook OAuth requests extended permissions (email, public_profile, user_posts, user_likes)
- [x] #2 User sees Facebook permission consent screen before data access
- [x] #3 System fetches available Facebook data via Graph API after login
- [x] #4 AI analyzes Facebook data and generates profile suggestions
- [x] #5 User is presented with a review/edit screen showing AI-generated profile
- [x] #6 User can modify any suggested field before saving
- [x] #7 Profile is only saved after explicit user confirmation
- [x] #8 Works gracefully when Facebook data is limited or unavailable
- [x] #9 Existing manual profile creation flow remains available as fallback
- [x] #10 All Facebook data processing respects GDPR consent requirements
- [x] #11 Fix profile editing page UI to use common controls
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Facebook App & OAuth Configuration

**1.1 Update Facebook App Settings**
- Configure Facebook App to request extended permissions:
  - `email` (already have)
  - `public_profile` (already have)
  - `user_posts` - Access to user's posts
  - `user_likes` - Access to pages/interests user likes
- Note: Some permissions require Facebook App Review for production

**1.2 Update Supabase OAuth Configuration**
- File: `app/auth/login/page.tsx`
- Add `scopes` parameter to OAuth call to request extended permissions
- Store the Facebook access token for subsequent API calls

**1.3 Store Facebook Access Token**
- Create mechanism to capture and temporarily store the Facebook access token
- Token needed for server-side Graph API calls
- Consider secure, short-lived storage (session or temporary table)

---

### Phase 2: Facebook Data Fetching Service

**2.1 Create Facebook Graph API Service**
- File: `app/lib/facebook/graphApi.ts`
- Implement functions to fetch:
  - `/me` - Basic profile (name, picture, email)
  - `/me/posts` - User's recent posts (if permitted)
  - `/me/likes` - Pages/interests the user likes
  - `/me/picture?type=large` - Profile picture URL
- Handle permission errors gracefully (user may deny some permissions)

**2.2 Create Facebook Data Types**
- File: `app/lib/facebook/types.ts`
- Define TypeScript interfaces for Facebook API responses
- Define aggregated FacebookUserData type

**2.3 Implement Data Fetching Route**
- File: `app/api/facebook/fetch-data/route.ts`
- Server-side endpoint to fetch Facebook data
- Requires valid Facebook access token
- Returns aggregated user data

---

### Phase 3: AI Profile Generation

**3.1 Create Profile Generation AI Use Case**
- Update: `app/lib/ai/config.ts`
- Add new use case: `generate-profile-from-facebook`
- Configure appropriate provider/model for text analysis

**3.2 Create AI Profile Generation Route**
- File: `app/api/ai/generate-profile/route.ts`
- Input: Facebook user data (posts, likes, profile info)
- Process:
  - Analyze posts for sailing-related content, experience indicators
  - Analyze likes for sailing interests, risk appetite
  - Extract relevant skills and certifications mentioned
  - Infer sailing experience level (1-4 scale)
  - Generate appropriate username suggestions
- Output: Suggested profile fields matching schema

**3.3 Profile Suggestion Prompt Engineering**
- Create detailed prompt that:
  - Identifies sailing/maritime content from posts
  - Maps interests to skill categories
  - Infers experience level from context
  - Generates multiple username options
  - Suggests risk_level based on activities mentioned
  - Remains conservative (doesn't overstate experience)

---

### Phase 4: Profile Review UI

**4.1 Create Profile Suggestion Review Component**
- File: `app/components/profile/FacebookProfileReview.tsx`
- Display AI-generated suggestions with Facebook source indicators
- Allow editing each field before saving
- Show confidence indicators where applicable
- Include "Use this suggestion" / "Edit manually" options per field

**4.2 Create Profile Creation Wizard**
- File: `app/components/profile/ProfileCreationWizard.tsx`
- Multi-step flow:
  1. Data fetching (loading state)
  2. AI analysis (loading state)
  3. Review suggestions
  4. Edit/customize
  5. Confirm and save
- Include progress indicator
- Allow skipping to manual entry at any step

**4.3 Update Onboarding Flow**
- Modify callback handler to detect Facebook login
- Route new Facebook users to profile creation wizard
- Integrate with existing consent flow (consent first, then profile)

---

### Phase 5: Integration & Polish

**5.1 Update Auth Callback**
- File: `app/auth/callback/route.ts`
- Detect if user is new (no profile exists)
- Detect if login was via Facebook
- Redirect to appropriate flow:
  - New Facebook user → Profile creation wizard
  - Existing user → Normal dashboard redirect

**5.2 Handle Edge Cases**
- User denies Facebook permissions → Fallback to manual entry
- Facebook API errors → Fallback to manual entry
- AI generation fails → Fallback to manual entry
- Limited data available → Partial suggestions + manual completion

**5.3 Add Consent Tracking**
- Update `user_consents` table if needed
- Track consent for Facebook data processing specifically
- Add to consent audit log

---

### Database Changes

**5.4 Migration: Facebook Data Tracking (Optional)**
- File: `migrations/XXX_facebook_profile_source.sql`
- Consider adding:
  - `profile_source` column to track how profile was created
  - `facebook_profile_url` column for linking back to Facebook
- Update `specs/tables.sql` accordingly

---

## File Structure Summary

```
app/
├── api/
│   ├── ai/
│   │   └── generate-profile/route.ts (NEW)
│   └── facebook/
│       └── fetch-data/route.ts (NEW)
├── auth/
│   ├── callback/route.ts (MODIFY)
│   └── login/page.tsx (MODIFY)
├── components/
│   └── profile/
│       ├── FacebookProfileReview.tsx (NEW)
│       └── ProfileCreationWizard.tsx (NEW)
├── lib/
│   └── facebook/
│       ├── graphApi.ts (NEW)
│       └── types.ts (NEW)
└── profile-setup/
    └── page.tsx (NEW - wizard page)
```

## Dependencies

- Facebook App properly configured with extended permissions
- Facebook App Review (for production use of extended permissions)
- Environment variables for Facebook App credentials
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Files Created

**Facebook Integration:**
- `app/lib/facebook/types.ts` - TypeScript interfaces for Facebook API responses and profile suggestions
- `app/lib/facebook/graphApi.ts` - Facebook Graph API service with functions to fetch profile, posts, likes
- `app/lib/facebook/index.ts` - Export barrel file
- `app/api/facebook/fetch-data/route.ts` - API endpoint to fetch Facebook data using stored access token

**AI Profile Generation:**
- `app/api/ai/generate-profile/route.ts` - API endpoint that uses AI to analyze Facebook data and generate profile suggestions

**Profile Setup UI:**
- `app/components/profile/ProfileCreationWizard.tsx` - Multi-step wizard component for profile creation
- `app/profile-setup/page.tsx` - Page that hosts the wizard

### Files Modified

**OAuth Configuration:**
- `app/auth/login/page.tsx` - Added extended Facebook scopes (email, public_profile, user_posts, user_likes)
- `app/auth/callback/route.ts` - Added detection of new Facebook users and redirect to profile-setup with access token stored in secure cookie

**AI Configuration:**
- `app/lib/ai/config.ts` - Added new 'generate-profile' use case with Gemini, Groq, and DeepSeek fallback

### User Flow

1. User clicks "Facebook" login button
2. Facebook OAuth with extended permissions requested
3. After successful auth, callback checks if user is new (no profile)
4. New Facebook users are redirected to `/profile-setup` with access token in secure cookie
5. Profile wizard:
   - Asks for AI consent (optional)
   - Fetches Facebook data (profile, posts, likes)
   - If AI consent given, generates profile suggestions
   - Shows review/edit form with suggestions
   - User selects roles and saves profile
6. Redirect to appropriate dashboard

### Key Features

- **Graceful degradation**: Works even if Facebook data or AI is unavailable
- **User control**: All suggestions can be edited before saving
- **Privacy-first**: AI processing requires explicit consent
- **Secure token handling**: Facebook token stored in short-lived (5 min) httpOnly cookie

### Environment Variables Required

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL (existing)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (existing)
- `GOOGLE_GEMINI_API_KEY` - For AI profile generation
- `GROQ_API_KEY` - Fallback AI provider
- `DEEPSEEK_API_KEY` - Fallback AI provider

### Facebook App Configuration Required

The Facebook App needs to be configured with these permissions:
- `email` (usually auto-approved)
- `public_profile` (usually auto-approved)
- `user_posts` (requires Facebook App Review for production)
- `user_likes` (requires Facebook App Review for production)

Note: Extended permissions (user_posts, user_likes) require Facebook App Review before they work in production. During development, these work for app admins/testers only.

## Profile UI Update (2026-01-31)

Updated ProfileCreationWizard.tsx to use common UI controls:
- Replaced inline radio buttons for experience level with `SkillLevelSelector` component
- Replaced inline checkboxes for risk level with `RiskLevelSelector` component
- Updated skills format from `string[]` to `SkillEntry[]` for consistency with profile page
- Updated profile save logic to serialize skills to JSON strings

This ensures visual consistency between the Facebook profile creation wizard and the regular profile editing page.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Facebook OAuth successfully requests and receives extended permissions
- [x] #2 Facebook Graph API service fetches user data server-side
- [x] #3 AI successfully generates profile suggestions from Facebook data
- [x] #4 Profile review wizard displays suggestions and allows editing
- [x] #5 User can save AI-generated profile after review
- [x] #6 Fallback to manual profile creation works when Facebook data unavailable
- [ ] #7 Integration tests cover happy path and error scenarios
- [ ] #8 Migration file created and specs/tables.sql updated if schema changes needed
<!-- DOD:END -->
