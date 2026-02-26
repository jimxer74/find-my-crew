---
id: TASK-136
title: Product registry for Boat Management
status: In Progress
assignee: []
created_date: '2026-02-26 09:49'
updated_date: '2026-02-26 10:57'
labels:
  - boat-management
  - database
  - ux
  - search
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Overview

Build a searchable, community-grown **product registry** for the boat management module. When an owner adds equipment to their boat, they can search the registry by manufacturer/model, select a matching product, and have the form auto-filled. If no match is found, they submit the product themselves — which adds it to the registry for all other users. Over time the registry becomes a valuable dataset of sailboat equipment with documentation links, spare parts sources, and specs.

The registry is **category-agnostic** — one table covers all equipment types (engines, winches, chartplotters, masts, batteries, etc.) using JSONB for flexible per-category metadata. There are no category-specific columns (no dedicated `hp` field — power goes in `specs`).

---

## Existing Architecture Context

**Relevant existing tables:**
- `boat_equipment` — per-boat equipment records; has `manufacturer TEXT`, `model TEXT`, `specs JSONB`, `category TEXT` (12-value enum), `subcategory TEXT`. This is where a `product_registry_id` FK will be added.

**Existing category taxonomy** (`EQUIPMENT_CATEGORIES` in `boat-management/lib/types.ts`):
12 categories, 70+ subcategories — engines, rigging, electrical, navigation, safety, plumbing, anchoring, hull_deck, electronics, galley, comfort, dinghy.

**Existing seed data:** `boat-management/config/engines.json` — 24 marine engine models (Yanmar, Volvo Penta, Beta Marine, Perkins, Westerbeke, Nanni, Sole) with documentation URLs and spare parts URLs. This is the first seeding target.

**Current EquipmentForm:** free-text fields for manufacturer and model. Needs a registry autocomplete added above them.

**API pattern:** `/api/boats/[boatId]/equipment|inventory|maintenance` — new registry routes follow `app/api/product-registry/` pattern (not scoped to a boat).

---

## Database Design

### New table: `product_registry`

```sql
CREATE TABLE product_registry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category            TEXT NOT NULL,           -- matches boat_equipment.category enum values
  subcategory         TEXT,                    -- optional, matches boat_equipment subcategory values
  manufacturer        TEXT NOT NULL,
  model               TEXT NOT NULL,
  description         TEXT,                    -- e.g. "Twin-cylinder heat-exchanger / saildrive"
  variants            TEXT[] DEFAULT '{}',     -- e.g. ['D1-13B/F']
  specs               JSONB DEFAULT '{}',      -- agnostic: {hp: 27, cylinders: 3, voltage: 12, ...}
  manufacturer_url    TEXT,                    -- product page on manufacturer site
  documentation_links JSONB DEFAULT '[]',      -- [{title: "Operation Manual", url: "..."}]
  spare_parts_links   JSONB DEFAULT '[]',      -- [{region: "eu|us|uk|asia|global", title: "...", url: "..."}]
  is_verified         BOOLEAN DEFAULT FALSE,   -- curated/trusted entry
  submitted_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = seeded
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(manufacturer, model)
);
```

**`spare_parts_links` shape:**
```json
[
  { "region": "global", "title": "Yanmar Dealer Locator", "url": "https://..." },
  { "region": "eu",     "title": "SVB24 Marine",          "url": "https://svb24.com/..." },
  { "region": "us",     "title": "Defender Marine",       "url": "https://defender.com/..." }
]
```

**`documentation_links` shape:**
```json
[
  { "title": "Operation Manual",  "url": "https://..." },
  { "title": "Workshop Manual",   "url": "https://..." }
]
```

**`specs` JSONB examples:**
- Engine: `{"hp": 27, "cylinders": 3, "cooling": "heat-exchanger", "drive": "saildrive"}`
- Chartplotter: `{"screen_inches": 12, "touch": true, "chartography": "Navionics"}`
- Battery: `{"capacity_ah": 200, "voltage": 12, "chemistry": "LiFePO4"}`
- Winch: `{"ratio": "46:1", "self_tailing": true, "alloy": "chrome"}`

**RLS:**
- SELECT: public (everyone can search the registry)
- INSERT: authenticated users only (community submissions)
- UPDATE/DELETE: owner (`submitted_by = auth.uid`) OR admin role

