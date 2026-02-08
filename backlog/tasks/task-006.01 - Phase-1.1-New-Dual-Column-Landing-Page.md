---
id: TASK-006.01
title: 'Phase 1.1: New Dual-Column Landing Page'
status: In Progress
assignee: []
created_date: '2026-02-08 17:43'
updated_date: '2026-02-08 17:45'
labels:
  - ui
  - landing-page
  - phase-1
dependencies: []
parent_task_id: TASK-006
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a new landing page at `/welcome` (or `/start`) with:

**Layout:**
- Full-screen dual-column layout (no header)
- Background image with transparent color overlays for each column
- Left column: Owner/Skipper value proposition (placeholder for future)
- Right column: Crew value proposition with CTA button
- Footer visible with legal links (Terms, Privacy)
- Login button in top-right corner

**Mobile Responsive:**
- Vertically stacked layout
- Crew section first (primary target), then Owner section
- Full-width columns

**Components to Create:**
- `app/welcome/page.tsx` - Main landing page
- Reuse existing `Footer` component
- New `WelcomeLandingLayout` component

**Design Notes:**
- Use existing background image `/homepage-2.jpg`
- Apply different transparent color layers (e.g., blue tint for crew, warm tint for owner)
- Clear, compelling value proposition text
- Prominent "Find Your Next Sailing Adventure" CTA button for crew
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dual-column layout displays correctly on desktop (>768px)
- [ ] #2 Single-column stacked layout on mobile (<768px)
- [ ] #3 No header/navigation visible
- [ ] #4 Footer with legal links always visible
- [ ] #5 Login button accessible
- [ ] #6 Crew CTA button navigates to prospect chat page
- [ ] #7 Background image with color overlays renders correctly
<!-- AC:END -->
