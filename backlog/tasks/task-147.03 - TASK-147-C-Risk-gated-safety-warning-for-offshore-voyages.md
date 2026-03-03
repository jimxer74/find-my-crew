---
id: TASK-147.03
title: 'TASK-147-C: Risk-gated safety warning for offshore voyages'
status: Done
assignee: []
created_date: '2026-03-03 15:53'
updated_date: '2026-03-03 16:10'
labels: []
dependencies: []
parent_task_id: TASK-147
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the journey/leg management UI, when risk_level is 'Offshore sailing' or 'Extreme sailing', show a non-blocking advisory banner if critical safety equipment (life raft, EPIRB) has no records or is overdue. Advisory only — does not prevent publishing. Helps skippers notice gaps before crew can see them.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented risk-gated safety warning for offshore voyages in the journey edit page:
- Added boatSafetyEquipment state
- useEffect fetches boat's safety equipment (category='safety') when boat_id changes
- Inline advisory banner rendered after the risk level radios when risk is Offshore/Extreme sailing
- Checks for: missing life raft (subcategory='life_raft'), missing EPIRB (subcategory='epirb'), any overdue service/expiry dates
- Banner links to /owner/boats for remediation; advisory only, does not block publishing
- Dark mode compatible (amber-950/amber-800 dark variants)
<!-- SECTION:FINAL_SUMMARY:END -->