### Modify: `boat_equipment`

Add FK linking to registry entry (optional — equipment can still exist without a registry match):
```sql
ALTER TABLE boat_equipment
  ADD COLUMN product_registry_id UUID REFERENCES product_registry(id) ON DELETE SET NULL;
```

---

## Location-Aware Spare Parts

Spare parts availability is region-dependent. Supported regions:

| Region | Example sources |
|--------|----------------|
| `eu`   | svb24.com, asap-supplies.com, navicoretail.co.uk |
| `us`   | defender.com, westmarine.com, lewmar.com/us |
| `uk`   | asap-supplies.com, forcefour.co.uk |
| `asia` | manufacturer direct, local distributors |
| `global` | manufacturer's own parts portal, always shown |

**Logic:** When displaying spare parts links for an equipment entry:
1. Always show `global` region links
2. Additionally show links matching the user's region (inferred from their profile location/country, or browser locale as fallback)
3. If no region detected, show all links with region labels

User region resolution: use existing profile `location` field or a simple country-to-region lookup helper.

---

## Shared Module Structure

```
boat-management/lib/
  product-registry-service.ts    — search, get, create, update registry entries
  region-utils.ts                — country → region mapping; filter spare parts by region

boat-management/components/
  registry/
    ProductRegistrySearch.tsx    — autocomplete search input + dropdown results
    ProductRegistryForm.tsx      — submit new product form (when not found in search)
    ProductLinks.tsx             — display documentation + spare parts links (region-aware)
    index.ts

app/api/product-registry/
  route.ts                       — GET (search/list), POST (submit new product)
  [id]/
    route.ts                     — GET (single product detail)
```

---

## UX Flow

### Adding Equipment (EquipmentForm integration)

```
1. Owner opens "Add Equipment" form
   ↓
2. NEW: "Find product in registry" autocomplete at top of form
   - Type manufacturer/model (e.g. "Yanmar 3GM")
   - Dropdown shows matching products from registry
   ↓
3a. Product FOUND → user selects it
   - manufacturer, model, subcategory, specs auto-filled
   - product_registry_id stored on boat_equipment record
   - Spare parts + documentation links available immediately
   ↓
3b. Product NOT FOUND
   - "Not in registry? Add it" link/button
   - Opens lightweight ProductRegistryForm
   - User fills in: manufacturer, model, category, description, specs (optional)
   - Submitted → saved to product_registry (is_verified=false, submitted_by=user)
   - Returned to EquipmentForm with the new product pre-selected
```

### Viewing Equipment (Equipment Detail / List)

```
- Equipment linked to registry → shows "Documentation" and "Spare Parts" sections
- Spare parts filtered by user region (with option to show all)
- Equipment NOT linked to registry → shows "Find in registry" prompt
```

---

## Seed Data Plan

**Phase 1 seed (migration):** Migrate `engines.json` (24 models) into `product_registry` rows.
- category: `'engine'`, subcategory: `'Engine'`
- `hp` value from JSON → stored in `specs.hp`
- `type` → `description`
- `variants` → `variants[]`
- `maintenance_documentation` URLs → `documentation_links[]`
- `spare_parts_sources` URLs → `spare_parts_links[]` (tagged as `region: 'global'` initially; EU/US tagging in a follow-up)

**Future seed targets:** chartplotters, AIS units, VHF radios, windlasses, winches, batteries, solar controllers, inverters, furlers, autopilots.

---

## Implementation Phases

### Phase 1 — Database Foundation
- DB migration: `product_registry` table + `boat_equipment.product_registry_id` FK
- Update `specs/tables.sql`
- Seed migration from `engines.json`
- GDPR: no user PII stored in registry (only `submitted_by` UUID, already cascade-covered)

### Phase 2 — API & Service Layer
- `product-registry-service.ts`: `searchProducts()`, `getProductById()`, `createProduct()`
- `region-utils.ts`: country-to-region map, spare parts filter helper
- `app/api/product-registry/route.ts`: GET with `?q=&category=`, POST
- `app/api/product-registry/[id]/route.ts`: GET

### Phase 3 — Search Component & EquipmentForm Integration
- `ProductRegistrySearch.tsx`: debounced autocomplete search
- `ProductRegistryForm.tsx`: lightweight submit-new form
- Wire into existing `EquipmentForm.tsx`: autocomplete at top, auto-fill on select

