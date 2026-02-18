---
id: TASK-116
title: Migrate all console.log/error/warn to logger framework (604 statements)
status: In Progress
assignee: []
created_date: '2026-02-18 15:29'
labels:
  - logger-migration
  - refactoring
  - large-scale
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate all remaining console.log/console.error/console.warn statements in the app/ directory to the production-safe logger framework. This is a large-scale refactoring affecting 152 files with 604 total console statements.

## Files to migrate by category:
- API routes (~50 files)
- Components (~40 files) 
- Hooks (~5 files)
- Utilities/Services (~30 files)
- Pages (~25 files)
- Contexts (~3 files)

## Migration approach:
1. Process files in order of priority:
   - API routes first (highest impact)
   - Then components
   - Then hooks
   - Then utilities
   - Then pages
   - Then contexts

2. For each file:
   - Replace console.log → logger.info() or logger.debug()
   - Replace console.error → logger.error() with safe error extraction
   - Replace console.warn → logger.warn()
   - Use logger.aiFlow() for AI-related logs
   - Add logger import

3. Commit in logical groups (e.g., API routes, components, etc.)

## Logger API:
```
logger.trace(message, context?)
logger.debug(message, context?, aiFlow?)
logger.info(message, context?)
logger.warn(message, context?)
logger.error(message, context?)
logger.aiFlow(stage, message, context?)
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All 152 files with console statements migrated to logger
- [ ] #2 604 console statements replaced with appropriate logger calls
- [ ] #3 Build passes without errors
- [ ] #4 All migrations committed with clear commit messages
<!-- AC:END -->
