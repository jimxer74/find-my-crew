---
id: TASK-131.01
title: 'SUBTASK 1: URL Detection & Validation Service'
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
Implement URL resource type detection and validation logic.

## Implementation File
`app/lib/url-import/detectResourceType.ts`

## Requirements
Create a utility module that:
1. Validates URL format (must be valid URL, not javascript: or data: URIs)
2. Detects resource type by domain and URL pattern:
   - Facebook: posts and profile URLs
   - Twitter: tweet and profile URLs
   - Generic web: blogs, forums, personal websites
3. Returns structured DetectionResult with:
   - resourceType: 'facebook' | 'twitter' | 'generic'
   - authProvider: 'facebook' | 'twitter' | null
   - resourceId: extracted ID (post ID, username, etc.)
   - domain: normalized domain
   - metadata: additional platform-specific info

## Type Definitions
```typescript
type ResourceType = 'facebook' | 'twitter' | 'generic';
type AuthProvider = 'facebook' | 'twitter' | null;

interface DetectionResult {
  resourceType: ResourceType;
  authProvider: AuthProvider;
  resourceId?: string;
  domain: string;
  metadata: Record<string, any>;
}

function detectResourceType(url: string): DetectionResult
function isValidUrl(str: string): boolean
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Correctly detects Facebook post URLs (facebook.com/user/posts/ID)
- [x] #2 Correctly detects Facebook profile URLs (facebook.com/username)
- [x] #3 Correctly detects Twitter/X post URLs (twitter.com/user/status/ID, x.com/...)
- [x] #4 Correctly detects Twitter profile URLs
- [x] #5 Validates URL format (rejects javascript:, data:, invalid URLs)
- [x] #6 Extracts resource IDs and metadata correctly
- [x] #7 Handles edge cases (www prefix, trailing slashes, query params)
- [x] #8 Exports isValidUrl helper for upstream validation
- [x] #9 Fully typed with TypeScript (no any types except metadata dict)
- [x] #10 Includes JSDoc comments for functions
<!-- SECTION:DESCRIPTION:END -->

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
✅ Completed 2026-02-24

- app/lib/url-import/detectResourceType.ts created

- Supports Facebook, Twitter, generic web detection

- Full test coverage in __tests__/detectResourceType.test.ts

- All 10 acceptance criteria met
<!-- SECTION:NOTES:END -->
