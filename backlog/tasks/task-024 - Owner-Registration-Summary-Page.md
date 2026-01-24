---
id: TASK-024
title: Owner Registration Summary Page
status: To Do
assignee: []
created_date: '2026-01-24 20:19'
updated_date: '2026-01-24 20:22'
labels: []
dependencies: []
references:
  - app/components/crew/LegDetailsPanel.tsx
  - 'app/api/registrations/[registrationId]/route.ts'
  - app/lib/ai/assessRegistration.ts
  - app/lib/notifications/service.ts
  - app/owner/registrations/page.tsx
  - 'app/owner/journeys/[journeyId]/registrations/page.tsx'
  - specs/tables.sql
  - specs/functions.sql
documentation:
  - app/components/crew/SkillsMatchingDisplay.tsx
  - app/types/experience-levels.ts
  - app/config/risk-levels-config.json
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A dedicated registration summary page for boat owners to view and manage a single crew registration. This page provides a comprehensive view of the registration details and enables approve/deny actions.

**Page Route**: `/owner/registrations/[registrationId]`

**Entry Points** (update notification links and UI to point here):
1. From notification click (new_registration, ai_review_needed, ai_auto_approved types)
2. From "My Crew Registrations" list (`/owner/registrations`) - clicking status badge
3. From Journey map left pane - clicking status badge on registration card

## Data to Display

### Registration Status Section
- Current status badge (Pending approval, Approved, Not approved, Cancelled)
- Auto-approved indicator if `auto_approved = true`
- Registration date (`created_at`)

### Crew Information Section
- Crew avatar (from `profiles.profile_image_url`)
- Crew full name (from `profiles.full_name` or `profiles.username`)
- Registration date

### Journey & Leg Information Section
- Journey name and date range (start_date, end_date)
- Leg name
- Leg start/end waypoint names with dates
- Leg distance (calculated using Haversine formula, same as `LegDetailsPanel.tsx:129-144`)
- Leg duration (calculated from distance with boat avg speed at 75% efficiency, same as `LegDetailsPanel.tsx:149-173`)

### Requirements Section
- Risk level with icon (use `getRiskLevelConfig()` pattern from `LegDetailsPanel.tsx`)
- Minimum experience level with icon (use `getExperienceLevelConfig()`)
- Required skills list

### Skills Matching Section
- Display using `SkillsMatchingDisplay` component pattern
- Show leg/journey required skills vs crew skills
- Calculate match percentage

### AI Assessment Section (if exists)
- AI match score (`ai_match_score`) with visual indicator (percentage bar)
- AI reasoning text (`ai_match_reasoning`)
- Only display if `ai_match_score` is not null

### Registration Requirements Q&A Section
- List all questions from `journey_requirements` with crew answers from `registration_answers`
- Support different question types: text, yes_no, multiple_choice
- Display in Q&A format

### Additional Notes Section
- Crew's additional notes (`registrations.notes`)

## Actions

### Approve Button
- Only visible when status is "Pending approval"
- Calls `PATCH /api/registrations/[registrationId]` with `{ status: 'Approved' }`
- Shows success message and updates UI
- Triggers notification to crew member

### Deny Button
- Only visible when status is "Pending approval"
- Opens confirmation dialog with optional reason textarea
- Calls `PATCH /api/registrations/[registrationId]` with `{ status: 'Not approved', notes: reason }`
- Shows success message and updates UI
- Triggers notification to crew member

## Technical Notes

### Data Fetching
- Create new API endpoint `GET /api/registrations/[registrationId]/details` that returns:
  - Registration with status, notes, created_at, ai_match_score, ai_match_reasoning, auto_approved
  - Crew profile with name, avatar, skills, experience level
  - Leg details with waypoints, dates, skills, risk_level, min_experience_level
  - Journey details with name, dates, boat info (for speed calculation)
  - Boat details with name, average_speed_knots
  - Journey requirements with crew's answers

### Authorization
- Only the boat owner can access this page
- Verify through: registration → leg → journey → boat → owner_id === current user

### UI Pattern
- Follow `LegDetailsPanel.tsx` for visual styling and component structure
- Use existing components: `SkillsMatchingDisplay`, experience level icons, risk level icons
- Responsive design: full-width on mobile, constrained width on desktop
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Page loads registration details including crew info, journey/leg info, and requirements Q&A
- [ ] #2 Risk level and experience level display with correct icons and styling
- [ ] #3 Skills matching shows required skills vs crew skills with match percentage
- [ ] #4 AI assessment section displays score and reasoning when available
- [ ] #5 Approve button updates status to Approved and shows success feedback
- [ ] #6 Deny button shows confirmation dialog with reason field, updates status to Not approved
- [ ] #7 Page is only accessible to the boat owner (returns 403 for others)
- [ ] #8 Notification links correctly navigate to this page with registration ID
- [ ] #9 Status badge click in /owner/registrations navigates to this page
- [ ] #10 Status badge click in journey map pane navigates to this page
- [ ] #11 Page is responsive and works on mobile devices
- [ ] #12 Loading and error states are handled gracefully
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: API Endpoint
1. Create `app/api/registrations/[registrationId]/details/route.ts`
   - GET endpoint returning comprehensive registration data
   - Include authorization check (owner verification)
   - Join: registrations → legs → journeys → boats → profiles
   - Include journey_requirements and registration_answers
   - Include waypoints for distance calculation

### Phase 2: Page Component
2. Create `app/owner/registrations/[registrationId]/page.tsx`
   - Fetch data from details API
   - Implement all display sections per description
   - Use LegDetailsPanel patterns for:
     - Risk level display with getRiskLevelConfig
     - Experience level display with getExperienceLevelConfig  
     - Distance/duration calculation
   - Integrate SkillsMatchingDisplay component

### Phase 3: Actions
3. Implement approve/deny functionality
   - Approve: PATCH call, success feedback, UI update
   - Deny: Confirmation dialog with reason, PATCH call, feedback
   - Reuse existing PATCH endpoint

### Phase 4: Navigation Updates
4. Update notification links
   - Change `/owner/registrations?registration=X` to `/owner/registrations/X`
   - Update in: notifications/service.ts, assessRegistration.ts

5. Update registration list navigation
   - `/owner/registrations/page.tsx`: Status badge click → navigate to detail page
   - `/owner/journeys/[journeyId]/registrations/page.tsx`: Same update

### Phase 5: Polish
6. Responsive design and edge cases
   - Mobile layout optimization
   - Loading skeleton
   - Error states
   - Empty states (no AI assessment, no requirements, etc.)
<!-- SECTION:PLAN:END -->
