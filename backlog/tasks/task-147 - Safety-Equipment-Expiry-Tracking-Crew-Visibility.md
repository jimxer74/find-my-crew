---
id: TASK-147
title: Safety Equipment Expiry Tracking & Crew Visibility
status: In Progress
assignee: []
created_date: '2026-03-03 15:52'
labels:
  - trust
  - safety
  - safety-equipment
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the boat equipment system with dedicated safety equipment expiry date tracking and surface a safety summary to crew on the voyage detail page.

## Context
From safety-trust-features-analysis.md Section 3. The equipment system already has a `safety` category and item types (life_raft, epirb, etc.) but no expiry/service date fields and nothing is shown to crew.

## Sub-tasks (create as children)
- **A. Expiry date fields on safety equipment** — Add `service_date`, `next_service_date`, and `expiry_date` columns to `boat_equipment`. Extend the equipment management UI (boat_equipment category=safety) to show/edit these fields. Flag overdue items visually.
- **B. Safety equipment summary on voyage detail** — Show crew a stripped-down safety snapshot on the leg detail panel: life raft (service status), EPIRB (registered Y/N), flares (in date Y/N), life jackets for full crew (Y/N). Sources from the boat's declared safety equipment records.
- **C. Risk-gated offshore safety warning** — When a voyage's risk_level is Offshore or Extreme, warn the skipper if safety equipment records are incomplete/overdue before they publish. Advisory, not blocking.

## Acceptance criteria
- [ ] `service_date`, `next_service_date`, `expiry_date` columns added to `boat_equipment`
- [ ] Safety equipment management UI shows expiry fields and highlights overdue items in red/amber
- [ ] Leg detail panel shows a "Safety Equipment" section with per-item status badges for crew
- [ ] Offshore/extreme voyages show a warning banner when safety equipment is missing or overdue
- [ ] Migration file created, specs/tables.sql updated
<!-- SECTION:DESCRIPTION:END -->
