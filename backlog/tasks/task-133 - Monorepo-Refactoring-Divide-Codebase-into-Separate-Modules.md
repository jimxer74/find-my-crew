---
id: TASK-133
title: 'Monorepo Refactoring: Divide Codebase into Separate Modules'
status: In Progress
assignee: []
created_date: '2026-02-25 07:20'
updated_date: '2026-02-25 08:20'
labels:
  - Architecture
  - Monorepo
  - Refactoring
  - Modularity
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor the codebase into a monorepo structure to improve modularity, code reuse, and maintainability. Divide the application into separate modules: crew-matching (current core app), shared (common capabilities), and boat-management (new module).

## Goal
Create a scalable monorepo architecture that allows clear separation of concerns, code reuse across applications, independent module development, and future expansion to additional apps/services.

## Proposed Module Structure

### shared/ (Common Capabilities)
Foundational code used across all applications: ai/, auth/, database/, logging/, types/, utils/, hooks/, lib/

### crew-matching/ (Current Main App)
Crew-matching and journey exploration: app/, components/, contexts/, lib/

### boat-management/ (New Module - Future)
Boat management capabilities: app/, components/, lib/

## Implementation Phases

Phase 1: Planning & Audit - Document module boundaries and dependencies
Phase 2: Shared Module Extraction - Extract shared code (types, auth, db, logging, utils, hooks, ai)
Phase 3: Crew-Matching Module Setup - Reorganize existing code under crew-matching module
Phase 4: Integration & Testing - Update builds, verify functionality, test imports
Phase 5: Documentation - Document structure and create guidelines

