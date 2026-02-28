---
id: TASK-143
title: New AI Crew Onboarding Flow v2 — Profile-Quality Focus
status: In Progress
assignee: []
created_date: '2026-02-28 07:17'
updated_date: '2026-02-28 07:17'
labels: []
dependencies: []
references:
  - app/components/onboarding/OwnerOnboardingV2.tsx
  - app/components/onboarding/OnboardingChat.tsx
  - app/components/onboarding/ProfileCheckpoint.tsx
  - app/components/onboarding/CheckpointCard.tsx
  - app/api/onboarding/v2/chat/route.ts
  - app/api/onboarding/v2/extract/route.ts
  - shared/ai/config/index.ts
  - specs/tables.sql
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Goal

Create a new `/welcome/crew-v2` onboarding flow that mirrors the architecture of `/welcome/owner-v2` but is purpose-built for crew members. The critical differentiator: **a complete, high-quality crew profile dramatically increases chances of getting sailing positions** and enables the automated registration assessment that helps crew bypass manual review.

The existing `/welcome/crew` flow (chat-based with ProspectChat) must remain completely unchanged.

---

## Why This Matters

Unlike boat owners who primarily list their boats, crew members compete for limited berths. A thin profile (just name + experience level) gives owners almost no signal. A rich profile (skills, bio, motivation, availability, location preferences) enables:
- Automated registration assessment (AI-scored approval)
- Better journey matching in search results
- Credibility for owners reviewing candidates

---

## Architecture Overview

Mirrors `OwnerOnboardingV2` with a **signup-first → AI chat → profile confirmation** flow:

```
signup → chatting → confirming_profile → done (redirect to /crew)
```

**Key differences from owner-v2:**
- No boat / equipment / journey phases
- AI chat is longer (8–12 exchanges) and much more focused on crew profile quality
- Profile checkpoint collects significantly more fields
- Dedicated UseCase key `'crew-chat'` (needs to be added to the UseCase union)

---

## Files to Create

### 1. `/app/welcome/crew-v2/page.tsx`
Simple wrapper page that renders `<CrewOnboardingV2 />`.

### 2. `/app/components/onboarding/CrewOnboardingV2.tsx`
Main orchestrator component (patterns from `OwnerOnboardingV2`).

**Phase state machine:**
```typescript
type OnboardingPhase = 'signup' | 'chatting' | 'confirming_profile' | 'done';
```

**State shape:**
```typescript
interface OnboardingProfile {
  displayName: string;
  experienceLevel?: number | null;   // 1-4
  bio?: string | null;               // "About me" — user_description in DB
  motivation?: string | null;        // What excites them about sailing — part of user_description
  sailingPreferences?: string | null; // sailing_preferences in DB
  skills?: string[] | null;          // skills[] in DB
  riskLevels?: string[] | null;      // risk_level[] in DB (must match enum values)
  preferredDepartureLocation?: string | null;  // name field in preferred_departure_location JSONB
  preferredArrivalLocation?: string | null;    // name field in preferred_arrival_location JSONB
  availabilityStartDate?: string | null;       // YYYY-MM-DD
  availabilityEndDate?: string | null;         // YYYY-MM-DD
}
interface OnboardingState {
  phase: OnboardingPhase;
  profile: OnboardingProfile | null;
}
```

**sessionStorage key:** `'onboarding_crew_v2_state'`

**Step indicator:** 3 steps — Account / Profile / Review

**handleChatComplete flow:**
1. Format transcript
2. POST to `/api/onboarding/v2/crew/extract`
3. Map extracted data into `OnboardingProfile`
4. Fallback: use `user?.user_metadata?.full_name` for displayName if extract fails
5. Advance to `'confirming_profile'`

**handleProfileSaved:** clearState() → router.push('/crew')

**SignupModal redirectPath:** `/welcome/crew-v2`

