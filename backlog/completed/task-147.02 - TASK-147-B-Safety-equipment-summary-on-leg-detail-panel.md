---
id: TASK-147.02
title: 'TASK-147-B: Safety equipment summary on leg detail panel'
status: Done
assignee: []
created_date: '2026-03-03 15:53'
updated_date: '2026-03-03 16:07'
labels: []
dependencies: []
parent_task_id: TASK-147
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a "Safety Equipment" section to LegDetailsPanel (crew-facing voyage detail). Shows key safety items (life raft, EPIRB, flares, life jackets, fire extinguishers) with status badges: ✓ In date, ⚠ Overdue, — Not declared. Sources data from the boat's equipment records (category=safety) via the leg→journey→boat relationship.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented safety equipment summary on voyage detail panel:
- LegDetailsPanel: added SafetyEquipmentItem type, safetyEquipment state, fetchJourneyDetails useEffect sets safety equipment from extended API response
- Safety Equipment Summary section displays each item with status badge: in-date (green), overdue (red), due-soon (amber, within 30 days), expiring-soon (amber, within 30 days for expiry_date), declared (gray if no dates)
- API route /api/journeys/[journeyId]/details extended to fetch and return boat's safety equipment array
<!-- SECTION:FINAL_SUMMARY:END -->
