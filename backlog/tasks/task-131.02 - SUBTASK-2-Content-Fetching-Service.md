---
id: TASK-131.02
title: 'SUBTASK 2: Content Fetching Service'
status: To Do
assignee: []
created_date: '2026-02-24 11:49'
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
- [x] Facebook API fetcher works with valid access token
- [x] Facebook fallback to scraper when unauthenticated
- [x] Twitter API fetcher works with valid access token
- [x] Twitter fallback to scraper
- [x] Generic web scraper uses existing ScraperAPI
- [x] Content truncated to 5000 characters max
- [x] HTML/scripts/styles stripped from scraped content
- [x] Error messages are user-friendly
- [x] All errors logged with sufficient context
- [x] Metadata extracted for each platform
- [x] Fully typed with TypeScript
- [x] Handles edge cases (redirects, timeouts, blocked content)
<!-- SECTION:DESCRIPTION:END -->
