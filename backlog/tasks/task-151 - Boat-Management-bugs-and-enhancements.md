---
id: TASK-151
title: Boat Management bugs and enhancements
status: In Progress
assignee: []
created_date: '2026-03-05 08:48'
updated_date: '2026-03-06 08:28'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**General UI**:
BUG:  Badge dark colors do not work properly: update Badge dark colors to use glassmorphism style, so that they appear glass like, with clear color signals for both dark, and light themes
- Change Edit, Delete etc link buttons to similar icons with text as in /owner/journeys page (icon with text) update also /owner/journeys page to include both Icon and text
- Crosscheck to whole platform and update all similar kind of Card link buttons to use the same "Icon + text" appoach.

**Equipment view**
- Change the "Active" status display, remove the badge. Instead color the left border of card with status color (e.g. green with active). Make the left border a tad wider to better communicate the status
- Change the equipmet cards narrower, so that in mobile view 2 cards fit in row. Use swipeable carousel concept, simila as in /crew for leg cards. so that user can scroll the cards to right to see more

**Maitenance -view**
- BUG: the Recurring interval is not working properly, it displays a task to be recurring, but when opening edit mode it does not show recurring information. Also when completing a recurring task it should create another one with recurring interval, but it did not work allways.
- Remove critical, high etc. priority badge from the card, instead display the criticality in coloring the left side boder with approriate criticality color, make the left border wider
- Change task cards to narrow format similar as equipment cards, truncate content if neccessary
- Remove state badge from Task card
- Change tasks statuses to: Todo, Planned, In progress, Done
- Status logic: Todo = if it has not been started and no Due date has been set, Planned = Due date set, but not started, In Progress = task is started, Done = Task is marked as completed
- Change the card button actions to state sensitive e.g. Todo and Planned tasks = Start, In progress tasks = Complete  
- Remove the category dropdown

Desktop: 
- change the layout to 4 column Kanban style layout, by the state (Todo, Planned, In Progress, Done) and display the tasks in column based on the task status. Make state columns collapsible and by default minimize the "Done" column. 
- remove Status selection / drop down
- List tasks by equipment groups, similar as equipments are listed by categories.

Mobile:
- list task cards two in row, grouped by the equipment, make use the swipeable carousel concept similar as in /crew for leg cards so that user can swipe cards to right to see more. Sort by due date and criticality first
- remove state dropdown, instead display clickable state badges
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Session progress (2026-03-06)

### Completed:
1. **Badge glassmorphism** - Updated `shared/ui/Badge/Badge.tsx` with semi-transparent backgrounds, borders, and backdrop-blur in dark mode for all variants (primary, secondary, success, warning, error, info). Both solid and outlined variants updated.
2. **Maintenance recurrence bug fix** - `MaintenanceForm.tsx`: added `custom_usage` option for non-preset engine-hour intervals; fixed useEffect to properly map all usage recurrence values back to the form.
3. **Maintenance service recurrence fix** - `maintenance-service.ts`: `completeMaintenanceTask` now creates next occurrence for both `time` and `usage` recurrence types.
4. **New maintenance status system** - Added `MaintenanceDisplayStatus` type and `getDisplayStatus()` helper to `types.ts`. Maps DB statuses (pending/in_progress/completed/skipped) to display statuses (todo/planned/in_progress/done) based on presence of due_date.
5. **MaintenanceList full redesign** - Complete rewrite:
   - Desktop: 4-column Kanban (Todo/Planned/In Progress/Done), collapsible columns, Done collapsed by default, grouped by equipment within columns
   - Mobile: clickable status filter badges + swipeable 2-per-row carousels grouped by equipment
   - Cards: priority left border (4px, colored by priority), icon+text action buttons (Start/Complete based on status, Edit, Delete)
   - Removed: status badge, priority badge, category badge, status dropdown, category dropdown
   - Added: `onStart` prop (sets status to in_progress), `equipment` prop for name lookup
6. **Maintenance page updated** - Added `handleStart()` handler, passes `equipment` and `onStart` to `MaintenanceList`.
7. **EquipmentList redesign** - Complete rewrite:
   - Removed Active/status badge from cards
   - Added `border-l-4` left border with status color (green=active, yellow=needs_replacement, gray=decommissioned)
   - Category groups now use horizontal swipeable carousels (2 cards wide on mobile, fixed 260px on desktop)
   - Icon+text Edit/Delete buttons on cards

### Build: PASSING
<!-- SECTION:NOTES:END -->
