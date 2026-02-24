---
id: TASK-131.04
title: 'SUBTASK 4: URL Import React Component'
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
Implement the URLImportForm React component for user-facing URL import.

## Implementation File
`app/components/onboarding/URLImportForm.tsx`

## Requirements
Create a client-side React component that:

### Component Props
```typescript
interface URLImportFormProps {
  onSuccess: (content: string, metadata: any) => void;
  onSkip: () => void;
}
```

### Component States

**1. Initial State - URL Input**
- Text input: \"Paste URL to your profile or post\"
- Placeholder: \"https://facebook.com/john/posts/12345\"
- Help text: \"Works with Facebook, Twitter, personal blogs, and more\"
- Instructions:
  - Facebook: Go to your post → Click share → Copy link
  - Blog/Website: Copy the page URL from address bar
- Buttons: [Import Profile/Post] [Skip]
- Loading state: Shows spinner + \"Fetching...\"
- Error state: Shows red alert with error message

**2. Preview State - Content Review**
- Green success banner: \"Content Found\"
- Source badge: \"Source: api/scraper (facebook/twitter/generic)\"
- Content preview box: First 300 chars of extracted content
- Buttons: [Use This Content] [Try Another URL]

### Functionality

**Input Handling:**
1. Validate URL format on input (basic check)
2. Disable import button if URL empty
3. Disable input while loading

**Import Flow:**
1. User pastes URL and clicks [Import]
2. POST to /api/url-import/fetch-content
3. Show loading spinner
4. On success: Show preview with content
5. On error: Show user-friendly error message with retry option

**Success Flow:**
1. User reviews preview
2. Clicks [Use This Content]
3. Calls onSuccess(content, metadata)
4. Parent component handles next steps

**Error Flow:**
1. Display error message
2. Allow retry (URL input still available)
3. Option to skip and continue manually

### UI/UX
- Use existing UI patterns from codebase
- Include icons: AlertCircle, Loader, CheckCircle
- Responsive: Works on mobile and desktop
- Accessible: Proper labels, ARIA attributes
- Loading states: Clear feedback during fetch
- Error messages: User-friendly, actionable

### Type Definitions
```typescript
interface URLImportFormProps {
  onSuccess: (content: string, metadata: any) => void;
  onSkip: () => void;
}

// Component state
const [url, setUrl] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [preview, setPreview] = useState<{
  content: string;
  source: string;
  type: string;
} | null>(null);
```

## Acceptance Criteria
- [x] Component renders URL input form on initial load
- [x] User can enter URL and validate format
- [x] Clicking import calls /api/url-import/fetch-content
- [x] Loading spinner shows during fetch
- [x] Success shows preview with content
- [x] Error shows user-friendly message
- [x] [Use This Content] calls onSuccess with content + metadata
- [x] [Skip] calls onSkip callback
- [x] [Try Another URL] returns to input state
- [x] Help text explains how to get URLs
- [x] Responsive design (mobile + desktop)
- [x] No console errors or warnings
- [x] Fully typed with TypeScript
- [x] Uses lucide-react icons consistently
<!-- SECTION:DESCRIPTION:END -->
