---
id: TASK-118.05
title: Z-Index Management & Overlay System
status: To Do
assignee: []
created_date: '2026-02-18 21:10'
labels:
  - Z-Index
  - Overlays
  - Consistency
dependencies: []
parent_task_id: TASK-118
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish centralized Z-index scale and refactor all modals, dropdowns, and overlays to use consistent layering throughout the application.

## Scope
Create a consistent z-index system that prevents stacking context issues and ensures predictable layering of UI elements. This reduces maintenance burden and ensures overlays always appear in the correct order.

## What This Task Produces
- Z-index scale definition with semantic names
- Z-index utilities/constants module
- All modals using centralized scale
- All dropdowns/popovers using scale
- Resolved stacking context issues
- Documentation on proper z-index usage

## Dependencies
- **Depends on**: TASK-118.03 (Core Generic Components Library)
- This task ensures core components (Modal, Dialog, Dropdown) use consistent z-index values

## Z-Index Scale Example
```
base: 10
dropdown: 20
sticky: 25
modal: 30
toast: 40
tooltip: 50
```

## Key Responsibilities
1. Define z-index scale with semantic naming
2. Create TypeScript constants or utilities for z-index values
3. Update Modal component to use centralized scale
4. Update Dialog component to use centralized scale
5. Update Dropdown/Popover components to use scale
6. Update Toast/Notification components to use scale
7. Audit all other elements using z-index and update them
8. Test stacking context with multiple overlays
9. Document z-index usage guidelines
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Z-index scale defined with semantic naming (base, dropdown, sticky, modal, toast, tooltip, etc.)
- [ ] #2 Z-index utility/constants module created and exported
- [ ] #3 All Modal components updated to use centralized z-index scale
- [ ] #4 All Dialog components updated to use centralized z-index scale
- [ ] #5 All Dropdown/Popover components updated to use centralized z-index scale
- [ ] #6 All Toast/Notification components updated to use centralized z-index scale
- [ ] #7 Z-index conflicts resolved - no overlapping values causing visual issues
- [ ] #8 Multiple overlays tested to verify correct stacking order
- [ ] #9 Z-index usage guidelines documented with examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All components using z-index reviewed for consistency
- [ ] #2 No z-index conflicts remain in application
- [ ] #3 Documentation includes common patterns and edge cases
<!-- DOD:END -->
