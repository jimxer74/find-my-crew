---
id: TASK-119
title: Create Playwright Agentic Tests for Crew Role
status: In Progress
assignee:
  - claude
created_date: '2026-02-19 07:07'
updated_date: '2026-02-19 10:16'
labels:
  - Testing
  - Playwright
  - Crew-Role
  - Agentic-Testing
dependencies: []
references:
  - 'https://playwright.dev/docs/intro'
  - 'https://playwright.dev/docs/auth'
documentation:
  - tests/plans/crew-playwright-test-plan.md
  - playwright.config.ts
  - tests/fixtures/auth.setup.ts
  - tests/fixtures/testData.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create comprehensive Playwright tests for the crew role side of Find My Crew application, covering leg browsing, map interactions, and registration flows.

## Scope
Test the following crew routes and features:
- `/crew` - Home page with leg browsing by region
- `/crew/dashboard` - Interactive Mapbox map with leg discovery
- `/crew/registrations` - My registrations list
- `/profile` - User profile and preferences
- Registration flow (multi-step dialogs)
- Filters and search functionality
- Mobile-specific behaviors
- Authentication boundaries

## Test Plan
A comprehensive test plan has been created with:
- **10 test suites** organized by feature area
- **148 test cases** with detailed descriptions, steps, and assertions
- Selector references for Playwright locators
- Test data fixtures and seed requirements
- Mobile viewport testing guidance
- API route documentation

Test Plan Location: `/C:/Users/OWNER/Projects/next-projects/find-my-crew/tests/plans/crew-playwright-test-plan.md`

## Test Suites (148 tests total)
1. Crew Home Page (/crew) - 15 tests
2. Crew Dashboard / Map View (/crew/dashboard) - 15 tests
3. Leg Details Panel - 9 tests
4. Filters & Search - 12 tests
5. Registration Flow - 17 tests
6. My Registrations (/crew/registrations) - 10 tests
7. User Profile & Preferences - 7 tests
8. Mobile-Specific Behavior - 9 tests
9. Authentication Boundaries - 7 tests
10. Accessibility & Edge Cases - 9 tests

## Implementation Phases
1. **Phase 1: High-Priority Test Generation** (Suites 1-5)
   - Generate tests for Home, Dashboard, Details Panel, Filters, Registration
   - These cover the main user workflows
   
2. **Phase 2: Remaining Core Tests** (Suites 6-7)
   - My Registrations and Profile tests
   
3. **Phase 3: Cross-Browser & Edge Cases** (Suites 8-10)
   - Mobile tests, auth boundary tests, accessibility tests
   
4. **Phase 4: Test Execution & Debugging**
   - Run test suite against live dev environment
   - Fix any failing tests using playwright-test-healer agent
   - Establish CI/CD integration

## Required Setup
- Test environment variables configured (.env.local)
- Test database seeded with:
  - 12+ cruising regions
  - Multiple legs with different requirement types
  - Test crew users (complete profile, incomplete profile, no AI consent)
  - Sample registrations in various statuses
- Mapbox token configured
- playwright.config.ts updated with auth setup project

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test plan document created with 148 test cases across 10 suites
- [x] #2 Phase 1 tests generated (Suites 1-5: Home, Dashboard, Details, Filters, Registration)
- [ ] #3 All Phase 1 tests validated to run without errors
- [ ] #4 Phase 2-3 tests generated and passing
- [ ] #5 Test database properly seeded with required test data
- [ ] #6 CI/CD integration for Playwright tests configured
<!-- SECTION:DESCRIPTION:END -->

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Phase 1 test generation complete: 68 tests across 5 files in tests/crew/ directory

Phase 1 Test Suite Files:
- tests/crew/crew-home.spec.ts (15 tests)
- tests/crew/crew-dashboard.spec.ts (15 tests)
- tests/crew/leg-details-panel.spec.ts (9 tests)
- tests/crew/filters.spec.ts (12 tests)
- tests/crew/registration-flow.spec.ts (17 tests)

Total Phase 1 Tests: 68
Phase 2-3 tests remain pending.
<!-- SECTION:NOTES:END -->