## Key Considerations
- Import paths strategy (e.g., @crew-matching/*, @shared/*, @boat-management/*)
- Dependency direction: all modules → shared (no cross-module dependencies)
- Build configuration for monorepo (Next.js, TypeScript, workspaces)
- Environment variables and configuration management
- Testing strategy for cross-module testing
- CI/CD pipeline updates for monorepo deployment
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Monorepo structure created with shared, crew-matching, and boat-management modules
- [ ] #2 All shared code extracted and moved to shared module
- [ ] #3 Crew-matching module correctly imports from shared module
- [ ] #4 Build system configured for monorepo (pnpm/npm workspaces)
- [ ] #5 All 82 pages compile successfully with new structure
- [ ] #6 Zero regressions in existing functionality
- [ ] #7 Module boundaries documented and defined
- [ ] #8 Import paths consistent using alias strategy
- [ ] #9 CI/CD pipeline updated for monorepo
- [ ] #10 Boat-management module template created for future development
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Phase 1: Planning & Audit (In Progress)

### Codebase Audit

Analyzing current structure to identify shared vs. crew-specific code...

## Phase 1 COMPLETE: Planning & Audit ✅

**Audit Completed:** 2026-02-25

**Key Findings:**

- Codebase cleanly separates into 3 modules

- 10+ functional shared areas (auth, db, ai, logging, ui, utils, hooks, contexts)

- Clear crew-specific and boat-management specific code

- Single Next.js app can migrate to workspaces smoothly

**Deliverables:**

✅ Comprehensive audit report (TASK-133-Phase1-Audit.md)

✅ Module boundaries documented

✅ Dependency mapping (@crew-matching→@shared, @boat-management→@shared)

✅ Import path strategy designed

✅ Risk assessment (low/medium/high)

✅ Detailed Phase 2-5 migration plan

**Next Step: Phase 2 - Shared Module Extraction

Begin extracting auth, db, ai, logging, ui, utils, hooks, contexts to shared/ module

## Phase 2: Shared Module Extraction (In Progress)

Started: 2026-02-25

**Execution Plan:**

1. Create shared/ directory structure

2. Extract types/ - No dependencies

3. Extract logging/ - No dependencies

4. Extract utils/ - Minimal dependencies

5. Extract hooks/ - Depends on auth (handle later)

6. Extract ui/ - Design system

7. Extract auth/ - Core auth system

8. Extract database/ - Database setup

9. Extract ai/ - AI foundation

10. Extract contexts/ - Shared contexts

Starting with Step 1: Directory structure creation...

Phase 2 Status Update (2026-02-25): Extraction started - shared/ directory created with 154 files (ai/, auth/, contexts/, etc.). Next: 1) Complete extraction of remaining modules to shared/, 2) Update all imports in app/ to use @shared/*, 3) Verify all 82 pages compile, 4) Begin crew-matching module setup

## Phase 2 Progress Update (2026-02-25 10:00)

Discovered build blockers requiring immediate fixes:
1. **Import path issues in shared/ modules** - Files still reference @/app/lib paths instead of @shared/ paths
   - logger imports: @/app/lib/logger → @shared/logging
   - geocoding imports: @/app/lib/geocoding → @shared/utils/geocoding
   - relative path imports: ../../logger, ../../geocoding/geocoding need fixing

2. **Identified affected files**:
   - shared/ai/assistant/toolExecutor.ts - 3 imports need fixing
   - shared/ai/shared/*.ts files - logger imports need fixing
   - 30+ files across shared/ referencing @/app/lib paths

3. **Extraction status**: 148 files copied to shared/ but import paths not yet migrated

**Current action**: Fixing critical import paths to unblock compilation

**Next steps after import fixes**:
1. Complete import path migration across all shared/ files
2. Rebuild and verify 82 pages compile
3. Begin crew-matching module setup

## Phase 2 MILESTONE ACHIEVED: Import Path Migration Complete ✅

**Completed: 2026-02-25 10:30**

**Scope**: Fixed all import paths across 148 shared/ files to use correct @shared/* paths

**Issues Resolved**:
1. ✅ @/app/lib/logger → @shared/logging (30+ files)
2. ✅ @/app/lib/geocoding → @shared/utils/geocoding (20+ files)
3. ✅ @/app/lib/ai → @shared/ai (15+ files)
4. ✅ @/app/lib/supabaseClient → @shared/database/client (5+ files)
5. ✅ @/app/lib/supabaseServer → @shared/database/server
6. ✅ @/app/lib/designTokens → @shared/ui/designTokens (10+ files)
7. ✅ Relative paths (../../logger, ../lib/logger, ../supabaseClient) → @shared/* paths
8. ✅ Export conflicts resolved (createErrorResponse, BoundingBox)
9. ✅ Non-existent file exports removed from index files
10. ✅ Circular import prevention

**Build Status**: ✓ ALL 82 PAGES COMPILE SUCCESSFULLY

**Files Modified**: 
- 50+ shared/ files with import corrections
- 5 index.ts files with export corrections
- tsconfig.json (path aliases already configured)

**Key Changes**:
- shared/utils/skillMatching.ts - logger import fixed
- shared/ai/assistant/toolExecutor.ts - 3 import paths fixed
- shared/ai/shared/*.ts - logger and geocoding imports fixed
- shared/auth/index.ts - removed non-existent exports
- shared/auth/UserRoleContext.tsx - fixed cross-module imports
- shared/contexts/ConsentSetupContext.tsx - fixed auth import
- shared/contexts/index.ts - removed non-existent context exports
- shared/database/index.ts - removed duplicate exports
- shared/hooks/useProfile.tsx - fixed auth and database imports
- shared/hooks/index.ts - commented out unextracted hooks
- shared/ai/index.ts - removed non-existent AIService export
- shared/ai/shared/index.ts - removed duplicate BoundingBox export
- shared/types/index.ts - removed non-existent risk-levels export

**Next Phase**: Phase 2 Continuation - Complete remaining module extraction steps

**Remaining Phase 2 Tasks**:
1. Update app/ imports to use @shared/* (where appropriate)
2. Extract remaining hooks (useUserLocation, useMediaQuery, useNotifications) to shared/
3. Extract profile-related code to shared/ if it's truly shared
4. Remove app/lib/supabaseClient and app/lib/supabaseServer if no longer needed
5. Phase 3: Begin crew-matching module setup
<!-- SECTION:NOTES:END -->
