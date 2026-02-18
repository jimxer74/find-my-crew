---
id: TASK-118.04
title: Specialized Domain Components Consolidation
status: To Do
assignee: []
created_date: '2026-02-18 21:10'
labels:
  - Components
  - Consolidation
  - Domain
dependencies: []
parent_task_id: TASK-118
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor domain-specific components (business logic components like LegCard, RegistrationForm, OwnerChat, ProspectChat, etc.) to use the core component library and consolidate duplicate implementations.

## Scope
Take existing domain-specific components and refactor them to leverage core components from TASK-118.3. This eliminates duplication, enforces consistency, and makes domain components simpler and more maintainable.

## What This Task Produces
- All domain components refactored to use core components
- Duplicate component implementations merged
- Consistent styling across similar domain components
- Proper TypeScript types for all domain components
- Consistent API integration patterns

## Dependencies
- **Depends on**: TASK-118.03 (Core Generic Components Library)
- This task uses core components created in TASK-118.3

## Examples of Components to Consolidate
- LegCard variants
- RegistrationForm and related forms
- OwnerChat and ProspectChat components
- Various card and list item implementations
- Custom modals and dialogs
- Custom form inputs and selects

## Key Responsibilities
1. Identify all domain-specific components
2. Map them to core components they should use
3. Refactor each to remove custom styling and use core components
4. Merge duplicate or near-duplicate implementations
5. Ensure API integration is consistent across similar components
6. Update TypeScript types for clarity and consistency
7. Test all refactored components for functionality
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All domain-specific components refactored to use core component library
- [ ] #2 Duplicate component implementations identified and consolidated into single implementations
- [ ] #3 Consistent styling across similar domain components (e.g., all cards use Card component)
- [ ] #4 All domain components properly typed with TypeScript
- [ ] #5 API integration patterns consistent across similar components (e.g., all forms use same pattern)
- [ ] #6 All refactored components tested and functional
- [ ] #7 Documentation updated to reflect new component usage patterns
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All component refactors reviewed and approved
- [ ] #2 No functionality lost in refactoring
- [ ] #3 Performance impact assessed and acceptable
<!-- DOD:END -->
