---
id: TASK-006.03
title: 'Phase 1.3: Prospect Leg Search API'
status: Done
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-08 18:00'
labels:
  - api
  - search
  - phase-1
dependencies: []
parent_task_id: TASK-006
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create an API endpoint that allows the AI to search for matching legs based on prospect preferences.

**Depends on:** TASK-006.02 (Prospect Chat)

**New API Endpoint:**
- `app/api/ai/prospect/legs/route.ts`
- No authentication required (public read access to published legs)
- Accepts search parameters extracted from conversation

**Search Parameters:**
- `dateRange`: { start: Date, end: Date }
- `locations`: string[] (departure/arrival locations)
- `riskLevel`: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing'
- `experienceLevel`: 1-4
- `skills`: string[]

**Response Format:**
```typescript
{
  legs: Array<{
    id: string;
    name: string;
    journeyName: string;
    startDate: string;
    endDate: string;
    departureLocation: string;
    arrivalLocation: string;
    crewNeeded: number;
    matchScore: number; // 0-100 based on preference match
  }>;
}
```

**AI Tool Definition:**
- Add `searchLegsForProspect` tool to AI assistant
- Returns formatted leg references for inline display
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 API returns matching legs without authentication
- [x] #2 Search filters by date range, location, experience level
- [x] #3 Results include match score based on preferences
- [x] #4 Returns data in format suitable for AI inline references
- [x] #5 Respects RLS (only published journeys returned)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete (2026-02-08)

**File Created:**
- `app/api/ai/prospect/legs/route.ts`

**Endpoints:**
- GET `/api/ai/prospect/legs` - Query params: startDate, endDate, locations, riskLevel, experienceLevel, skills, limit
- POST `/api/ai/prospect/legs` - Request body with preferences object

**Features:**
- No authentication required
- Only returns legs from published journeys
- Filters by: date range, locations, risk level, experience level
- Match score calculation (0-100) based on preference alignment
- Returns sorted by match score (highest first)

**Match Score Factors:**
- Date alignment (+15 points)
- Experience level fit (+15 points)
- Risk level match (+15 points)
- Location match (+15 points)
- Crew availability bonus (+3-5 points)

**Note:** AI tools in prospect chat service already call leg search directly. This standalone endpoint enables direct programmatic access.
<!-- SECTION:NOTES:END -->
