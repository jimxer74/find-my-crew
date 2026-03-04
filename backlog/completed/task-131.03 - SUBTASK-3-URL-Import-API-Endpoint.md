---
id: TASK-131.03
title: 'SUBTASK 3: URL Import API Endpoint'
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
Implement the backend API endpoint that orchestrates URL import.

## Implementation File
`app/api/url-import/fetch-content/route.ts`

## Requirements
Create a Next.js API route that:

### Endpoint: POST /api/url-import/fetch-content

**Request Body:**
```typescript
{
  url: string;  // URL to import from
}
```

**Response (Success):**
```typescript
{
  success: true;
  resourceType: 'facebook' | 'twitter' | 'generic';
  content: string;
  title?: string;
  author?: string;
  source: 'api' | 'scraper';
  metadata: Record<string, any>;
  preview: string;  // First 300 chars + "..."
}
```

**Response (Error):**
```typescript
{
  error: string;  // User-friendly error message
}
```

### Authentication & Authorization
1. Require authenticated user (check Supabase session)
2. Extract OAuth tokens from user's identities (if they authenticated with Facebook/Twitter)
3. Pass tokens to content fetcher for API access

### Validation
1. Validate request body (url is string)
2. Validate URL format using detectResourceType
3. Reject suspicious patterns (javascript:, data:, etc.)
4. Rate limiting: max 10 imports per user per hour

### Integration
1. Call detectResourceType() to identify resource
2. Check if user has OAuth token for that provider
3. Call fetchResourceContent() with appropriate options
4. Return structured response
5. Handle and log errors appropriately

### Error Handling
Return 400/401/500 with appropriate error messages:
- 400: Invalid URL / Invalid request
- 401: Not authenticated / Missing permissions
- 429: Too many requests (rate limited)
- 500: Failed to fetch content

### Logging
Log successful imports and errors with:
- User ID
- URL
- Resource type
- Success/failure
- Error details (if failed)

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Endpoint accessible at POST /api/url-import/fetch-content
- [x] #2 Validates URL format before processing
- [x] #3 Requires authenticated user
- [x] #4 Extracts user's OAuth tokens if available
- [x] #5 Detects resource type correctly
- [x] #6 Calls fetchResourceContent with proper options
- [x] #7 Returns success response with proper structure
- [x] #8 Returns error response with user-friendly messages
- [x] #9 Implements rate limiting (10/hour)
- [x] #10 Logs all imports and errors
- [x] #11 Handles all error cases (network, timeout, rate limit)
- [x] #12 Fully typed with TypeScript
- [x] #13 Uses Supabase server client from getSupabaseServer()
<!-- SECTION:DESCRIPTION:END -->

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
✅ Completed 2026-02-24

- app/api/url-import/fetch-content/route.ts created

- POST /api/url-import/fetch-content endpoint implemented

- Authentication, validation, rate limiting (10/hour)

- Error handling and logging

- All 13 acceptance criteria met
<!-- SECTION:NOTES:END -->
