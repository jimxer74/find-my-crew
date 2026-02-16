---
id: TASK-101
title: Boat registry
status: Done
assignee: []
created_date: '2026-02-16 14:49'
updated_date: '2026-02-16 17:14'
labels:
  - performance
  - database
  - caching
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a new table to store boat registry data. The table should have all the same fields as boats table, except boat name, owner id, and home port. 

**Purpose:**
- Cache boat specifications fetched from external sources (sailboatdata.com screenscraping)
- Reduce external API calls and improve performance
- Ensure consistent boat data across the platform
- Support both manual and AI-assisted boat creation flows

**Functionality:**

1. **Registry Storage**: Add a row into the boat registry table each time boat data is fetched via screenscraping API (either in AI-assisted flow or manual add new boat flow).

2. **Registry Lookup**: Update the fetch boat details API to try to lookup the appropriate boat data first from the boat registry table, before using the external source via screenscraping API.

3. **Registry Updates**: When boat data is fetched from external source, update the registry if a record exists, or create a new one if it doesn't.

**Key Benefits:**
- Faster boat creation (no external API delay if data exists in registry)
- Reduced dependency on external services
- Lower costs (fewer screenscraping API calls)
- Better data consistency (same make/model always returns same specs)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Overview

The boat registry will act as a cache layer between our application and external boat data sources. It stores boat specifications by `make_model` (and optionally `slug` from sailboatdata.com) to enable fast lookups without external API calls.

## Database Schema

### 1. Create `boat_registry` Table

**Fields to include** (all fields from `boats` table EXCEPT):
- ❌ `id` (new UUID for registry entry)
- ❌ `owner_id` (not owner-specific)
- ❌ `name` (boat name is owner-specific)
- ❌ `home_port` (location-specific, not boat-model-specific)
- ❌ `country_flag` (location-specific)
- ❌ `images` (owner-specific photos)
- ❌ `created_at` / `updated_at` (registry-specific timestamps)

**Fields to include**:
- ✅ `make_model` (PRIMARY KEY or unique index) - e.g., "Bavaria 46"
- ✅ `slug` (optional, from sailboatdata.com URL) - e.g., "bavaria-46"
- ✅ `type` (sailboat_category)
- ✅ `capacity` (int)
- ✅ `loa_m`, `beam_m`, `max_draft_m`, `displcmt_m` (dimensions)
- ✅ `average_speed_knots`
- ✅ `link_to_specs` (URL to sailboatdata.com)
- ✅ `characteristics`, `capabilities`, `accommodations` (text descriptions)
- ✅ `sa_displ_ratio`, `ballast_displ_ratio`, `displ_len_ratio`, `comfort_ratio`, `capsize_screening`, `hull_speed_knots`, `ppi_pounds_per_inch` (performance ratios)
- ✅ `created_at`, `updated_at` (timestamps)
- ✅ `fetch_count` (optional: track how many times this registry entry was used)
- ✅ `last_fetched_at` (optional: track when external source was last checked)

**Migration File**: `migrations/036_create_boat_registry_table.sql`

```sql
-- Create boat_registry table
CREATE TABLE IF NOT EXISTS public.boat_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make_model text NOT NULL,
  slug text, -- Optional slug from sailboatdata.com (e.g., "bavaria-46")
  type sailboat_category,
  capacity int,
  loa_m numeric,
  beam_m numeric,
  max_draft_m numeric,
  displcmt_m numeric,
  average_speed_knots numeric,
  link_to_specs text,
  characteristics text,
  capabilities text,
  accommodations text,
  sa_displ_ratio numeric,
  ballast_displ_ratio numeric,
  displ_len_ratio numeric,
  comfort_ratio numeric,
  capsize_screening numeric,
  hull_speed_knots numeric,
  ppi_pounds_per_inch numeric,
  fetch_count int DEFAULT 0, -- Track usage
  last_fetched_at timestamptz, -- When external source was last checked
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure make_model is unique (one registry entry per boat model)
  CONSTRAINT boat_registry_make_model_unique UNIQUE (make_model)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS boat_registry_make_model_idx ON public.boat_registry (make_model);
CREATE INDEX IF NOT EXISTS boat_registry_slug_idx ON public.boat_registry (slug) WHERE slug IS NOT NULL;

-- Enable Row Level Security (public read, no write for users - only system can write)
ALTER TABLE public.boat_registry ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read registry (public data)
CREATE POLICY "Boat registry is viewable by all"
ON public.boat_registry FOR SELECT
USING (true);

-- Note: INSERT/UPDATE will be done server-side via service account, not through RLS
```

