---
id: TASK-146.01
title: 'TASK-146-A: Pre-voyage seaworthiness declaration form'
status: In Progress
assignee: []
created_date: '2026-03-03 15:52'
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
