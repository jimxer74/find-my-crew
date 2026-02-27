---
id: TASK-142
title: New Async Owner AI Onboarding Flow with Equipment & Journey Creation
status: To Do
assignee: []
created_date: '2026-02-27 18:53'
labels:
  - onboarding
  - ai
  - async
  - owner
  - boat-management
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Overview

Add a **new** async-based owner onboarding flow alongside the existing one. The existing flow must remain intact and unchanged as a fallback. The new flow uses the async job infrastructure for heavy AI operations (equipment generation, journey creation) and presents structured confirmation checkpoints before saving any data.

**DO NOT modify or delete the existing onboarding flow.**

---

## Core Principles

1. **Pre-signup is always synchronous** — gathering info via AI chat is fast; the DB isn't involved yet
2. **Post-signup heavy AI work runs in background** — equipment generation, journey generation use async jobs with real-time progress
3. **User explicitly confirms before each save** — profile, boat, equipment, journey
4. **Required saves**: owner profile + boat (can't skip these once committed)
5. **Optional saves**: equipment/maintenance tasks, first journey

---

## Conversation Flow & Confirmation Checkpoints

### Phase 1 — Pre-signup (synchronous AI chat)

AI gathers in a single conversational flow:
- Owner name, sailing experience, preferred sailing regions
- Boat make/model, LOA, home port, build year
- Optional: any planned journey (route, dates)
- Optional: sailing preferences / crew requirements

At the end: AI presents a brief summary and prompts signup ("Ready to create your account?").

### Phase 2 — Post-signup confirmation loop

Each checkpoint is a structured UI card (not just chat text) with Accept / Edit / Skip:

**Checkpoint 1 — Profile**
```
┌──────────────────────────────────────────────┐
│ Your sailor profile                          │
│  Name: [name]                                │
│  Experience: [level]                         │
│  Preferred regions: [regions]                │
│                                              │
│  [Looks good, save it]  [Edit]               │
└──────────────────────────────────────────────┘
```
→ On confirm: synchronous profile upsert (fast, no job needed)

**Checkpoint 2 — Boat**
```
┌──────────────────────────────────────────────┐
│ Your boat                                    │
│  Make/model: [make_model]                    │
│  Built: [year_built]   LOA: [loa_m]m         │
│  Home port: [home_port]                      │
│                                              │
│  [Looks good, save it]  [Edit]               │
└──────────────────────────────────────────────┘
```
→ On confirm: synchronous boat insert, get boatId

**Checkpoint 3 — Equipment & Maintenance (optional)**
```
┌──────────────────────────────────────────────┐
│ Generate equipment list & maintenance tasks? │
│  AI will search manufacturer specs for       │
│  [make_model] and build a verified list.     │
│  Takes 30–90 seconds in the background.      │
│                                              │
│  [Yes, generate]  [Skip for now]             │
└──────────────────────────────────────────────┘
```
→ On confirm: submit `generate-boat-equipment` async job → show JobProgressPanel → on complete: show NewBoatWizardStep3 review UI (existing component, reuse)

**Checkpoint 4 — First Journey (optional)**
```
┌──────────────────────────────────────────────┐
│ Create your first journey?                   │
│  From: [start] → To: [end]                   │
│  Dates: [dates]                              │
│  [if no journey info collected: "Tell me     │
│   about a journey you're planning"]          │
│                                              │
│  [Yes, create journey]  [Skip]               │
└──────────────────────────────────────────────┘
```
→ On confirm: submit `generate-journey` async job → show JobProgressPanel → redirect to journey edit on complete

---

## Architecture

### New files to create

| File | Purpose |
|------|---------|
| `app/components/onboarding/OwnerOnboardingV2.tsx` | Top-level orchestrator component |
| `app/components/onboarding/OnboardingChat.tsx` | Pre-signup AI chat panel (sync) |
| `app/components/onboarding/CheckpointCard.tsx` | Reusable confirmation card UI |
| `app/components/onboarding/ProfileCheckpoint.tsx` | Profile confirm/edit checkpoint |
| `app/components/onboarding/BoatCheckpoint.tsx` | Boat confirm/edit checkpoint |
| `app/components/onboarding/EquipmentCheckpoint.tsx` | Equipment async generation checkpoint |
| `app/components/onboarding/JourneyCheckpoint.tsx` | Journey async creation checkpoint |
| `app/api/onboarding/v2/chat/route.ts` | AI chat endpoint for pre-signup gathering |
| `app/api/onboarding/v2/extract/route.ts` | Parse structured data from conversation |

### Entry point

Add a feature flag or route parameter to the existing onboarding page:
- `/welcome/owner?v=2` → renders `OwnerOnboardingV2`
- `/welcome/owner` (no param) → existing flow (unchanged)

OR add a separate route `/welcome/owner-v2` for A/B testing.

### Reused existing components

- `JobProgressPanel` from `@shared/components/async-jobs` — real-time job progress
- `NewBoatWizardStep3` — equipment review UI (reuse after async job completes)
- `submitJob` from `@shared/lib/async-jobs`
- `generate-boat-equipment` job type (already implemented)
- `generate-journey` job type (already implemented)

### State machine

```
pre_chat → awaiting_signup → post_signup →
  confirming_profile → saving_profile →
  confirming_boat → saving_boat →
  equipment_offer → equipment_generating → equipment_review →
  journey_offer → journey_generating →
  done
```

Each state persists to `sessionStorage` so a page refresh doesn't reset progress (post-signup only).

### AI chat API (pre-signup)

`POST /api/onboarding/v2/chat`
- Maintains conversation history in session
- System prompt: guides AI to gather the 6 key pieces of info
- Returns: `{ message, extractedData, isComplete }`
- `extractedData` is a partial JSON with whatever was mentioned so far
- `isComplete: true` when AI has enough to proceed to signup

`POST /api/onboarding/v2/extract`
- Takes full conversation transcript
- Returns fully structured `{ profile, boat, journey | null }`
- Called once when pre-signup phase completes

---

## AI Chat Prompt Strategy (Pre-signup)

System prompt instructs AI to:
1. Be conversational, not form-like
2. Gather: name, experience level, boat make/model, boat's home port, build year (optional but helpful), any planned journeys
3. Detect when enough info is collected → set `isComplete: true` in response metadata
4. NOT ask for email/password (that's handled by auth UI)
5. Keep conversation short — 4–6 exchanges max, then proceed

---

## Data Structures

```typescript
interface OnboardingProfile {
  displayName: string;
  experienceLevel?: number; // 1-5
  preferredRegions?: string[];
  aboutMe?: string;
}

interface OnboardingBoat {
  makeModel: string;
  homePort: string;
  yearBuilt?: number | null;
  loa_m?: number | null;
  type?: string | null;
}

interface OnboardingJourney {
  startLocation: { name: string; lat: number; lng: number };
  endLocation: { name: string; lat: number; lng: number };
  startDate?: string;
  endDate?: string;
}

interface OnboardingState {
  phase: OnboardingPhase;
  profile: OnboardingProfile | null;
  boat: OnboardingBoat | null;
  journey: OnboardingJourney | null;
  savedBoatId: string | null;
  equipmentJobId: string | null;
  journeyJobId: string | null;
}
```

---

## Implementation Phases

### Phase 1 — Foundation
1. Create route `/welcome/owner-v2` (or flag-based)
2. Create `OwnerOnboardingV2.tsx` with state machine
3. Create `CheckpointCard.tsx` reusable confirm UI

### Phase 2 — Pre-signup AI chat
4. Create `OnboardingChat.tsx` component
5. Create `POST /api/onboarding/v2/chat` route
6. Create `POST /api/onboarding/v2/extract` route

### Phase 3 — Post-signup checkpoints
7. `ProfileCheckpoint.tsx` — show, edit, save profile
8. `BoatCheckpoint.tsx` — show, edit, save boat (reuse boat registry lookup)

### Phase 4 — Async AI steps
9. `EquipmentCheckpoint.tsx` — submit job, show progress, show review (reuse `NewBoatWizardStep3` review UI)
10. `JourneyCheckpoint.tsx` — submit job, show progress, redirect

### Phase 5 — Integration & testing
11. State persistence to sessionStorage (post-signup phases)
12. End-to-end testing of happy path and all skip paths
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Existing owner onboarding flow (/welcome/owner) is completely unchanged
- [ ] #2 New flow accessible at /welcome/owner-v2 (or via feature flag)
- [ ] #3 Pre-signup AI chat gathers profile, boat, and optional journey info conversationally
- [ ] #4 Signup is triggered after AI determines enough info is collected
- [ ] #5 Checkpoint 1: Profile summary card with Confirm / Edit before saving
- [ ] #6 Checkpoint 2: Boat summary card with Confirm / Edit before saving
- [ ] #7 Checkpoint 3: Equipment offer card → async generate-boat-equipment job → NewBoatWizardStep3 review UI
- [ ] #8 Checkpoint 4: Journey offer card (or collect info if missing) → async generate-journey job
- [ ] #9 State survives page refresh post-signup (sessionStorage)
- [ ] #10 Skip works at every optional checkpoint (equipment, journey)
- [ ] #11 Profile and boat are required — cannot proceed past boat checkpoint without saving both
- [ ] #12 year_built is passed to equipment generation for age-aware assessment
<!-- AC:END -->
