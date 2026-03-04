---
id: TASK-146.01
title: 'TASK-146-A: Pre-voyage seaworthiness declaration form'
status: Done
assignee: []
created_date: '2026-03-03 15:52'
updated_date: '2026-03-03 16:07'
labels: []
dependencies: []
parent_task_id: TASK-146
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a structured seaworthiness declaration to journey creation/editing. Fields: rigging last inspected (date + optional doc upload), engine last serviced (date + hours), steering last serviced (date), autopilot operational (Y/N), nav instruments operational (Y/N), power budget (installed watts). 

Store on `journeys` table as JSONB column `seaworthiness_declaration`. Show to crew on LegDetailsPanel under "Skipper's pre-departure declaration" section.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented pre-voyage seaworthiness declaration form:
- DB migration 057: added seaworthiness_declaration JSONB + readiness_narrative text to journeys
- Journey edit page: new "Vessel Readiness Declaration" CollapsibleSection (section 5) with rigging/engine/steering dates, hours, power watts, autopilot/nav instrument Y/N/N/A radio inputs
- LegDetailsPanel: displays readiness declaration in "Vessel Readiness" section with table of all declared fields + service dates + advisory badges
- API route /api/journeys/[journeyId]/details extended to return seaworthiness_declaration and readiness_narrative
<!-- SECTION:FINAL_SUMMARY:END -->
