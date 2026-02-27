---
id: TASK-140
title: Implement product_maintenance_tasks cache table and two-phase AI generation
status: In Progress
assignee: []
created_date: '2026-02-27 16:57'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cache AI-generated maintenance tasks per product_registry entry so subsequent users with the same equipment get tasks instantly without an AI call.

Files:
1. migrations/054_product_maintenance_tasks.sql — new table
2. specs/tables.sql — add table definition
3. supabase/functions/ai-job-worker/handlers/generate-boat-equipment.ts — two-phase: Phase 1 generates equipment + upserts product_registry, checks cache; Phase 2 generates maintenance tasks only for uncached equipment, stores to cache
4. app/components/manage/NewBoatWizardStep3.tsx — use productRegistryId from job result directly on insert, remove client-side product_registry upsert step
<!-- SECTION:DESCRIPTION:END -->