### 3. `/app/components/onboarding/CrewOnboardingChat.tsx`
Chat component, identical structure to `OnboardingChat.tsx` but:
- Points to `/api/onboarding/v2/crew/chat`
- Initial greeting: *"Welcome to Find My Crew! Building a great profile increases your chances of getting sailing positions. This takes about 5–10 minutes. Let's start — what's your name and tell me about your sailing experience?"*
- `ExtractedData` shape matches crew-specific fields (name, experienceLevel, skills, bio, motivation, riskLevels, sailingPreferences, preferredDepartureLocation, preferredArrivalLocation, availabilityStartDate, availabilityEndDate)
- Completion banner text: *"Excellent! I have everything I need. Ready to create your account?"*

### 4. `/app/components/onboarding/CrewProfileCheckpoint.tsx`
Rich checkpoint for reviewing and editing the full crew profile.

**Props:**
```typescript
interface CrewProfileCheckpointProps {
  userId: string;
  email?: string;
  profile: OnboardingProfile;
  onSaved: () => void;
}
```

**DB Upsert (profiles table):**
```typescript
{
  id: userId,
  full_name: displayName,
  username: generatedUsername,
  email,
  user_description: bio + (motivation ? "\n\nWhat I love about sailing: " + motivation : ""),
  sailing_experience: experienceLevel,
  skills: skills ?? [],
  sailing_preferences: sailingPreferences,
  risk_level: riskLevels ?? [],
  preferred_departure_location: preferredDepartureLocation ? { name: preferredDepartureLocation } : null,
  preferred_arrival_location: preferredArrivalLocation ? { name: preferredArrivalLocation } : null,
  availability_start_date: availabilityStartDate,
  availability_end_date: availabilityEndDate,
  roles: ['crew'],
}
```

**Validation (required fields):**
- displayName must not be empty
- skills must have at least 1 item
- bio must not be empty

**Edit mode form:**
- Name (text, required)
- Experience level (dropdown)
- Skills: tag-style input — type skill + "Add" button, chips with ✕ to remove
- Bio / About me (textarea, required, 3 rows)
- Motivation (textarea, optional, 2 rows)
- Risk levels: checkboxes for Coastal sailing / Offshore sailing / Extreme sailing
- Preferred departure location (text input)
- Preferred arrival location (text input)
- Available from / Available until (date inputs)

**Preview (CheckpointCard fields):**
- Name
- Experience
- Skills (comma-joined)
- About me (bio)
- Available (date range if both dates set, or start/end individually)

**On save:** Dispatch `profileUpdated` custom event → call `onSaved()`

---

## Files to Create — API Routes

### 5. `/app/api/onboarding/v2/crew/chat/route.ts`
Same structure as `/api/onboarding/v2/chat/route.ts` but with crew-specific system prompt.

**UseCase:** `'crew-chat'` (see below — must add to types first)
**maxTokens:** 700
**maxDuration:** 45

