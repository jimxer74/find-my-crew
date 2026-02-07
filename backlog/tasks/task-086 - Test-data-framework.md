---
id: TASK-086
title: Test data framework
status: In Progress
assignee: []
created_date: '2026-02-07 15:08'
updated_date: '2026-02-07 15:30'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A solution to easily manage and create test data for the app testing. It should include all required data that is needed for full testing of the app. Things that should be controllable: 
* Is existing data cleared before adding new
* Control of of much data is generated / created
* ... something else as well? please add if found relevant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI command `npm run seed:test-data` works with configurable options
- [ ] #2 Can clear existing data before seeding (respects FK constraints)
- [ ] #3 Creates real auth.users via Supabase Admin API
- [ ] #4 Generates semi-realistic sailing-themed profiles with sensible skills
- [ ] #5 Includes library of real sailing routes (Mediterranean, Caribbean, Baltic, etc.)
- [ ] #6 Supports presets: minimal, standard, full
- [ ] #7 Deterministic output with same seed produces same data
- [ ] #8 Can export generated data to JSON for reproducibility
- [ ] #9 All entity relationships maintained (profiles → boats → journeys → legs → waypoints → registrations)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Project Setup
1. Create `scripts/test-data/` directory structure
2. Set up TypeScript configuration for scripts
3. Create Supabase admin client using service role key
4. Add npm script `seed:test-data` to package.json

### Phase 2: Core Infrastructure
1. **`scripts/test-data/config.ts`** - Configuration types and defaults
   - DataConfig interface with counts per entity
   - Preset definitions (minimal, standard, full)
   - Seed value for deterministic generation

2. **`scripts/test-data/utils/supabase-admin.ts`** - Admin client
   - Uses SUPABASE_SERVICE_ROLE_KEY for admin access
   - Bypasses RLS for data insertion

3. **`scripts/test-data/utils/seeded-random.ts`** - Deterministic randomness
   - Seeded PRNG for reproducible data
   - Helper functions for random selection

4. **`scripts/test-data/utils/cleanup.ts`** - Database cleanup
   - Truncate tables in correct FK order
   - Option to preserve specific users

### Phase 3: Data Libraries
1. **`scripts/test-data/data/sailing-routes.ts`** - Real route coordinates
   - Mediterranean routes (Gibraltar → Greece, French Riviera, etc.)
   - Caribbean routes (Virgin Islands, Windward Islands)
   - Baltic Sea routes
   - Atlantic crossings
   - Each route: array of {name, lat, lng} waypoints

2. **`scripts/test-data/data/sailing-names.ts`** - Realistic names
   - Boat names (nautical themed)
   - Profile names
   - Port names
   - Skill combinations that make sense

### Phase 4: Entity Generators
Each generator creates entities respecting the schema from `specs/tables.sql`:

1. **`generators/profiles.ts`**
   - Creates auth.users via Admin API
   - Creates matching profile record
   - Semi-realistic: sailing experience, certifications, skills, risk levels
   - Returns created user IDs for FK references

2. **`generators/boats.ts`**
   - Links to owner profiles
   - Realistic sailboat specs (Bavaria, Jeanneau, Beneteau, etc.)
   - Proper sailboat_category enum values
   - Calculated performance ratios

3. **`generators/journeys.ts`**
   - Links to boats
   - Realistic date ranges (future dates)
   - Appropriate risk levels, cost models
   - Mix of journey states

4. **`generators/legs.ts`**
   - Links to journeys
   - Sequential dates within journey range
   - Crew needed counts
   - Skills and experience requirements

5. **`generators/waypoints.ts`**
   - Links to legs
   - Uses real sailing route coordinates
   - PostGIS-compatible Point geometry format
   - Proper indexing for route order

6. **`generators/registrations.ts`**
   - Links crew profiles to legs
   - Mix of registration statuses
   - Match percentage calculations

7. **`generators/notifications.ts`**
   - Various notification types
   - Mix of read/unread

8. **`generators/consents.ts`**
   - User consent records
   - Consent audit log entries

### Phase 5: Main Orchestrator
1. **`scripts/test-data/index.ts`** - CLI entry point
   - Parse CLI arguments (--preset, --clear, --seed, --export)
   - Execute generators in correct order
   - Handle errors gracefully
   - Report generated counts

### Phase 6: Export Feature
1. **`scripts/test-data/utils/export.ts`**
   - Export generated data to JSON
   - Include metadata (seed, timestamp, counts)
   - Importable format for later use

---

## File Structure

```
scripts/
└── test-data/
    ├── index.ts                 # CLI entry point
    ├── config.ts                # Types, presets, defaults
    ├── data/
    │   ├── sailing-routes.ts    # Real waypoint coordinates
    │   ├── sailing-names.ts     # Names, skills, certifications
    │   └── boat-specs.ts        # Real sailboat specifications
    ├── generators/
    │   ├── index.ts             # Orchestrator
    │   ├── profiles.ts
    │   ├── boats.ts
    │   ├── journeys.ts
    │   ├── legs.ts
    │   ├── waypoints.ts
    │   ├── registrations.ts
    │   ├── notifications.ts
    │   └── consents.ts
    └── utils/
        ├── supabase-admin.ts    # Service role client
        ├── seeded-random.ts     # Deterministic RNG
        ├── cleanup.ts           # Table truncation
        └── export.ts            # JSON export
```

---

## Preset Configurations

### Minimal (quick testing)
- 3 profiles (1 owner, 2 crew)
- 1 boat
- 1 journey with 2 legs
- 4 waypoints per leg
- 2 registrations

### Standard (development)
- 10 profiles (3 owners, 7 crew)
- 4 boats
- 6 journeys
- 15 legs total
- ~60 waypoints
- 20 registrations

### Full (load testing)
- 50 profiles
- 15 boats
- 30 journeys
- 100 legs
- ~400 waypoints
- 150 registrations

---

## CLI Usage

```bash
# Use standard preset, clear existing data
npm run seed:test-data -- --preset standard --clear

# Use minimal preset with specific seed
npm run seed:test-data -- --preset minimal --seed 12345

# Export generated data
npm run seed:test-data -- --preset standard --export ./test-data.json

# Custom counts
npm run seed:test-data -- --profiles 20 --boats 5 --clear
```

---

## Dependencies
- No new npm packages needed
- Uses existing @supabase/supabase-js
- Built-in Node.js crypto for seeded random
<!-- SECTION:PLAN:END -->