### 2. Update `specs/tables.sql`

Add the `boat_registry` table definition to the schema documentation file.

## Backend Implementation

### 3. Create Registry Service

**File**: `app/lib/boat-registry/service.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { SailboatDetails } from '@/app/lib/sailboatdata_queries';

export interface BoatRegistryEntry {
  id: string;
  make_model: string;
  slug: string | null;
  type: string | null;
  capacity: number | null;
  loa_m: number | null;
  beam_m: number | null;
  max_draft_m: number | null;
  displcmt_m: number | null;
  average_speed_knots: number | null;
  link_to_specs: string | null;
  characteristics: string | null;
  capabilities: string | null;
  accommodations: string | null;
  sa_displ_ratio: number | null;
  ballast_displ_ratio: number | null;
  displ_len_ratio: number | null;
  comfort_ratio: number | null;
  capsize_screening: number | null;
  hull_speed_knots: number | null;
  ppi_pounds_per_inch: number | null;
  fetch_count: number;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Lookup boat data in registry by make_model (and optionally slug)
 */
export async function lookupBoatRegistry(
  supabase: SupabaseClient,
  makeModel: string,
  slug?: string
): Promise<BoatRegistryEntry | null> {
  // Try slug first if provided (more specific)
  if (slug) {
    const { data, error } = await supabase
      .from('boat_registry')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (!error && data) {
      return data as BoatRegistryEntry;
    }
  }
  
  // Fallback to make_model lookup
  const { data, error } = await supabase
    .from('boat_registry')
    .select('*')
    .eq('make_model', makeModel.trim())
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as BoatRegistryEntry;
}

/**
 * Save or update boat data in registry
 */
export async function saveBoatRegistry(
  supabase: SupabaseClient,
  makeModel: string,
  boatData: SailboatDetails,
  slug?: string
): Promise<BoatRegistryEntry> {
  const registryData = {
    make_model: makeModel.trim(),
    slug: slug || null,
    type: boatData.type || null,
    capacity: boatData.capacity ?? null,
    loa_m: boatData.loa_m ?? null,
    beam_m: boatData.beam_m ?? null,
    max_draft_m: boatData.max_draft_m ?? null,
    displcmt_m: boatData.displcmt_m ?? null,
    average_speed_knots: boatData.average_speed_knots ?? null,
    link_to_specs: boatData.link_to_specs || null,
    characteristics: boatData.characteristics || null,
    capabilities: boatData.capabilities || null,
    accommodations: boatData.accommodations || null,
    sa_displ_ratio: boatData.sa_displ_ratio ?? null,
    ballast_displ_ratio: boatData.ballast_displ_ratio ?? null,
    displ_len_ratio: boatData.displ_len_ratio ?? null,
    comfort_ratio: boatData.comfort_ratio ?? null,
    capsize_screening: boatData.capsize_screening ?? null,
    hull_speed_knots: boatData.hull_speed_knots ?? null,
    ppi_pounds_per_inch: boatData.ppi_pounds_per_inch ?? null,
    updated_at: new Date().toISOString(),
    last_fetched_at: new Date().toISOString(),
  };
  
  // Try to update existing entry
  const { data: existing } = await supabase
    .from('boat_registry')
    .select('id, fetch_count')
    .eq('make_model', makeModel.trim())
    .single();
  
  if (existing) {
    // Update existing entry
    const { data, error } = await supabase
      .from('boat_registry')
      .update({
        ...registryData,
        fetch_count: (existing.fetch_count || 0) + 1,
      })
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) throw error;
    return data as BoatRegistryEntry;
  } else {
    // Insert new entry
    const { data, error } = await supabase
      .from('boat_registry')
      .insert({
        ...registryData,
        fetch_count: 1,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as BoatRegistryEntry;
  }
}

/**
 * Convert registry entry to SailboatDetails format
 */
export function registryToSailboatDetails(entry: BoatRegistryEntry): SailboatDetails {
  return {
    make_model: entry.make_model,
    type: entry.type as any,
    capacity: entry.capacity,
    loa_m: entry.loa_m,
    beam_m: entry.beam_m,
    max_draft_m: entry.max_draft_m,
    displcmt_m: entry.displcmt_m,
    average_speed_knots: entry.average_speed_knots,
    link_to_specs: entry.link_to_specs || undefined,
    characteristics: entry.characteristics || undefined,
    capabilities: entry.capabilities || undefined,
    accommodations: entry.accommodations || undefined,
    sa_displ_ratio: entry.sa_displ_ratio,
    ballast_displ_ratio: entry.ballast_displ_ratio,
    displ_len_ratio: entry.displ_len_ratio,
    comfort_ratio: entry.comfort_ratio,
    capsize_screening: entry.capsize_screening,
    hull_speed_knots: entry.hull_speed_knots,
    ppi_pounds_per_inch: entry.ppi_pounds_per_inch,
  };
}
```

