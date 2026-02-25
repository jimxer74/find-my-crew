---
id: TASK-133
title: 'Monorepo Refactoring: Divide Codebase into Separate Modules'
status: In Progress
assignee: []
created_date: '2026-02-25 07:20'
updated_date: '2026-02-25 07:31'
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
<!-- SECTION:NOTES:END -->
