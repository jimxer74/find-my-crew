---
id: TASK-140
title: Implement product_maintenance_tasks cache table and two-phase AI generation
status: Done
assignee: []
created_date: '2026-02-27 16:57'
updated_date: '2026-02-27 17:06'
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Complete

### What was built
A product maintenance tasks cache system that eliminates redundant AI calls for the same equipment across multiple users.

### Files changed
1. **`migrations/054_product_maintenance_tasks.sql`** — New table (created in prior session)
2. **`specs/tables.sql`** — Added `product_maintenance_tasks` table definition after `boat_maintenance_tasks` policies
3. **`supabase/functions/ai-job-worker/handlers/generate-boat-equipment.ts`** — Full rewrite with two-phase approach:
   - Phase 1: Generate equipment list only (webSearch-enabled model, temperature 0.1)
   - After Phase 1: Upsert to `product_registry`, SELECT actual IDs (workaround for ignoreDuplicates returning nothing on conflict), populate `productRegistryId` on each equipment item
   - Cache check: Query `product_maintenance_tasks` for all productRegistryIds
   - Phase 2: Generate maintenance tasks only for equipment NOT in cache (gpt-4o-mini, cheaper)
   - Store new tasks to `product_maintenance_tasks` with `source: 'ai'`
   - Return: equipment with `productRegistryId` populated + all maintenance tasks (cached + new)
4. **`app/components/manage/NewBoatWizardStep3.tsx`** — Simplified save logic:
   - Added `productRegistryId?: string | null` to `GeneratedEquipmentItem` interface
   - `handleSave` now includes `product_registry_id: e.productRegistryId ?? null` directly in equipment inserts
   - Removed the separate client-side product_registry upsert + SELECT + UPDATE step (now all done server-side in edge function)

### Cost optimization
First user with a "Volvo Penta D2-75" triggers Phase 2 AI call; all subsequent users get cached tasks for free. Only Phase 1 (equipment generation) runs each time.
<!-- SECTION:FINAL_SUMMARY:END -->
