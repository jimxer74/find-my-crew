---
id: TASK-147.01
title: 'TASK-147-A: Safety equipment expiry date fields and management UI'
status: Done
assignee: []
created_date: '2026-03-03 15:53'
updated_date: '2026-03-03 16:07'
labels: []
dependencies: []
parent_task_id: TASK-147
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `service_date` (date), `next_service_date` (date), `expiry_date` (date) columns to `boat_equipment` table. In the equipment management UI, show these date fields for items with category='safety'. Highlight items where expiry_date or next_service_date is past-due in red, within 30 days in amber.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented safety equipment expiry date fields and management UI:
- DB migration 057: added service_date, next_service_date, expiry_date (date columns) to boat_equipment table + idx_boat_equipment_safety index
- boat-management/lib/types.ts: added all three date fields to BoatEquipment, BoatEquipmentInsert, BoatEquipmentUpdate interfaces
- EquipmentForm.tsx: added three date state fields, reset logic, handleSubmit inclusion, and safety-specific date input UI block (amber-styled, shown when category === 'safety')
- POST /api/boats/[boatId]/equipment: added three date fields to destructuring and insertData
- PUT /api/boats/[boatId]/equipment/[equipmentId]: added three date fields to allowedFields
<!-- SECTION:FINAL_SUMMARY:END -->
