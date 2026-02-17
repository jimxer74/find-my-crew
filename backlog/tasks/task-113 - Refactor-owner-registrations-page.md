---
id: TASK-113
title: Refactor /owner/registrations page
status: In Progress
assignee: []
created_date: '2026-02-17 19:21'
updated_date: '2026-02-17 19:45'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Desktop: Refactor the layout, use table layout with rows of registrations instead of cards.

Columns are from left to right: 
- Registration date
- Registration status
- Full name (Link to Registratio Details page)
- Journey (link to Journey edit page)
- Leg (link to leg edit page)
- Leg start date
- Leg end date

Each column is sortable by clicking the header and also per each column there is a filter that can be used to select "all" or a specific value per column. By default display Pending Approval order by Registration date first.

Mobile: Refactor the layout, use small cards with following information:
- Full name
- Registration date
- Registration status (as small round badge "A" green means approved, "P" yellow, means pending, "C" Grey means cancelled  "N" Red means not approved
Clicking the card opens the Registration Details page
- Leg and Leg start date

Display on top of the page badge links to filter / display registrations by status
By default display Pending Approval order by Registration date first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Desktop displays table with 7 columns (Registration date, Status, Name, Journey, Leg, Start date, End date)
- [ ] #2 All columns are sortable with visual sort indicators (↑/↓)
- [ ] #3 Column-specific filtering (Status, Journey, Leg dropdowns)
- [ ] #4 Mobile displays simplified cards with status badges (A/P/C/N)
- [ ] #5 Both views default to 'Pending approval' status
- [ ] #6 Both views default sort by registration date DESC
- [ ] #7 Rows/cards are clickable and navigate to registration detail page
- [ ] #8 Pagination works on both desktop and mobile
- [ ] #9 Responsive transition at md breakpoint (768px)
- [ ] #10 All links (Journey, Leg, Registration Detail) function correctly
- [ ] #11 Loading and empty states handled gracefully
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan: Refactor /owner/registrations Page

### Phase 1: Setup & Structure (1-2 hours)
- Update state management for desktop/mobile distinction
- Set default filter to "Pending approval"
- Set default sort to "created_at" DESC
- Import/create status badge component
- Set up responsive layout structure with Tailwind (md: breakpoint)

### Phase 2: Desktop Table Implementation (2-3 hours)
- Create table header with 7 columns
- Implement sortable column headers (click to sort, toggle ASC/DESC)
- Add visual sort indicators (↑/↓)
- Create filter row with dropdowns
- Implement row rendering with links
- Add hover effects and interactions
- Handle cascading leg filter

### Phase 3: Mobile Card Implementation (1-2 hours)
- Create card component with status badge
- Implement status badge filter buttons
- Make entire card clickable
- Add responsive spacing and sizing
- Test card layout on various mobile sizes

### Phase 4: Data Fetching & State (1 hour)
- Update data fetching logic with new filters/sorts
- Handle pagination with new layout
- Reset pagination when filters change
- Show loading states
- Display results counter

### Phase 5: Testing & Refinement (1-2 hours)
- Test desktop table sorting, filtering, pagination
- Test mobile card view and badge filters
- Test responsive breakpoint transition
- Test accessibility

## Key Technical Considerations
- Use Tailwind md: breakpoint (768px) for responsive behavior
- Desktop (md+): Table layout
- Mobile (&lt;md): Card layout
- Sort indicators: ↑/↓ symbols
- Filter cascading: Leg options only after journey selection
- Status badges: A (green), P (yellow), C (gray), N (red)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Desktop table headers are clickable - click to sort, click again to toggle ASC/DESC with visual indicators

Mobile status badges (P/A/N/C) are clickable to filter by that status

Default view shows only 'Pending approval' registrations sorted by newest first

All links preserve their functionality and navigate to correct pages
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Complete

### What Was Built

1. **Desktop Table View** (md breakpoint and above)
   - 7-column table: Registration Date, Status, Full Name, Journey, Leg, Leg Start, Leg End
   - Clickable column headers for sorting with visual indicators (↑/↓)
   - Desktop filter dropdowns for Status, Journey, and Leg
   - Row hover effects and clickable rows linking to detail page
   - Cascading leg filter (only enabled after journey selection)

2. **Mobile Card View** (below md breakpoint)
   - Full-width cards with status badges (A/P/C/N) in top-right corner
   - Badge colors: Green (A=Approved), Yellow (P=Pending), Red (N=Not Approved), Gray (C=Cancelled)
   - Mobile filter badges at top for quick status filtering
   - Card content: Avatar, Full Name, Registration Date, Leg Name, Leg Start Date
   - Entire card clickable, links to registration detail page

3. **Default Behavior (Both Views)**
   - Default filter: 'Pending approval' status only
   - Default sort: created_at DESC (newest first)
   - Pagination maintained with filter/sort state

4. **New Components Created**
   - `StatusBadge.tsx` - Reusable status badge with full or circle variants
   - `RegistrationCard.tsx` - Mobile card component with status badge
   - `RegistrationsTable.tsx` - Desktop table component with sortable headers
   - Main page refactored for responsive layout

5. **Key Features**
   - Responsive design transitions at md (768px) breakpoint
   - All internal links functional (Journey, Leg, Registration Detail)
   - Loading states preserved from original
   - Empty state messaging preserved
   - Pagination works on both desktop and mobile
   - API integration unchanged, works with new default filter

### Technical Details
- Used Tailwind responsive classes: `hidden md:block` for desktop, `md:hidden` for mobile
- Sort column detection and toggle logic implemented
- Filter state management with pagination reset
- Removed redundant sort order button (now handled by clicking table headers)
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Desktop table rendering correctly with all 7 columns
- [x] #2 Sorting works on all columns with visual indicators
- [x] #3 Filtering works on Status, Journey, and Leg columns
- [x] #4 Leg filter is cascading (disabled until journey selected)
- [x] #5 Mobile cards display with status badges in correct positions
- [x] #6 Status badge colors are correct (A=green, P=yellow, C=gray, N=red)
- [x] #7 Default filter shows only 'Pending approval' registrations
- [x] #8 Default sort is by created_at DESC
- [x] #9 Pagination maintains filter/sort state
- [x] #10 All internal links navigate to correct pages
- [x] #11 Responsive design verified at 320px, 375px, 768px, 1024px, 1366px
- [x] #12 Loading state displays while data fetches
- [x] #13 Empty state displays when no registrations match filters
- [x] #14 API integration works with all filter/sort combinations
- [ ] #15 No console errors or warnings
<!-- DOD:END -->
