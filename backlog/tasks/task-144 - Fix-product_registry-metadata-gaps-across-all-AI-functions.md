---
id: TASK-144
title: Fix product_registry metadata gaps across all AI functions
status: Done
assignee: []
created_date: '2026-02-28 08:08'
updated_date: '2026-02-28 08:10'
labels:
  - product-registry
  - ai
  - data-quality
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three AI functions interact with product_registry but all have gaps that prevent complete metadata from being stored or enriched over time.

**Issues found:**

1. `generate-boat-equipment.ts` (supabase edge function):
   - Enrichment select only fetches `description`, so can't check if `manufacturer_url`, `documentation_links`, `spare_parts_links` are empty
   - Enrichment condition `!r.description` misses records that have a description but lack links/URL
   - Update can overwrite existing verified data (should only fill empty fields)

2. `generate-equipment-maintenance.ts` (supabase edge function):
   - When `productRegistryId` is null but manufacturer+model are known, no attempt to look up or create a registry entry
   - Means manual equipment additions with known manufacturer+model never get catalogued or get their maintenance tasks cached

3. `/api/product-registry/ai-search/route.ts` (Next.js API):
   - After upsert with `ignoreDuplicates: true`, fetches saved records but never compares them against AI results to enrich missing fields
   - Products that already exist with partial metadata never get enriched

**Fixes:**
- Extend select in generate-boat-equipment to include all metadata fields
- Expand enrichment condition to check ALL empty fields (description, manufacturer_url, documentation_links, spare_parts_links)
- Make all enrichment updates respect existing data (only fill null/empty fields, never overwrite)
- In generate-equipment-maintenance, add lookup/create product_registry entry when productRegistryId is null
- In ai-search route, add enrichment loop after upsert to fill missing fields in existing records
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 generate-boat-equipment selects all metadata fields and enriches any empty field
- [x] #2 Enrichment updates never overwrite existing non-empty data
- [x] #3 generate-equipment-maintenance looks up or creates a product_registry entry when productRegistryId is null and manufacturer+model are known
- [x] #4 ai-search route enriches existing records missing metadata after upsert
<!-- AC:END -->