### Phase 4 — Links Display
- `ProductLinks.tsx`: documentation + region-filtered spare parts links
- Show in equipment view (EquipmentList card or equipment detail section)
- Region detection from user profile

### Phase 5 — Seed Expansion
- Seed additional product categories beyond engines
- Retroactively tag existing spare_parts_links with EU/US regions
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Owners can search the product registry by typing a manufacturer and/or model name in the EquipmentForm — results appear as an autocomplete dropdown
- [ ] #2 Selecting a registry product auto-fills the equipment form (manufacturer, model, subcategory, specs) and links the equipment record via product_registry_id
- [ ] #3 If a product is not found, the owner can submit it through a lightweight form — it is saved to the registry (is_verified=false) and immediately usable
- [ ] #4 The product_registry table is category-agnostic: all specs stored in JSONB, no category-specific columns
- [ ] #5 Documentation links are displayed for equipment linked to a registry product
- [ ] #6 Spare parts links are displayed filtered by the user's region (eu/us/uk/asia/global) with always-visible global links
- [ ] #7 The 24 engine models from engines.json are seeded into the registry as part of the DB migration
- [ ] #8 Adding equipment without using the registry still works (product_registry_id is optional)
- [ ] #9 RLS: anyone can read the registry; only authenticated users can submit; only owner or admin can edit/delete
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1 — Database Foundation

- [ ] Create migration `NNN_product_registry.sql`:
  - `product_registry` table (id, category, subcategory, manufacturer, model, description, variants, specs, manufacturer_url, documentation_links, spare_parts_links, is_verified, submitted_by, created_at, updated_at)
  - UNIQUE(manufacturer, model)
  - RLS policies (SELECT public, INSERT authenticated, UPDATE/DELETE owner or admin)
  - ALTER TABLE boat_equipment ADD COLUMN product_registry_id UUID REFERENCES product_registry(id) ON DELETE SET NULL
  - INDEX on (category, manufacturer, model) for autocomplete queries
  - Seed INSERT statements migrating all 24 rows from engines.json
- [ ] Update /specs/tables.sql with both changes

## Phase 2 — API & Service Layer

- [ ] `boat-management/lib/product-registry-service.ts`:
  - `searchProducts(query, category?)` — full-text / ILIKE search on manufacturer + model
  - `getProductById(id)` — single product with all links
  - `createProduct(data)` — insert, return new record
- [ ] `boat-management/lib/region-utils.ts`:
  - `countryToRegion(country)` — returns `'eu'|'us'|'uk'|'asia'|'global'`
  - `filterSparePartsByRegion(links, region)` — returns global + matching region links
- [ ] `app/api/product-registry/route.ts` — GET (search: `?q=&category=`), POST (submit)
- [ ] `app/api/product-registry/[id]/route.ts` — GET single product

## Phase 3 — Search Component & EquipmentForm Integration

- [ ] `boat-management/components/registry/ProductRegistrySearch.tsx`:
  - Controlled input with 300ms debounce
  - Calls GET /api/product-registry?q=&category= on change
  - Renders dropdown with manufacturer + model + subcategory + specs preview
  - onSelect callback returns full product record
  - Keyboard navigation (arrow keys, enter, escape)
- [ ] `boat-management/components/registry/ProductRegistryForm.tsx`:
  - Lightweight form: manufacturer (required), model (required), category (required), subcategory, description, specs key/value pairs (optional)
  - POST /api/product-registry on submit
  - On success: calls onCreated(product) to return to EquipmentForm with product pre-selected
- [ ] Modify `boat-management/components/equipment/EquipmentForm.tsx`:
  - Add ProductRegistrySearch at top of form (above existing fields)
  - On product select: populate manufacturer, model, subcategory, specs fields; store product_registry_id
  - "Not in registry? Add it →" link below search → renders ProductRegistryForm inline/modal
  - Existing free-text fields remain editable after auto-fill

## Phase 4 — Links Display

- [ ] `boat-management/components/registry/ProductLinks.tsx`:
  - Receives product_registry_id (or full product object)
  - Renders "Documentation" section: list of titled links
  - Renders "Spare Parts" section: region-filtered links with region label badge
  - "Show all regions" toggle to reveal all spare parts links
