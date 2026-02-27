---
id: TASK-139
title: Generate equipment hierachy and maintenance tasks for boat
status: Done
assignee: []
created_date: '2026-02-27 14:14'
updated_date: '2026-02-27 15:01'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AI functionality to populate the boat_management equipments from the standard list of equipments for the parcticular boat and maintenance tasks for standard maint activites for selected equiment.

In add new boat wizard add a 3. step in the wizard flow "3. Equipment and maintenance". 
After the 2. step when boat is saved to database. Display the 3. step page
- User can select from main equipment categories of which equipments will be created
-  User can select for which categories the maintenance task are created

When user clicks create, an async AI job is started to fetch standard equipment list and subequipments  and maintenance tasks using AI search in background, show progress indicator to user. when ready show a summary of the fetched equipment and maint. tasks
- user can delete equipment and maint. tasks that user does not wish to create
- user can save the equipment and task list to boat_management equipments and maintenance or cancel
- when saved, save also equipments in local product registry, check for duplicates, do not create duplicate entries in product registry table
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Update `shared/lib/async-jobs/types.ts` — add `generate-boat-equipment` to JobType, add payload interface
2. Update `app/api/async-jobs/route.ts` — add to VALID_JOB_TYPES
3. Create `supabase/functions/ai-job-worker/handlers/generate-boat-equipment.ts` — Edge Function handler
4. Update `supabase/functions/ai-job-worker/_registry.ts` — register new handler
5. Create `app/components/manage/NewBoatWizardStep3.tsx` — Step 3 UI component
6. Update `app/components/manage/NewBoatWizard.tsx` — integrate Step 3, update step indicators, savedBoatId state
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Complete

All 6 files created/modified as planned. Build passes successfully.

### Files Modified
1. **`shared/lib/async-jobs/types.ts`** — Added `'generate-boat-equipment'` to `JobType` union; added `GenerateBoatEquipmentPayload` interface
2. **`app/api/async-jobs/route.ts`** — Added `'generate-boat-equipment'` to `VALID_JOB_TYPES`
3. **`supabase/functions/ai-job-worker/_registry.ts`** — Imported and registered new handler

### Files Created
4. **`supabase/functions/ai-job-worker/handlers/generate-boat-equipment.ts`** — Edge Function handler: builds structured AI prompt for the boat's make/model/type/size, parses JSON result, emits progress at 10/25/80/100%
5. **`app/components/manage/NewBoatWizardStep3.tsx`** — Full Step 3 UI: category selection checkboxes (all 12 categories, pre-checked), async job submission, JobProgressPanel for live progress, review panel with deletable equipment (hierarchy-aware) and maintenance tasks, Save/Skip/Back buttons
6. **`app/components/manage/NewBoatWizard.tsx`** — Extended wizard: `currentStep` now `1|2|3`, added `savedBoatId` state, `handleSave` now uses `.select('id').single()` and advances to Step 3, added 3-step indicators in header, renders `NewBoatWizardStep3` at step 3

### Key behaviours
- All 12 equipment categories checked by default for both equipment and maintenance
- Equipment hierarchy respected: parent items inserted first, children resolve `parent_id` via index map
- Product registry upserted (ignoreDuplicates) for items with manufacturer+model, then linked to equipment row
- Maintenance tasks saved as `is_template: true` with recurrence config
- Skip closes wizard and calls `onSuccess()` immediately at any point
- Back (Re-generate) returns to category selection for a fresh job
<!-- SECTION:FINAL_SUMMARY:END -->
