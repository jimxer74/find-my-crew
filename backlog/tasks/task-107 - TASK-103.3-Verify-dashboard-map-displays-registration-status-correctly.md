---
id: TASK-107
title: 'TASK-103.3: Verify dashboard map displays registration status correctly'
status: To Do
assignee: []
created_date: '2026-02-17 11:01'
labels:
  - dashboard
  - map
  - ui
  - TASK-103-remaining
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Verify that the crew dashboard map correctly displays leg registration status as pending/approved with appropriate visual indicators.

Currently:
- Map may not show registration status
- Need to verify status display for legs with pending/approved registrations
- May need visual distinction (color, badge, icon)

Required Changes:
- Check `/crew/dashboard` and map component implementation
- Ensure legs show registration status visually:
  - Pending approval (yellow/orange indicator)
  - Approved (green indicator)
- Add or verify status badges on map markers/cards
- Test with sample data showing different registration statuses
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pending registration status visible on dashboard map
- [ ] #2 Approved registration status visible on dashboard map
- [ ] #3 Status indicators are visually distinct
- [ ] #4 Status updates correctly after registration
<!-- AC:END -->
