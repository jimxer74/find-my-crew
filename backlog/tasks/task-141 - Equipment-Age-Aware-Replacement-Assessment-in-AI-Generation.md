---
id: TASK-141
title: Equipment Age-Aware Replacement Assessment in AI Generation
status: To Do
assignee: []
created_date: '2026-02-27 18:25'
labels:
  - boat-management
  - ai
  - equipment
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

The AI equipment generator uses manufacturer specs (original factory configuration). For older boats, key items are routinely replaced with non-original equipment — most notably engines, electronics, navigation systems, batteries, sails, and standing rigging. If the user accepts the AI-generated list without review, they end up with inaccurate equipment data.

The AI should:
1. Know the boat's build year
2. Reason about which items are commonly replaced given the boat's age
3. Flag uncertain items in the review UI so the user can confirm, update, or remove them before saving

---

## Schema Change Required

### Add `year_built` to `boats` table
The boats table currently has no year/age field. This is the key input for age-based reasoning.

```sql
-- Migration 055
alter table public.boats add column if not exists year_built int;
```

Also update `specs/tables.sql` accordingly.

Where to expose `year_built` in the UI:
- NewBoatWizard.tsx Step 2 (boat details) — add a "Year built" input field
- Boat edit form — add the same field
- Pass year_built through the edge function payload

---

## Architecture Overview

### 1. Phase 1 Prompt Enhancement (Edge Function)

Pass `yearBuilt: number | null` to `GenerateBoatEquipmentPayload`. In `buildEquipmentPrompt()`:
- Add boat age context: "Built: YEAR (AGE years old)"
- Instruct AI to assess replacement likelihood per item:
  - `replacementLikelihood`: 'low' | 'medium' | 'high'
  - `replacementReason`: short explanation (e.g., "Engines typically replaced after 20–25 years; this boat is 30 years old")

AI reasoning guidance in prompt (age thresholds for AI to reason about, not hardcoded in code):
- HIGH: engine after ~20–25 years, chartplotters/electronics after ~10–15 years, batteries after ~5–7 years, watermaker after ~8–10 years, sails after ~10–15 years, standing rigging after ~10–15 years
- MEDIUM: autopilot, refrigeration, VHF radio, running rigging
- LOW: hull, keel, mast structure, winches, blocks, anchors

For newer boats (< 5 years): all items default to low unless specific evidence of replacement exists.

### 2. Updated AI Output Format

```json
{
  "equipment": [
    {
      "index": 0,
      "name": "Main Engine",
      "replacementLikelihood": "high",
      "replacementReason": "This boat is 35 years old. Engines typically last 20–25 years before replacement. Original spec may no longer be accurate."
    }
  ]
}
```

### 3. TypeScript Type Updates

GeneratedEquipmentItem gets new optional fields:
```typescript
replacementLikelihood?: 'low' | 'medium' | 'high';
replacementReason?: string;
// UI-only state (not from AI):
replacementStatus?: 'unreviewed' | 'confirmed' | 'replaced';
replacementManufacturer?: string;
replacementModel?: string;
```

### 4. Review Phase UI — "Verify This Item" Flow

For `replacementLikelihood: 'high'`:
Show a yellow warning section with:
- Warning icon + replacementReason text
- Three inline action buttons:
  1. Confirm original — sets replacementStatus: 'confirmed', green checkmark
  2. It's been replaced — expands inline mini-form with Manufacturer + Model autocomplete, sets replacementStatus: 'replaced'
  3. Remove — calls existing deleteEquipment(item.index)

For `replacementLikelihood: 'medium'`:
Softer amber indicator, collapsed by default, "Verify?" link to expand.

For `replacementLikelihood: 'low'` or undefined:
No indicator. Normal display.

Unreviewed items counter: banner at top of review phase "X items need verification" — does not block saving (informational).

Inline replacement form:
- Manufacturer field with product_registry autocomplete
- Model field with autocomplete (filtered by manufacturer, same as EquipmentForm)
- Apply / Cancel buttons
- On apply: updates item.manufacturer, item.model, item.notes, clears item.productRegistryId

### 5. Payload Changes

```typescript
interface GenerateBoatEquipmentPayload {
  boatId: string;
  makeModel: string;
  boatType: string | null;
  loa_m: number | null;
  yearBuilt: number | null;   // NEW
  selectedCategories: string[];
  maintenanceCategories: string[];
}
```

---

## UX Sketch — High-Likelihood Item in Review

```
┌─────────────────────────────────────────────────────┐
│ Main Engine                    Volvo Penta MD2030    │
│ Original per 1989 spec                               │
│                                                      │
│ ⚠  Engines typically replaced after 20–25 years.    │
│    This boat is 35 years old — original spec may     │
│    not be accurate.                                  │
│                                                      │
│ [Confirm original]  [It's been replaced]  [Remove]   │
│   ▼ Manufacturer: [__________]  Model: [__________]  │
│                                   [Apply]  [Cancel]  │
└─────────────────────────────────────────────────────┘
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `migrations/055_boats_year_built.sql` | Add `year_built int` to boats |
| `specs/tables.sql` | Update boats table schema |
| `shared/lib/async-jobs/types.ts` | Add `yearBuilt` to payload type |
| `supabase/functions/ai-job-worker/handlers/generate-boat-equipment.ts` | Age context in prompt, parse new fields |
| `app/components/manage/NewBoatWizard.tsx` | Year Built input in Step 2 |
| `app/components/manage/NewBoatWizardStep3.tsx` | yearBuilt prop; verify/confirm/replace review UI |
| `app/owner/boats/[boatId]/equipment/page.tsx` | Fetch year_built, pass to Step 3 |
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 year_built field added to boats table (migration + specs/tables.sql)
- [ ] #2 Year Built input in boat wizard Step 2 (and boat edit form if one exists)
- [ ] #3 Edge function receives yearBuilt, includes age context in Phase 1 prompt
- [ ] #4 AI outputs replacementLikelihood and replacementReason per equipment item
- [ ] #5 Review UI shows yellow warning for 'high' likelihood items with Confirm / Replace / Remove actions
- [ ] #6 Inline replacement mini-form uses product_registry autocomplete (manufacturer + model)
- [ ] #7 Review UI shows amber collapsed indicator for 'medium' likelihood items
- [ ] #8 Saving uses replacement manufacturer/model/productRegistryId when user chose 'replaced'
- [ ] #9 Newer boats (< 5 years) produce no warnings (AI reasons items as low likelihood)
- [ ] #10 Feature works in both wizard Step 3 and equipment page AI generate overlay
<!-- AC:END -->