### 4. Update Screenscraping Service

**File**: `app/lib/sailboatdata_queries.ts`

Modify `fetchSailboatDetails` function to:
1. Check registry first
2. If found, return registry data (and optionally increment `fetch_count`)
3. If not found, fetch from external source
4. Save to registry before returning

```typescript
export async function fetchSailboatDetails(
  sailboatQueryStr: string, 
  slug?: string
): Promise<SailboatDetails | null> {
  // ... existing code ...
  
  // NEW: Check registry first
  const { lookupBoatRegistry, saveBoatRegistry, registryToSailboatDetails } = 
    await import('@/app/lib/boat-registry/service');
  
  // Get supabase client (server-side)
  const supabase = getSupabaseServerClient();
  
  const registryEntry = await lookupBoatRegistry(supabase, sailboatQueryStr, slug);
  if (registryEntry) {
    console.log('✅ Found boat in registry:', registryEntry.make_model);
    // Optionally increment fetch_count to track usage
    await supabase
      .from('boat_registry')
      .update({ fetch_count: (registryEntry.fetch_count || 0) + 1 })
      .eq('id', registryEntry.id);
    
    return registryToSailboatDetails(registryEntry);
  }
  
  // Registry miss - fetch from external source
  console.log('⚠️ Registry miss, fetching from external source:', sailboatQueryStr);
  
  // ... existing screenscraping code ...
  const details = parseSailboatDetailsHTML(html, sailboatUrl);
  
  // NEW: Save to registry before returning
  if (details && details.make_model) {
    try {
      await saveBoatRegistry(supabase, details.make_model, details, slug);
      console.log('✅ Saved to boat registry:', details.make_model);
    } catch (error) {
      console.error('⚠️ Failed to save to registry (non-fatal):', error);
      // Continue even if registry save fails
    }
  }
  
  return details;
}
```

**Note**: Need to create `getSupabaseServerClient()` helper if it doesn't exist, or use the existing server-side Supabase client pattern.

### 5. Update AI-Assisted Flow

**File**: `app/lib/ai/owner/service.ts`

The `fetch_boat_details_from_sailboatdata` tool execution (lines 880-999) already calls `fetchSailboatDetails`, so it will automatically benefit from registry caching. No changes needed here.

### 6. Update Manual Flow

**File**: `app/api/sailboatdata/fetch-details/route.ts`

