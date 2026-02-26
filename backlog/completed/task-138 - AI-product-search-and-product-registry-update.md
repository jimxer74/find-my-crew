---
id: TASK-138
title: AI product search and product registry update
status: Done
assignee: []
created_date: '2026-02-26 12:46'
updated_date: '2026-02-26 12:59'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactory Boat Management Add Equipment functionality:

Remove the Find Product in Registry, instead the autocomplete search should be direclty implemented on the Name, field which searches the matching entries from Product Registry.

Above the Name field is link "Not found? Search it" with small magnifying glass icon, link opens the dialog with similar contents as for adding a product to registry.  Change the "Description" to "Additional search text" and buttons to "Cancel" and "Search".

Clicking Search triggers a AI driven search, where input parameters are provided to AI to search the particular product and all required metadata (links and all). AI search should return a list of matches, where user could click to see further details if so wishes and select the most approriate one.  

** Important ** 
- when AI search return a list of matches, max 5 found products should be stored in Product Registry for later use, this way we get it filled up and the contents are screened through the AI reasoning, not by individual user, which may create non-existing or bad quality products in registry.

- If AI search did not found the approriate product, user has allways to chance to add the equipment information manually, but these will not be part of the registry automatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Name field has inline autocomplete that searches the product registry as the user types
- [ ] #2 Selecting a registry product from the Name autocomplete auto-fills manufacturer, model, category, subcategory and links product_registry_id
- [ ] #3 Above the Name field there is a 'Not found? Search it' link with magnifying glass icon
- [ ] #4 Clicking the link opens a dialog with manufacturer, model, and 'Additional search text' fields plus Cancel and Search buttons
- [ ] #5 Clicking Search triggers an AI-driven search and shows up to 5 matching products
- [ ] #6 Each AI result shows manufacturer, model, description, and a Select button with optional details expand
- [ ] #7 Selecting an AI result auto-fills the EquipmentForm
- [ ] #8 AI search results (up to 5) are stored in the Product Registry for future use
- [ ] #9 If AI finds no results, user can add equipment manually without registry link
- [ ] #10 Old 'Find Product in Registry' dedicated search section is removed from the form
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## TASK-138 Complete

**Changes implemented:**

1. **`shared/ai/config/index.ts`** — Added `'product-search'` to `UseCase` type
2. **`shared/ai/prompts/types.ts`** — Added `'product-search'` to `UseCase` type (fixes build error)
3. **`shared/ai/config/prod.ts`** — Added `product-search` override (gpt-4o-mini, temp 0.1, 4000 tokens)
4. **`app/api/product-registry/ai-search/route.ts`** — New AI search endpoint: authenticates user, calls `callAI({useCase: 'product-search'})`, validates/sanitizes products, upserts to product_registry, returns records with IDs
5. **`boat-management/components/registry/ProductAISearchDialog.tsx`** — New modal: manufacturer/model/additional text inputs → POST to ai-search → results list with Details toggle (specs, ProductLinks) and Select button
6. **`boat-management/components/registry/index.ts`** — Added ProductAISearchDialog export
7. **`boat-management/components/equipment/EquipmentForm.tsx`** — Fully rewritten: removed dedicated registry search section, Name field is now custom inline autocomplete (debounced GET /api/product-registry?q=), "Not found? Search it" link above Name opens ProductAISearchDialog, ProductAISearchDialog rendered outside `<form>` to avoid nested form issues

Build: ✅ 83 pages compiled successfully
<!-- SECTION:FINAL_SUMMARY:END -->
