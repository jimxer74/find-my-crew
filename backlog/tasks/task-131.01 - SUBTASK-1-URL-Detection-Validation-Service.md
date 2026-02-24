---
id: TASK-131.01
title: 'SUBTASK 1: URL Detection & Validation Service'
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
- [x] Correctly detects Facebook post URLs (facebook.com/user/posts/ID)
- [x] Correctly detects Facebook profile URLs (facebook.com/username)
- [x] Correctly detects Twitter/X post URLs (twitter.com/user/status/ID, x.com/...)
- [x] Correctly detects Twitter profile URLs
- [x] Validates URL format (rejects javascript:, data:, invalid URLs)
- [x] Extracts resource IDs and metadata correctly
- [x] Handles edge cases (www prefix, trailing slashes, query params)
- [x] Exports isValidUrl helper for upstream validation
- [x] Fully typed with TypeScript (no any types except metadata dict)
- [x] Includes JSDoc comments for functions
<!-- SECTION:DESCRIPTION:END -->
