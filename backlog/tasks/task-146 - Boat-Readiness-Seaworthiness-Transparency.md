---
id: TASK-146
title: Boat Readiness & Seaworthiness Transparency
status: Done
assignee: []
created_date: '2026-03-03 15:52'
updated_date: '2026-03-03 16:10'
labels:
  - trust
  - safety
  - boat-readiness
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the full Boat Readiness & Seaworthiness Transparency feature set so that crew browsing voyage listings can see meaningful, structured readiness information before committing to a passage — rather than relying on a skipper's unverified self-description.

## Context
From safety-trust-features-analysis.md Section 2. The platform currently tracks equipment and maintenance per boat but none of this is visible to crew. The journey/leg detail page shows boat name and images only.

## Sub-tasks (create as children)
- **A. Pre-voyage seaworthiness declaration** — Structured declaration form in voyage editing (rigging last inspected, engine/steering service dates, autopilot/nav instruments operational, power budget). Stored per-journey and shown to crew on the leg detail panel.
- **B. AI boat readiness narrative** — Async job worker that synthesises existing maintenance records + year_built into a plain-language readiness paragraph. Zero skipper effort; uses data already in the system. Stored on journeys table, displayed on leg detail.
- **C. Boat offshore experience fields** — Add `miles_on_vessel` (numeric) and `offshore_passage_experience` (boolean) to the boats table. Shown on boat profile and leg detail.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Skipper can fill seaworthiness declaration when creating/editing a journey
- [ ] #2 Declaration fields are shown to crew in the leg detail panel under a "Skipper's pre-departure declaration" section
- [ ] #3 AI readiness narrative is generated (or regenerated) when a voyage is published
- [ ] #4 Readiness narrative shown on leg detail panel
- [ ] #5 `miles_on_vessel` and `offshore_passage_experience` fields added to boat profile form and shown on leg detail
- [ ] #6 All new DB columns covered by a migration file and specs/tables.sql updated
<!-- SECTION:DESCRIPTION:END -->

<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All subtasks complete. DB migration 057 adds seaworthiness_declaration, readiness_narrative, miles_on_vessel, offshore_passage_experience columns. Journey edit page has full seaworthiness declaration form. BoatFormModal has vessel experience fields. LegDetailsPanel shows readiness info to crew.
<!-- SECTION:FINAL_SUMMARY:END -->
