---
id: TASK-009
title: AI powered crew to leg matching and proposals for both crew and skippers
status: To Do
assignee: []
created_date: '2026-01-23 17:14'
updated_date: '2026-01-27 14:52'
labels:
  - ai
  - feature
  - matching
  - scheduled-job
dependencies: []
references:
  - app/lib/ai/service.ts
  - app/lib/ai/assessRegistration.ts
  - app/lib/skillMatching.ts
  - app/lib/notifications/service.ts
  - app/api/registrations/route.ts
  - specs/tables.sql
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement an AI-powered matching system that proactively suggests crew members to boat owners and voyage opportunities to crew members. The system runs as a scheduled job and presents matches in a swipe-based UI similar to dating apps, where users can quickly accept, skip, or decline suggestions.

## Problem Statement
Currently, crew members must browse published journeys and manually apply. Boat owners must wait for applications. This passive model misses potential good matches where neither party discovers the other.

## Solution Overview
A daily background job analyzes all published journeys with open crew slots and all available crew profiles (with AI consent), using AI to score compatibility. High-quality matches are saved and surfaced to both parties via notifications and a dedicated "Matches" UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Daily scheduled job runs and generates matches for all eligible journeys/crew
- [ ] #2 Crew members see suggested legs matching their profile (swipe UI)
- [ ] #3 Boat owners see suggested crew members for their open legs (swipe UI)
- [ ] #4 Users can Accept (creates registration), Skip (hide temporarily), or Decline (never show again)
- [ ] #5 Only users with ai_processing_consent=true are included in matching
- [ ] #6 Match notifications sent to both crew and owners when new matches found
- [ ] #7 Match scoring considers: skills overlap, experience level, risk tolerance, date availability, location preferences
- [ ] #8 Matches respect existing registrations (don't suggest already-applied legs)
- [ ] #9 UI shows match score percentage and key matching factors
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Database Schema

**New Tables:**

1. **`crew_leg_matches`** - Stores AI-generated match proposals
```sql
CREATE TABLE crew_leg_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leg_id UUID NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_reasoning TEXT,
  matching_factors JSONB, -- {skills_matched: [], experience_met: true, risk_compatible: true}
  
  -- Status tracking
  crew_status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, skipped, declined
  owner_status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, skipped, declined
  crew_viewed_at TIMESTAMPTZ,
  owner_viewed_at TIMESTAMPTZ,
  crew_actioned_at TIMESTAMPTZ,
  owner_actioned_at TIMESTAMPTZ,
  
  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Matches expire after journey start date
  batch_id UUID, -- Links matches from same job run
  
  CONSTRAINT unique_crew_leg_match UNIQUE (crew_id, leg_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_matches_crew_pending ON crew_leg_matches(crew_id, crew_status) WHERE crew_status = 'pending';
CREATE INDEX idx_matches_leg_pending ON crew_leg_matches(leg_id, owner_status) WHERE owner_status = 'pending';
CREATE INDEX idx_matches_score ON crew_leg_matches(match_score DESC);
CREATE INDEX idx_matches_expires ON crew_leg_matches(expires_at) WHERE expires_at IS NOT NULL;
```

2. **RLS Policies:**
- Crew can view/update their own matches
- Owners can view/update matches for their legs

---

### Phase 2: Matching Algorithm

**File:** `app/lib/ai/matchCrewToLegs.ts`

**Scoring Factors (weighted):**
| Factor | Weight | Description |
|--------|--------|-------------|
| Skills Match | 30% | % of required skills crew has |
| Experience Level | 25% | Binary (met/not met) + bonus for exceeding |
| Risk Tolerance | 20% | Crew's risk level includes leg's risk level |
| Date Availability | 15% | Profile preferences vs leg dates |
| Location Affinity | 10% | Past registrations in similar regions |

**Pre-filtering (Database Level):**
```sql
-- Eligible crew for a leg
SELECT p.* FROM profiles p
JOIN user_consents uc ON uc.user_id = p.id
WHERE 
  'crew' = ANY(p.roles)
  AND uc.ai_processing_consent = true
  AND p.sailing_experience >= leg.min_experience_level
  AND p.risk_level && ARRAY[leg.risk_level]::risk_level[]
  AND NOT EXISTS (
    SELECT 1 FROM registrations r 
    WHERE r.user_id = p.id AND r.leg_id = leg.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM crew_leg_matches m 
    WHERE m.crew_id = p.id AND m.leg_id = leg.id 
    AND m.crew_status = 'declined'
  );
```

**AI Enhancement:**
- For top candidates (after pre-filter), use AI to refine scoring
- AI considers soft factors: sailing_preferences text, certifications
- Use existing `assess-registration` prompt structure as template

---

### Phase 3: Scheduled Job (Vercel Cron)

**File:** `app/api/cron/generate-matches/route.ts`

**Schedule:** Daily at 6:00 AM UTC

**vercel.json:**
```json
{
  "crons": [{
    "path": "/api/cron/generate-matches",
    "schedule": "0 6 * * *"
  }]
}
```

**Job Flow:**
1. Fetch all published journeys with legs that have `crew_needed > approved_count`
2. For each eligible leg:
   a. Get pre-filtered crew candidates (max 50 per leg)
   b. Score each candidate (DB-level + AI for top 20)
   c. Save matches with score >= 60 to `crew_leg_matches`
3. Send batch notifications to users with new matches
4. Clean up expired matches (leg start_date passed)
5. Log job metrics (matches generated, duration, errors)

**Rate Limiting:**
- Process max 100 legs per run
- Max 20 AI calls per leg
- Total AI calls capped at 500/day

---

### Phase 4: API Endpoints

