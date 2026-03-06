---
id: TASK-153
title: 'AI job: generate spare parts for equipment'
status: In Progress
assignee: []
created_date: '2026-03-06 09:01'
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