This API route should also check registry first. Update to use the registry service:

```typescript
export async function POST(request: NextRequest) {
  // ... existing code ...
  
  // Check registry first
  const { lookupBoatRegistry, saveBoatRegistry, registryToSailboatDetails } = 
    await import('@/app/lib/boat-registry/service');
  const supabase = createServerClient();
  
  const registryEntry = await lookupBoatRegistry(supabase, make_model, slug);
  if (registryEntry) {
    return NextResponse.json({
      boatDetails: registryToSailboatDetails(registryEntry),
      source: 'registry',
    });
  }
  
  // Fetch from external source
  const details = await fetchSailboatDetails(make_model, slug);
  
  // Save to registry
  if (details && details.make_model) {
    await saveBoatRegistry(supabase, details.make_model, details, slug);
  }
  
  return NextResponse.json({
    boatDetails: details,
    source: 'external',
  });
}
```

**File**: `app/components/manage/NewBoatWizard.tsx`

No changes needed - it already calls `/api/sailboatdata/fetch-details` which will now use registry.

## Testing Plan

### 7. Unit Tests

**File**: `app/lib/boat-registry/__tests__/service.test.ts`

- Test `lookupBoatRegistry` with make_model
- Test `lookupBoatRegistry` with slug
- Test `saveBoatRegistry` creates new entry
- Test `saveBoatRegistry` updates existing entry
- Test `registryToSailboatDetails` conversion

### 8. Integration Tests

- Test registry lookup before external fetch
- Test registry save after external fetch
- Test both AI-assisted and manual flows use registry
- Test registry updates when external data changes

### 9. Performance Tests

- Measure response time with registry hit vs miss
- Verify reduced external API calls
- Monitor registry table growth

## Implementation Order

1. **Database**: Create migration `036_create_boat_registry_table.sql`
2. **Schema**: Update `specs/tables.sql` with boat_registry table
3. **Service**: Create `app/lib/boat-registry/service.ts` with lookup/save functions
4. **Screenscraping**: Update `fetchSailboatDetails` to check registry first
5. **API Route**: Update `/api/sailboatdata/fetch-details` to use registry
6. **Testing**: Add unit and integration tests
7. **Documentation**: Update API documentation

## Edge Cases & Considerations

### Registry Data Freshness

**Question**: Should we refresh registry data periodically?

**Decision**: For MVP, registry data is considered "good enough" once cached. Future enhancement could add:
- `last_fetched_at` timestamp check
- Refresh if data is older than X days/months
- Manual refresh option for users

### Duplicate Handling

- `make_model` is unique (enforced by constraint)
- If same make/model fetched with different slugs, update slug if missing
- Handle case-insensitive make_model matching (normalize to lowercase?)

### Data Migration

- Consider backfilling registry with existing boat data?
- **Decision**: No - registry is forward-looking. Only cache new fetches.

### Registry Cleanup

- Monitor table size
- Consider archiving old/unused entries (low `fetch_count`)
- **Decision**: Defer to future task if needed

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `migrations/036_create_boat_registry_table.sql` | Create | Database migration |
| `specs/tables.sql` | Modify | Add boat_registry table definition |
| `app/lib/boat-registry/service.ts` | Create | Registry lookup/save service |
| `app/lib/sailboatdata_queries.ts` | Modify | Add registry check before external fetch |
| `app/api/sailboatdata/fetch-details/route.ts` | Modify | Use registry service |
| `app/lib/boat-registry/__tests__/service.test.ts` | Create | Unit tests |

## Success Criteria

- ✅ Registry table created with correct schema
- ✅ Boat data fetched from external source is saved to registry
- ✅ Subsequent lookups for same make/model return registry data (no external call)
- ✅ Both AI-assisted and manual flows use registry
- ✅ Registry updates existing entries when new data is fetched
- ✅ Performance improvement: registry hits are faster than external fetches
- ✅ No breaking changes to existing boat creation flows
<!-- SECTION:PLAN:END -->