**System prompt goals (8–12 exchanges):**
1. Name
2. Experience level (Beginner / Competent Crew / Coastal Skipper / Offshore Skipper)
3. Skills — ask for 3–5 specific sailing AND non-sailing skills (navigation, cooking, engine repair, etc.)
4. Brief bio (background, why they love sailing)
5. Sailing motivation (what excites them — racing? cruising? offshore passages?)
6. Risk level preferences (can be multiple)
7. Preferred departure and arrival regions/locations
8. Availability dates (when they're free for sailing)

**Set `isComplete: true` when:** name + experience + 3+ skills + bio collected.

**`extractedData` JSON schema:**
```json
{
  "name": null,
  "experienceLevel": null,
  "skills": null,
  "bio": null,
  "motivation": null,
  "sailingPreferences": null,
  "riskLevels": null,
  "preferredDepartureLocation": null,
  "preferredArrivalLocation": null,
  "availabilityStartDate": null,
  "availabilityEndDate": null
}
```

### 6. `/app/api/onboarding/v2/crew/extract/route.ts`
Post-chat transcript extraction, crew-specific fields.

**UseCase:** `'crew-chat'`
**maxTokens:** 600
**maxDuration:** 30

**Output JSON:**
```json
{
  "profile": {
    "displayName": "string or null",
    "experienceLevel": "1-4 or null",
    "bio": "string or null",
    "motivation": "string or null"
  },
  "skills": ["array of skill strings"] or null,
  "sailingPreferences": "string or null",
  "riskLevels": ["Coastal sailing"|"Offshore sailing"|"Extreme sailing"] or null,
  "locationPreferences": null or {
    "preferredDepartureLocation": "City, Country or region name",
    "preferredArrivalLocation": "City, Country or region name"
  },
  "availability": null or {
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null"
  }
}
```

---

## Files to Modify

### 7. `shared/ai/config/index.ts`
Add `'crew-chat'` to the `UseCase` union type:
```typescript
| 'crew-chat'    // AI chat for crew member onboarding
```

---

## Implementation Notes

- Use `'owner-chat'` as UseCase fallback if `'crew-chat'` model config is not separately defined in dev/prod configs (the orchestrator selects model by UseCase, so they can share the same model config until explicitly differentiated)
- `risk_level` column is a `risk_level[]` enum array — valid values are exactly: `'Coastal sailing'`, `'Offshore sailing'`, `'Extreme sailing'`
- `preferred_departure_location` and `preferred_arrival_location` are JSONB columns expecting `{ name: string, lat?: number, lng?: number, ... }` — store at minimum `{ name: text }` during onboarding
- Username generation: same as owner pattern — `${base}${Date.now().toString(36).slice(-5)}`
- Profile cache invalidation: dispatch `profileUpdated` CustomEvent (existing pattern)

---

## Acceptance Criteria
<!-- AC:BEGIN -->
- Navigating to `/welcome/crew-v2` renders the new flow (not the old ProspectChat)
- The original `/welcome/crew` is completely unchanged
- Step 1 (signup): clicking "Create account" opens SignupModal; on success, redirects back to `/welcome/crew-v2` and auto-advances to chatting phase
- Step 2 (chatting): AI asks about all 8 key profile dimensions; chat completes when name + experience + 3+ skills + bio collected
- Step 3 (confirming_profile): all AI-extracted data pre-filled; user can edit all fields; required-field validation shown inline
- Clicking "Save profile" upserts all fields to `profiles` table with `roles: ['crew']`
- After save, user is redirected to `/crew` dashboard
- Session state persists through page refreshes during onboarding
- Build passes with no TypeScript errors
- Existing `/welcome/crew` flow still works correctly
<!-- SECTION:DESCRIPTION:END -->

- [ ] #1 Navigating to /welcome/crew-v2 renders the new flow, not the old ProspectChat
- [ ] #2 The original /welcome/crew page and its full chat flow is completely unchanged
- [ ] #3 Signup step: 'Create account' opens SignupModal; on success redirects back to /welcome/crew-v2 and auto-advances to chatting phase
- [ ] #4 Chatting step: AI chat collects name, experience level, 3+ skills, bio, motivation, risk levels, location preferences, and availability
- [ ] #5 AI chat sets isComplete: true only when name + experience + skills + bio are all collected
- [ ] #6 confirming_profile step: all AI-extracted data is pre-filled in the form; user can edit every field
- [ ] #7 Required-field validation (name, bio, at least 1 skill) shown inline before saving
- [ ] #8 Skills have a tag/chip UI — user can add skills one-by-one and remove them with ✕
- [ ] #9 Risk level preferences shown as checkboxes (Coastal sailing / Offshore sailing / Extreme sailing)
- [ ] #10 Clicking 'Save profile' upserts all profile fields to the profiles table with roles: ['crew']
- [ ] #11 All fields saved: full_name, user_description (bio + motivation combined), sailing_experience, skills[], risk_level[], sailing_preferences, preferred_departure_location, preferred_arrival_location, availability_start_date, availability_end_date
- [ ] #12 After save, profileUpdated event is dispatched and user is redirected to /crew
- [ ] #13 Session state survives page refresh at any phase (sessionStorage persistence)
- [ ] #14 'crew-chat' added to UseCase union in shared/ai/config/index.ts
- [ ] #15 npm run build passes with no TypeScript errors
<!-- AC:END -->
