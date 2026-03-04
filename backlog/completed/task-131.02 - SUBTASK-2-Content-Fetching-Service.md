---
id: TASK-131.02
title: 'SUBTASK 2: Content Fetching Service'
status: Done
assignee: []
created_date: '2026-02-24 11:49'
updated_date: '2026-02-24 11:51'
labels: []
dependencies: []
parent_task_id: TASK-131
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement multi-tier content fetching with Facebook API and ScraperAPI fallback.

## Implementation Files
- `app/lib/url-import/fetchResourceContent.ts` (main orchestrator)
- `app/lib/url-import/fetchers/facebook.ts` (Facebook API + scraper)
- `app/lib/url-import/fetchers/twitter.ts` (Twitter API + scraper)
- `app/lib/url-import/fetchers/generic.ts` (generic web scraper)

## Requirements
Create a content fetching service that:

### Main Orchestrator (fetchResourceContent.ts)
1. Accepts FetchOptions with URL, resourceType, authProvider, and optional accessToken
2. Routes to appropriate fetcher based on resource type
3. Returns structured FetchResult with:
   - content: extracted text (max 5000 chars)
   - title: page/post title if available
   - author: content author if available
   - url: final URL (after redirects)
   - fetchedAt: ISO timestamp
   - source: 'api' | 'scraper'
   - metadata: platform-specific data

### Facebook Fetcher
1. If authenticated: use Graph API to fetch post/profile content
2. Fallback: use ScraperAPI for unauthenticated access
3. Extract: message, story, creation time, permalink
4. Handle: Invalid post IDs, permission errors

### Twitter Fetcher
1. If authenticated: use Twitter API v2
2. Fallback: use ScraperAPI
3. Extract: tweet text, author, creation date
4. Handle: deleted tweets, private accounts

### Generic Web Fetcher
1. Use existing fetchWithScraperAPI() from sailboatdata_queries.ts
2. Enable JavaScript rendering (render=true) for SPAs
3. Strip HTML/scripts/styles, extract text content
4. Handle: timeouts, blocked content, large pages

### Error Handling
- Graceful fallback from API → Scraper → Error
- User-friendly error messages
- Log errors for debugging
- Don't expose sensitive info in error messages

## Type Definitions
```typescript
interface FetchOptions {
  url: string;
  resourceType: ResourceType;
  authProvider?: AuthProvider;
  accessToken?: string;
  userId?: string;
}

interface FetchResult {
  content: string;
  title?: string;
  author?: string;
  url: string;
  fetchedAt: string;
  source: 'api' | 'scraper';
  metadata: Record<string, any>;
}

async function fetchResourceContent(options: FetchOptions): Promise<FetchResult>
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Facebook API fetcher works with valid access token
- [x] #2 Facebook fallback to scraper when unauthenticated
- [x] #3 Twitter API fetcher works with valid access token
- [x] #4 Twitter fallback to scraper
- [x] #5 Generic web scraper uses existing ScraperAPI
- [x] #6 Content truncated to 5000 characters max
- [x] #7 HTML/scripts/styles stripped from scraped content
- [x] #8 Error messages are user-friendly
- [x] #9 All errors logged with sufficient context
- [x] #10 Metadata extracted for each platform
- [x] #11 Fully typed with TypeScript
- [x] #12 Handles edge cases (redirects, timeouts, blocked content)
<!-- SECTION:DESCRIPTION:END -->

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
✅ Completed 2026-02-24

- app/lib/url-import/fetchResourceContent.ts created

- Implements Facebook API + ScraperAPI, Twitter API + ScraperAPI, generic scraper

- Multi-tier fallback system implemented

- Full test coverage in __tests__/fetchResourceContent.test.ts

- All 12 acceptance criteria met
<!-- SECTION:NOTES:END -->
