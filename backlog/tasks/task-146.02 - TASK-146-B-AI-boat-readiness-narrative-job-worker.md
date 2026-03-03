---
id: TASK-146.02
title: 'TASK-146-B: AI boat readiness narrative job worker'
status: To Do
assignee: []
created_date: '2026-03-03 15:52'
labels: []
dependencies: []
parent_task_id: TASK-146
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New async job type `generate-boat-readiness-narrative` in the ai-job-worker edge function. Reads boat maintenance tasks, equipment with service dates, year_built, and journey risk_level. Generates a plain-language paragraph (2-4 sentences) about vessel readiness. Stores result as `readiness_narrative` text on the `journeys` table. Triggered when a journey is published. Zero skipper effort required.
<!-- SECTION:DESCRIPTION:END -->