**1. GET `/api/matches/crew`** - Get matches for current crew user
```typescript
// Returns pending matches sorted by score
interface CrewMatchResponse {
  matches: {
    id: string;
    leg: LegWithJourneyAndBoat;
    matchScore: number;
    matchingFactors: MatchingFactors;
    generatedAt: string;
  }[];
  totalPending: number;
}
```

**2. GET `/api/matches/owner`** - Get crew matches for owner's legs
```typescript
interface OwnerMatchResponse {
  matches: {
    id: string;
    crew: CrewProfile;
    leg: LegSummary;
    matchScore: number;
    matchingFactors: MatchingFactors;
    generatedAt: string;
  }[];
  totalPending: number;
}
```

**3. PATCH `/api/matches/[matchId]`** - Update match status
```typescript
interface UpdateMatchRequest {
  action: 'accept' | 'skip' | 'decline';
  role: 'crew' | 'owner';
}

// If both parties accept:
// - Auto-create registration with status 'Approved'
// - Send notifications to both parties
```

**4. POST `/api/cron/generate-matches`** - Cron endpoint (protected)

---

### Phase 5: UI Components

**1. Swipe Card Component** (`app/components/matches/MatchCard.tsx`)
- Full-screen card on mobile, modal on desktop
- Shows: photo, name, match %, key factors
- Swipe gestures: right=accept, left=skip, down=decline
- Buttons for accessibility: Accept, Skip, Decline

**2. Crew Matches Page** (`app/crew/matches/page.tsx`)
- Stack of match cards for suggested legs
- Empty state: "No new matches - check back tomorrow!"
- Filter: by date range, risk level

**3. Owner Matches Page** (`app/owner/matches/page.tsx`)
- Grouped by leg
- Shows crew candidates for each open position
- Quick actions: Accept (invite to apply), Decline

**4. Match Badge in Header**
- Shows count of pending matches
- Links to matches page

---

### Phase 6: Notifications

**New Notification Types:**
- `NEW_MATCHES_AVAILABLE` - Daily digest of new matches
- `MATCH_ACCEPTED` - When other party accepts
- `MUTUAL_MATCH` - When both parties accept (registration created)

**Email Template:**
```
Subject: 🎯 New sailing matches for you!

Hi {name},

We found {count} new sailing opportunities that match your profile:

1. {journey_name} - {leg_name} ({match_score}% match)
   {start_date} - {end_date}
   
[View Matches]

Happy sailing!
```

---

### Phase 7: Testing & Monitoring

**Unit Tests:**
- Matching algorithm scoring
- Pre-filter query accuracy
- Status transitions

**Integration Tests:**
- Full cron job flow
- Mutual match → registration creation
- Notification delivery

**Monitoring:**
- Daily job success/failure alerts
- Match quality metrics (accept rate by score)
- AI API usage tracking

---

## File Structure

```
app/
├── api/
│   ├── cron/
│   │   └── generate-matches/
│   │       └── route.ts
│   └── matches/
│       ├── crew/
│       │   └── route.ts
│       ├── owner/
│       │   └── route.ts
│       └── [matchId]/
│           └── route.ts
├── components/
│   └── matches/
│       ├── MatchCard.tsx
│       ├── MatchStack.tsx
│       ├── MatchingFactors.tsx
│       └── EmptyMatches.tsx
├── crew/
│   └── matches/
│       └── page.tsx
├── owner/
│   └── matches/
│       └── page.tsx
└── lib/
    └── matching/
        ├── service.ts      # Core matching logic
        ├── scoring.ts      # Score calculation
        ├── queries.ts      # Database queries
        └── types.ts        # TypeScript types

migrations/
└── 012_create_crew_leg_matches.sql

specs/
└── tables.sql (updated with new table)
```

---

## Dependencies on Existing Code

| Component | Dependency | Notes |
|-----------|------------|-------|
| AI Scoring | `app/lib/ai/service.ts` | Reuse callAI() with new use case |
| Skill Matching | `app/lib/skillMatching.ts` | Reuse calculateMatchPercentage() |
| Notifications | `app/lib/notifications/service.ts` | Add new notification types |
| Registration Creation | `app/api/registrations/route.ts` | Reuse for mutual match |
| GDPR Consent | `user_consents.ai_processing_consent` | Filter for matching |

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Database Schema | 2 hours |
| Matching Algorithm | 4 hours |
| Scheduled Job | 3 hours |
| API Endpoints | 4 hours |
| UI Components | 6 hours |
| Notifications | 2 hours |
| Testing | 4 hours |
| **Total** | **~25 hours** |
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Technical Decisions

### Why Vercel Cron over Supabase pg_cron?
- Vercel Cron is simpler to set up (just vercel.json config)
- Can use existing TypeScript/AI infrastructure
- Better logging and monitoring in Vercel dashboard
- pg_cron requires Supabase Pro plan and raw SQL

### Why daily batch vs real-time matching?
- Reduces AI API costs significantly
- Prevents notification spam
- Creates anticipation ("check back tomorrow")
- Easier to debug and monitor

### Why separate crew/owner statuses?
- Allows asymmetric interactions (crew accepts, owner hasn't seen yet)
- Enables "mutual match" celebration moment
- Reduces notification noise (only notify on mutual match)

### Scoring threshold of 60%
- Below 60% means significant skill gaps or experience mismatch
- Can be adjusted based on match accept rates
- Consider A/B testing different thresholds

## Open Questions for Implementation

1. **Should skipped matches reappear after X days?**
   - Suggestion: Yes, after 7 days if leg still open

2. **Max matches per user per day?**
   - Suggestion: 10 for crew, 20 per leg for owners

3. **Should owners be able to "invite" crew directly?**
   - Current plan: No, keep it mutual to reduce spam

4. **Match expiration policy?**
   - Suggestion: Expire 24 hours before leg start_date
<!-- SECTION:NOTES:END -->
