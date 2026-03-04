---
id: TASK-146.03
title: 'TASK-146-C: Boat offshore experience fields'
status: Done
assignee: []
created_date: '2026-03-03 15:53'
updated_date: '2026-03-03 16:07'
labels: []
dependencies: []
parent_task_id: TASK-146
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `miles_on_vessel` (numeric, nullable) and `offshore_passage_experience` (boolean, default false) to the `boats` table. Add to BoatFormModal and boat profile display. Show on LegDetailsPanel in the boat details section.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented boat offshore experience fields:
- DB migration 057: added miles_on_vessel (numeric) and offshore_passage_experience (boolean) to boats table
- BoatFormModal: type definition, initial state, loadBoat, handleSubmit, handleChange (miles_on_vessel as numeric), and form UI fields ("Nautical Miles on this Vessel" number input + "This vessel has completed offshore passages" checkbox)
- LegDetailsPanel: displays boat_miles_on_vessel and boat_offshore_passage_experience as badges in Vessel Readiness section
- API route /api/journeys/[journeyId]/details extended to return both fields
<!-- SECTION:FINAL_SUMMARY:END -->