- [ ] Integrate ProductLinks into equipment display (EquipmentList card or equipment detail panel)
- [ ] Region detection utility: read user profile location → countryToRegion(); fallback to browser navigator.language

## Phase 5 — Seed Expansion (separate follow-up)

- [ ] Research and add seed data for: chartplotters (Garmin, Raymarine, Navionics), AIS (Vesper, Garmin), VHF (Icom, Standard Horizon), windlasses (Lewmar, Maxwell), winches (Lewmar, Harken), batteries (Battle Born, Victron), furlers (Furlex, Harken)
- [ ] Tag spare_parts_links with EU/US/UK regions where region-specific URLs are known
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Key Design Decisions

- **Category-agnostic specs**: All per-category metadata goes in `specs JSONB`. No dedicated `hp`, `voltage`, etc. columns. This keeps the table extensible without schema migrations for new equipment types.
- **UNIQUE(manufacturer, model)**: Prevents duplicate registry entries. On conflict from community submissions, return the existing record instead of erroring.
- **`submitted_by` ON DELETE SET NULL**: Registry entries survive user account deletion; only the attribution is cleared. No GDPR risk.
- **`is_verified` flag**: Seeded data and admin-reviewed entries are `true`. Community submissions default to `false`. UI can show a "verified" badge on curated entries.
- **`product_registry_id` on boat_equipment is optional**: Owners who don't use the registry search are not affected. Existing equipment records need no backfill.
- **Location detection**: Use `profile.location` (already stored) to infer country → region. Browser `navigator.language` as fallback (e.g. `en-GB` → `uk`). If unresolvable, show all links with region labels.

## Autocomplete Search Query

```sql
SELECT id, category, subcategory, manufacturer, model, description, specs, is_verified
FROM product_registry
WHERE category = $category  -- optional filter
  AND (manufacturer ILIKE '%' || $q || '%' OR model ILIKE '%' || $q || '%')
ORDER BY is_verified DESC, manufacturer, model
LIMIT 10;
```

Full-text index on `(manufacturer || ' ' || model)` can be added later if performance requires it.

## Seed Data Transformation (engines.json → SQL)

For each engine entry:
- `category = 'engine'`
- `subcategory = 'Engine'`
- `specs = {"hp": <hp>, "type": "<type>"}`
- `description = <type field>`
- `variants = <variants array>`
- `documentation_links = [{title: parsed label, url: parsed url}, ...]`
- `spare_parts_links = [{region: "global", title: parsed label, url: parsed url}, ...]`
- `is_verified = true` (seeded = curated)
- `submitted_by = NULL`

## Files to Create/Modify

**New files:**
- `migrations/NNN_product_registry.sql`
- `boat-management/lib/product-registry-service.ts`
- `boat-management/lib/region-utils.ts`
- `boat-management/components/registry/ProductRegistrySearch.tsx`
- `boat-management/components/registry/ProductRegistryForm.tsx`
- `boat-management/components/registry/ProductLinks.tsx`
- `boat-management/components/registry/index.ts`
- `app/api/product-registry/route.ts`
- `app/api/product-registry/[id]/route.ts`

**Modified files:**
- `boat-management/lib/types.ts` — add ProductRegistry TypeScript type
- `boat-management/lib/index.ts` — export new service and types
- `boat-management/components/equipment/EquipmentForm.tsx` — add registry search
- `boat-management/components/equipment/EquipmentList.tsx` — add ProductLinks display
- `specs/tables.sql` — add product_registry table and boat_equipment FK column
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 DB migration file created with product_registry table, boat_equipment.product_registry_id FK column, and engine seed data
- [ ] #2 specs/tables.sql updated with both schema changes
- [ ] #3 API routes GET /api/product-registry and GET /api/product-registry/[id] return correct data with search/filter
- [ ] #4 POST /api/product-registry allows authenticated users to submit new products
- [ ] #5 ProductRegistrySearch autocomplete component works with debounce and keyboard navigation
- [ ] #6 EquipmentForm integration: auto-fill on product select, graceful fallback when no registry match
- [ ] #7 ProductLinks component renders documentation + region-filtered spare parts links
- [ ] #8 Region detection implemented (from user profile location, with locale fallback)
- [ ] #9 GDPR: submitted_by FK has ON DELETE SET NULL — no orphaned user references on account deletion
- [ ] #10 No regression in existing equipment CRUD flows
<!-- DOD:END -->
