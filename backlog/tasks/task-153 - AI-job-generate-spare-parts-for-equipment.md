---
id: TASK-153
title: 'AI job: generate spare parts for equipment'
status: Done
assignee: []
created_date: '2026-03-06 09:01'
updated_date: '2026-03-06 09:06'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create an async AI job that generates spare parts (inventory items) for a specific equipment, similar to the existing `generate-equipment-maintenance` job. Add UI to the EquipmentCard to fetch/apply spare parts with duplicate detection.

## Scope
1. **Supabase edge function handler** — new handler in `supabase/functions/ai-job-worker/handlers/` for `generate-boat-equipment-spares`
2. **Job type registration** — register the new job type in the AI worker dispatcher
3. **EquipmentList UI** — add `EquipmentSparesSection` component inside `EquipmentCard` (similar to `EquipmentMaintenanceSection`)
4. **Duplicate check** — before saving, check existing `boat_inventory` by `boat_id` + `equipment_id` + name/part_number

## References
- Existing handler: `supabase/functions/ai-job-worker/handlers/generate-boat-equipment.ts`
- Existing maintenance handler: `supabase/functions/ai-job-worker/handlers/generate-equipment-maintenance.ts`
- Inventory service: `boat-management/lib/inventory-service.ts`
- EquipmentList: `boat-management/components/equipment/EquipmentList.tsx`
- Job submission helper: `shared/lib/async-jobs/submitJob.ts`
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented AI spare parts generation for equipment cards.

**Files created:**
- `migrations/058_product_spare_parts.sql` — new cache table with RLS
- `supabase/functions/ai-job-worker/handlers/generate-equipment-spares.ts` — AI handler
- `app/api/product-registry/[id]/spare-parts/route.ts` — GET endpoint for cached parts

**Files modified:**
- `supabase/functions/ai-job-worker/_registry.ts` — registered new handler
- `shared/lib/async-jobs/types.ts` — added `generate-equipment-spares` JobType + payload interface
- `boat-management/components/equipment/EquipmentList.tsx` — added `EquipmentSparesSection` + wired into `EquipmentCard`
- `specs/tables.sql` — added `product_spare_parts` table definition

**Behaviour:**
- "✦ Fetch spare parts" button appears on equipment cards (owner only, requires product_registry_id)
- Checks `product_spare_parts` cache; if found, shows count + "Add to inventory" button
- If no cache, offers "✦ Generate with AI" — runs async job with progress panel
- AI generates parts with name, part_number, category, quantity, unit, notes
- "Add to inventory" inserts into `boat_inventory` with equipment_id linked, min_quantity set to recommended quantity, quantity=0 (not yet on hand)
- Duplicate check: compares by name (case-insensitive) against existing inventory for the same equipment_id; shows skipped count
<!-- SECTION:FINAL_SUMMARY:END -->
