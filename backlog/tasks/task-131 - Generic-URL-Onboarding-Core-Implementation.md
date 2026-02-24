---
id: TASK-131
title: Generic URL Onboarding - Core Implementation
status: Done
assignee: []
created_date: '2026-02-24 11:48'
updated_date: '2026-02-24 17:33'
labels:
  - onboarding
  - feature
  - url-import
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement generic URL-based onboarding bootstrapping feature that allows users to paste a link to their existing profile/post to auto-fill onboarding details.

## Context
Users can start onboarding by pasting a URL to any public web resource (Facebook posts, blogs, forum profiles, etc.). The system detects the platform, fetches the content (via Facebook API for authenticated posts, or ScraperAPI fallback for generic URLs), and passes the extracted content to the AI onboarding assistant as context.

## Scope
Implement all core functionality ready for integration:
- URL detection and validation
- Content fetching (Facebook OAuth + ScraperAPI)
- Backend API endpoint
- React component for URL import
- Integration with existing onboarding flow
- Comprehensive testing

**EXCLUDES:** Front-page UI integration (modal/card placement) - will be added in follow-up phase.

## Documentation Reference
See GENERIC_URL_ONBOARDING_ANALYSIS.md for detailed architecture, design, and implementation guidance.

## Key Technical Decisions
- Uses existing ScraperAPI service (app/lib/sailboatdata_queries.ts) instead of new scrapers
- Facebook OAuth via existing Supabase Auth integration
- Three-tier graceful degradation: API → Scraper → Manual paste
- Supports: Facebook, Twitter (future), generic web resources
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Core functionality implemented and testable
- [ ] #2 All subtasks completed
- [ ] #3 Code passes linting and type checking
- [ ] #4 Error handling and edge cases covered
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All acceptance criteria met
- [ ] #2 Code reviewed for correctness
- [ ] #3 No console errors or warnings
- [ ] #4 Typescript types fully specified
<!-- DOD:END -->
