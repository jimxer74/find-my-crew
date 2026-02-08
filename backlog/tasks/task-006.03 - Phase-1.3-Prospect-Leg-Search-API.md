---
id: TASK-006.03
title: 'Phase 1.3: Prospect Leg Search API'
status: In Progress
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-08 17:58'
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
- [ ] #1 API returns matching legs without authentication
- [ ] #2 Search filters by date range, location, experience level
- [ ] #3 Results include match score based on preferences
- [ ] #4 Returns data in format suitable for AI inline references
- [ ] #5 Respects RLS (only published journeys returned)
<!-- AC:END -->
