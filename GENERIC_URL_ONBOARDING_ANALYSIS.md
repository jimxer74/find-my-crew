# Analysis: Generic URL-Based AI Onboarding Flow

> **🔄 Updated (2026-02-24):** This document now references the existing **ScraperAPI integration** already in use for boat data fetching (`app/lib/sailboatdata_queries.ts`), rather than proposing new scraper tools (Apify/Puppeteer). This leverages existing infrastructure and reduces implementation complexity.

## Concept Overview

**Universal Onboarding Bootstrap:**

```
User pastes ANY URL
    ↓
System detects resource type (Facebook, blog, etc.)
    ↓
Fetch content appropriately:
├─ Facebook post → Facebook OAuth + Graph API
├─ Personal blog/website → Screen scraper API
└─ Any public URL → Screen scraper API
    ↓
Show preview of extracted content
    ↓
Pass to AI onboarding assistant as context
    ↓
Normal AI-assisted onboarding flow continues
```

---

## Architecture Design

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User pastes URL to their sailing-related profile/post       │
│ Examples:                                                   │
│ - https://facebook.com/john/posts/12345                    │
│ - https://blog.example.com/my-sailing-journey              │
│ - https://sailing-forum.com/users/captainmike              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ URL Resource Type Detection                                 │
│                                                             │
│ Extract domain and path:                                    │
│ - facebook.com → Facebook post detector                     │
│ - sailing-related keywords → Content classifier             │
│ - Generic URL → Generic web resource                        │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬──────────────────┐
        │                │                  │
        ▼                ▼                  ▼
    Facebook         Generic Web      Error:
    Detector         Resource         Invalid URL
        │                │
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│ Check if user│  │ Fetch using  │
│ has Facebook │  │ Screen       │
│ OAuth token  │  │ Scraper API  │
└──────┬───────┘  │ (ScraperAPI) │
       │          └──────┬───────┘
       │                 │
   YES │NO               │
       │   │             │
       ▼   ▼             ▼
    Use  Start      Extracted
    Token OAuth     Content
       │   │             │
       └───┴─────────────┘
              │
        ┌─────▼─────────────┐
        │ Fetch Content via │
        │ Appropriate API   │
        │                   │
        │ - Facebook Graph  │
        │ - Screen Scraper  │
        └─────┬─────────────┘
              │
        ┌─────▼──────────────────────┐
        │ Show Content Preview       │
        │                            │
        │ "This is what we found:    │
        │ [Quoted/formatted content] │
        │                            │
        │ [Continue] [Paste Manual]" │
        └─────┬──────────────────────┘
              │
        ┌─────▼──────────────────────┐
        │ Create Context Block:      │
        │ [IMPORTED_PROFILE]         │
        │ {                          │
        │  source: "facebook"|...    │
        │  url: original URL         │
        │  content: extracted text   │
        │  metadata: {...}           │
        │ }                          │
        └─────┬──────────────────────┘
              │
        ┌─────▼──────────────────────┐
        │ Start AI Onboarding        │
        │ With [IMPORTED_PROFILE]    │
        │ context injected           │
        └─────┬──────────────────────┘
              │
        ┌─────▼──────────────────────┐
        │ Normal Onboarding Flow     │
        │ AI assists user in filling │
        │ profile, journey, crew     │
        │ requirements               │
        └────────────────────────────┘
```

---

## URL Resource Type Detection

### Detection Strategy

```typescript
// app/lib/url-import/detectResourceType.ts

type ResourceType = 'facebook' | 'twitter' | 'instagram' | 'blog' | 'generic';
type AuthProvider = 'facebook' | 'twitter' | null;

interface DetectionResult {
  resourceType: ResourceType;
  authProvider: AuthProvider;
  resourceId?: string;  // Post ID, user ID, etc.
  domain: string;
  metadata: Record<string, any>;
}

function detectResourceType(url: string): DetectionResult {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');

    // Facebook detection
    if (domain.includes('facebook.com')) {
      const postMatch = urlObj.pathname.match(/\/posts\/(\d+)/);
      const userMatch = urlObj.pathname.match(/\/(\w+)\/posts\//);

      return {
        resourceType: 'facebook',
        authProvider: 'facebook',
        resourceId: postMatch?.[1],
        domain,
        metadata: {
          isPost: !!postMatch,
          userId: userMatch?.[1],
        }
      };
    }

    // Twitter detection
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      const tweetMatch = urlObj.pathname.match(/\/status\/(\d+)/);

      return {
        resourceType: 'twitter',
        authProvider: 'twitter',
        resourceId: tweetMatch?.[1],
        domain,
        metadata: {
          isTweet: !!tweetMatch,
        }
      };
    }

    // Instagram detection
    if (domain.includes('instagram.com')) {
      const postMatch = urlObj.pathname.match(/\/p\/([^/?]+)/);

      return {
        resourceType: 'instagram',
        authProvider: null,  // Instagram harder to auth programmatically
        resourceId: postMatch?.[1],
        domain,
        metadata: {
          isPost: !!postMatch,
        }
      };
    }

    // Generic blog/website
    return {
      resourceType: 'generic',
      authProvider: null,
      domain,
      metadata: {
        path: urlObj.pathname,
      }
    };

  } catch (error) {
    throw new Error('Invalid URL provided');
  }
}
```

### Supported Platforms (Extensible)

```
Priority 1 (OAuth + Official API):
├─ Facebook ✅
└─ Twitter ✅

Priority 2 (Screen Scraper):
├─ Instagram
├─ Personal blogs
├─ Forum posts
└─ Any public URL

Easy to add:
└─ TikTok, YouTube, Medium, Dev.to, etc.
```

---

## Content Fetching Strategy

### Fetcher Selection Logic

```typescript
// app/lib/url-import/fetchResourceContent.ts

interface FetchOptions {
  url: string;
  resourceType: ResourceType;
  authProvider?: AuthProvider;
  accessToken?: string;  // If user already authenticated
  userId?: string;       // Current user ID
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

async function fetchResourceContent(
  options: FetchOptions
): Promise<FetchResult> {
  const { url, resourceType, authProvider, accessToken } = options;

  switch (resourceType) {
    // ===== FACEBOOK =====
    case 'facebook':
      if (authProvider === 'facebook' && accessToken) {
        return await fetchFacebookWithAPI(url, accessToken);
      } else {
        return await fetchFacebookWithScraper(url);
      }

    // ===== TWITTER =====
    case 'twitter':
      if (authProvider === 'twitter' && accessToken) {
        return await fetchTwitterWithAPI(url, accessToken);
      } else {
        return await fetchTwitterWithScraper(url);
      }

    // ===== GENERIC WEB RESOURCE =====
    case 'generic':
    case 'instagram':
    default:
      return await fetchWithScreenScraper(url);
  }
}
```

### Implementation: Platform-Specific Fetchers

#### Facebook Fetcher

```typescript
async function fetchFacebookWithAPI(
  url: string,
  accessToken: string
): Promise<FetchResult> {
  try {
    // Extract post ID from URL
    const postIdMatch = url.match(/\/posts\/(\d+)/);
    if (!postIdMatch) throw new Error('Invalid Facebook post URL');

    const postId = postIdMatch[1];

    // Call Graph API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}` +
      `?fields=message,story,created_time,permalink_url,full_picture` +
      `&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error('Facebook API error');
    }

    const data = await response.json();
    const content = data.message || data.story || '';

    return {
      content,
      url: data.permalink_url || url,
      fetchedAt: new Date().toISOString(),
      source: 'api',
      metadata: {
        platform: 'facebook',
        createdTime: data.created_time,
        postId: postId,
      }
    };
  } catch (error) {
    // Fallback to scraper if API fails
    console.warn('Facebook API failed, using scraper:', error);
    return await fetchFacebookWithScraper(url);
  }
}

async function fetchFacebookWithScraper(url: string): Promise<FetchResult> {
  // Use screen scraper as fallback
  // See: Generic Web Resource Fetcher below
  return await fetchWithScreenScraper(url);
}
```

#### Twitter Fetcher

```typescript
async function fetchTwitterWithAPI(
  url: string,
  accessToken: string
): Promise<FetchResult> {
  try {
    // Extract tweet ID
    const tweetIdMatch = url.match(/\/status\/(\d+)/);
    if (!tweetIdMatch) throw new Error('Invalid Twitter URL');

    const tweetId = tweetIdMatch[1];

    // Twitter API v2
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}` +
      `?tweet.fields=created_at,author_id` +
      `&expansions=author_id` +
      `&user.fields=username`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const data = await response.json();
    const content = data.data?.text || '';
    const author = data.includes?.users?.[0]?.username || '';

    return {
      content,
      author,
      url,
      fetchedAt: new Date().toISOString(),
      source: 'api',
      metadata: {
        platform: 'twitter',
        tweetId,
        createdAt: data.data?.created_at,
      }
    };
  } catch (error) {
    console.warn('Twitter API failed:', error);
    return await fetchTwitterWithScraper(url);
  }
}

async function fetchTwitterWithScraper(url: string): Promise<FetchResult> {
  return await fetchWithScreenScraper(url);
}
```

#### Generic Web Resource Fetcher (Screen Scraper)

```typescript
// Uses existing ScraperAPI integration from app/lib/sailboatdata_queries.ts
// ScraperAPI is already configured and used for boat data fetching

import { fetchWithScraperAPI } from '@/app/lib/sailboatdata_queries';

async function fetchWithScreenScraper(url: string): Promise<FetchResult> {
  try {
    // ScraperAPI automatically handles JavaScript rendering
    // and bypasses anti-bot detection
    const response = await fetchWithScraperAPI(url, {}, true);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1] || 'Untitled';

    // Extract text content (remove script/style tags)
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const content = cleanHtml.substring(0, 5000);

    return {
      content,
      title,
      url,
      fetchedAt: new Date().toISOString(),
      source: 'scraper',
      metadata: {
        platform: 'generic',
        tool: 'scraperapi'
      }
    };
  } catch (error) {
    console.error('Screen scraper failed:', error);
    throw new Error(
      'Could not fetch content from URL. ' +
      'Please paste the content manually.'
    );
  }
}
```

**Implementation Notes:**
- Reuses existing `fetchWithScraperAPI()` function from `app/lib/sailboatdata_queries.ts`
- Automatically falls back to direct fetch with browser headers if ScraperAPI not configured
- Supports JavaScript rendering for dynamic content (SPAs, React apps, etc.)
- No additional dependencies needed - ScraperAPI service is already in use

---

## API Integration

### New API Endpoint

```typescript
// app/api/url-import/fetch-content/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { detectResourceType } from '@/app/lib/url-import/detectResourceType';
import { fetchResourceContent } from '@/app/lib/url-import/fetchResourceContent';
import { getSupabaseServer } from '@/app/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    // Validate URL
    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Get current user
    const supabase = getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Detect resource type
    const detection = detectResourceType(url);

    // Get access token if applicable
    let accessToken: string | undefined;
    if (detection.authProvider) {
      // Check if user has OAuth session with this provider
      const { data: session } = await supabase.auth.getSession();
      const providerData = session?.user?.identities?.find(
        i => i.provider === detection.authProvider
      );

      if (providerData?.access_token) {
        accessToken = providerData.access_token;
      }
    }

    // Fetch content
    const result = await fetchResourceContent({
      url,
      resourceType: detection.resourceType,
      authProvider: detection.authProvider,
      accessToken,
      userId: user.id
    });

    // Return result
    return NextResponse.json({
      success: true,
      resourceType: detection.resourceType,
      content: result.content,
      title: result.title,
      author: result.author,
      source: result.source,
      metadata: result.metadata,
      preview: result.content.substring(0, 300) + '...'
    });

  } catch (error) {
    console.error('URL import error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch content'
      },
      { status: 500 }
    );
  }
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
```

---

## UI Component: URL Import Form

```typescript
// app/components/onboarding/URLImportForm.tsx

'use client';

import { useState } from 'react';
import { AlertCircle, Loader, CheckCircle, Copy } from 'lucide-react';

interface URLImportFormProps {
  onSuccess: (content: string, metadata: any) => void;
  onSkip: () => void;
}

export function URLImportForm({ onSuccess, onSkip }: URLImportFormProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    content: string;
    source: string;
    type: string;
  } | null>(null);

  const handleImport = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/url-import/fetch-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const result = await response.json();

      setPreview({
        content: result.preview,
        source: result.source,
        type: result.resourceType
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (preview) {
      onSuccess(preview.content, preview);
    }
  };

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Content Found</h3>
              <p className="text-sm text-blue-800 mt-1">
                Source: {preview.source} ({preview.type})
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-2 font-medium">Preview:</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {preview.content}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Use This Content
          </button>
          <button
            onClick={() => setPreview(null)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Try Another URL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Paste your profile or post URL
        </label>
        <p className="text-sm text-gray-600 mb-3">
          Works with Facebook, Twitter, personal blogs, and more
        </p>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://facebook.com/john/posts/12345"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          disabled={loading}
        />
      </div>

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 rounded-lg text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleImport}
          disabled={!url || loading}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 inline mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            'Import Profile/Post'
          )}
        </button>
        <button
          onClick={onSkip}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Skip
        </button>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
        <p className="font-medium mb-1">💡 How to find your URL:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Facebook: Go to your post → Click share → Copy link</li>
          <li>Blog/Website: Copy the page URL from address bar</li>
        </ul>
      </div>
    </div>
  );
}
```

---

## Integration with Onboarding Flow

### Modified Onboarding Context

```typescript
// app/contexts/OwnerChatContext.tsx (excerpt)

interface OwnerChatState {
  // ... existing fields
  importedProfile?: {
    url: string;
    source: 'facebook' | 'twitter' | 'generic';
    content: string;
    metadata: any;
  };
}

// When starting onboarding:
if (importedProfile) {
  const importedContent = `[IMPORTED_PROFILE]:
URL: ${importedProfile.url}
Source: ${importedProfile.source}
Content:
${importedProfile.content}`;

  storedContextParts.push(importedContent);
}
```

### Updated AI Prompt

```typescript
// app/lib/ai/owner/service.ts (excerpt)

// In buildOwnerPromptForStep, for signup/create_profile step:

if (skipperProfile?.trim()) {
  storedContextParts.push(`[SKIPPER PROFILE]:\n${skipperProfile.trim()}`);
}

// NEW: Add imported profile context
if (importedProfile?.content) {
  storedContextParts.push(
    `[IMPORTED_PROFILE]:\n` +
    `Source: ${importedProfile.source}\n` +
    `URL: ${importedProfile.url}\n\n` +
    `${importedProfile.content}`
  );
}

// Updated system prompt instructions:
const systemInstructions = `
...existing instructions...

**[IMPORTED_PROFILE] CONTEXT:** The user started onboarding by sharing a link to their
existing profile or post (${importedProfile?.source}). Use the content from [IMPORTED_PROFILE]
to prefill and guide your questions. Ask the user to confirm/refine details extracted
from this source.

Examples:
- If [IMPORTED_PROFILE] mentions "30-day Mediterranean cruise", use that as starting point
- If it mentions skills, confirm these apply to the sailSmart onboarding
- Extract crew requirements from the imported content when present
`;
```

---

## Supported Platforms (Extensible)

### Tier 1: Official API + OAuth (Best)
- ✅ Facebook posts/profiles
- ✅ Twitter/X posts
- ✅ GitHub profiles (public data)

### Tier 2: Screen Scraper (Good)
- ✅ Personal blogs
- ✅ Medium articles
- ✅ Dev.to posts
- ✅ Forum posts
- ✅ Any public website

### Tier 3: Future Extensions (Easy to Add)
- 🔄 TikTok (scraper)
- 🔄 YouTube (API)
- 🔄 Instagram (scraper, limited)
- 🔄 Substack (scraper)
- 🔄 Yacht club websites
- 🔄 Sailing forums (specific implementations)

---

## Data Flow: Complete Journey

```
1. User on sailsm.art homepage/signup
   ↓
2. Show: "Have an existing profile? Import to auto-fill onboarding"
   ↓
3. User pastes URL to their sailing-related profile/post
   Example: https://facebook.com/john_sailor/posts/12345
   ↓
4. System:
   a) Validates URL format
   b) Detects platform (Facebook, Twitter, etc.)
   c) Checks if user has OAuth session with that platform
   ↓
5. Content Fetching:
   IF Facebook + user has Facebook OAuth:
     → Use Graph API (99.9% reliable)
   ELSE IF has scraper service:
     → Use screen scraper (70-90% reliable)
   ELSE:
     → Ask user to paste content manually (100% reliable)
   ↓
6. Preview Phase:
   a) Show extracted content preview
   b) User confirms: "Looks good" or "Try another URL"
   c) User can choose to paste manually instead
   ↓
7. Create Context Block:
   [IMPORTED_PROFILE]:
   - source: "facebook" | "generic"
   - url: original URL
   - content: extracted text
   - metadata: { createdAt, author, platform, etc. }
   ↓
8. Check Authentication:
   IF not logged in:
     → Show signup/login form first
   ELSE:
     → Proceed directly to AI onboarding
   ↓
9. Start AI Onboarding:
   - AI system message includes [IMPORTED_PROFILE]
   - AI reads and understands the imported context
   - AI: "I can see from your profile that... Let me help you fill in the details"
   ↓
10. Normal Onboarding Flow:
    - AI guided conversation
    - Extract crew requirements
    - Extract journey details
    - Extract skipper profile
    - Create/confirm profile
    - Create boat
    - Create journey
    - Complete onboarding
```

---

## Implementation Plan

### Phase 1: Core Framework (1 week)

```
Week 1:
├─ Day 1: URL validation & resource detection
├─ Day 2: Facebook Graph API fetcher
├─ Day 3: Generic web scraper (integrate existing ScraperAPI)
├─ Day 4: API endpoint (/api/url-import/fetch-content)
├─ Day 5: UI component (URLImportForm)
├─ Day 6: Integration with onboarding flow
└─ Day 7: Testing, documentation & deployment
```

**Note:** ScraperAPI integration is straightforward since the service is already configured and used in the codebase for boat data fetching. This reduces implementation time from 1.5 weeks to 1 week.

**New Files (~600 lines):**
```
detectResourceType.ts       ~150 lines
fetchResourceContent.ts     ~200 lines
/api/url-import/route.ts    ~150 lines
URLImportForm.tsx           ~150 lines
```

**Modified Files (~150 lines):**
```
OwnerChatContext.tsx        ~50 lines
service.ts                  ~50 lines
OwnerChat.tsx              ~50 lines
```

### Phase 2: Platform Extensions (1 week each)

```
Week 3-4: Twitter OAuth + API
Week 5+: Additional platforms as needed
```

### Phase 3: Enhancements (Optional)

```
- Add analytics tracking for import sources
- Build URL history for quick re-import
- Create templates from popular post formats
- Add content validation (sailing-related detection)
- Support drag-and-drop file upload
- Add screenshot import option
```

---

## Code Structure

```
app/
├─ lib/
│  ├─ sailboatdata_queries.ts        # EXISTING - contains fetchWithScraperAPI()
│  └─ url-import/
│     ├─ detectResourceType.ts      # Platform detection
│     ├─ fetchResourceContent.ts    # Content fetching orchestrator
│     ├─ fetchers/
│     │  ├─ facebook.ts             # Facebook API + scraper
│     │  ├─ twitter.ts              # Twitter API + scraper
│     │  └─ generic.ts              # Screen scraper (uses existing ScraperAPI)
│     └─ types.ts                    # TypeScript interfaces
├─ api/
│  └─ url-import/
│     └─ fetch-content/
│        └─ route.ts                 # Main endpoint
└─ components/
   └─ onboarding/
      └─ URLImportForm.tsx           # UI component
```

**Key Note:** Screen scraping leverages the existing `fetchWithScraperAPI()` function already configured in the codebase for boat data fetching. No new scraper infrastructure needed.

---

## Security & Privacy Considerations

### 1. URL Validation
```typescript
// Only allow safe URLs
const allowedDomains = [
  'facebook.com',
  'twitter.com',
  'medium.com',
  'dev.to',
  // ... etc
];

// Reject suspicious patterns
if (url.includes('javascript:') || url.includes('data:')) {
  throw new Error('Invalid URL');
}
```

### 2. Content Sanitization
```typescript
// Clean extracted content before passing to AI
import DOMPurify from 'isomorphic-dompurify';

const cleanContent = DOMPurify.sanitize(rawContent);
```

### 3. Rate Limiting
```typescript
// Limit imports per user per hour
// Prevent abuse of scraper resources
const rateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,  // 10 imports per hour
  keyGenerator: (req) => req.user.id
});
```

### 4. Privacy
```typescript
// Store import history for audit
// Allow deletion on user request
// Comply with GDPR deletion requirements

// Don't re-scrape too frequently
// Cache content for 24 hours
const cacheKey = `url_import:${hashUrl(url)}`;
```

---

## Error Handling & Fallbacks

### Graceful Degradation

```
Try Primary Method (OAuth + API)
    ↓ [If fails or unavailable]
Try Secondary Method (Screen Scraper)
    ↓ [If fails]
Offer Manual Option (User pastes text)
    ↓ [If user skips]
Continue with existing flow (No imported content)
```

### Specific Error Messages

```typescript
const errors = {
  INVALID_URL: 'Please enter a valid URL',
  NO_CONTENT_FOUND: 'Could not extract content from this URL. Please paste manually.',
  RATE_LIMITED: 'Too many imports. Please try again later.',
  NETWORK_ERROR: 'Network error. Please check the URL and try again.',
  OAUTH_REQUIRED: 'Please authenticate with Facebook to import this post',
  UNAUTHORIZED: 'You do not have permission to view this resource',
};
```

---

## Analytics & Monitoring

### Track Success Metrics

```typescript
// Log import attempts
{
  userId: string;
  url: string;
  resourceType: 'facebook' | 'generic';
  source: 'api' | 'scraper' | 'manual';
  success: boolean;
  contentLength: number;
  fetchTimeMs: number;
  timestamp: string;
}
```

### Dashboard Metrics

```
- Total imports by platform
- Success rate by resource type
- Average fetch time
- User adoption rate
- Top imported content sources
- Fallback rates (when API not available)
```

---

## Benefits of This Architecture

### 🎯 Universal
- Works with any public URL
- Extensible to new platforms
- Not locked to single provider

### 🔄 Flexible
- OAuth first (best experience)
- Scraper fallback (always works)
- Manual paste option (safety net)

### 🛡️ Safe
- URL validation
- Content sanitization
- Rate limiting
- Privacy-respecting

### 📈 Scalable
- Easy to add new platforms
- Can handle high volume
- Caching strategy included

### 👥 User-Friendly
- Clear error messages
- Preview before confirming
- Multiple import methods
- Skip if not needed

---

## Next Steps

1. **Implement Core Framework** (Week 1-2)
   - URL detection & validation
   - Facebook API fetcher
   - Generic screen scraper
   - API endpoint
   - UI component

2. **Test Thoroughly**
   - Test with real URLs from multiple platforms
   - Test error cases
   - Test fallback strategies
   - Test with different user states (authenticated/not)

3. **Deploy MVP**
   - Facebook import (OAuth + API)
   - Generic web scraper (ScraperAPI - already configured)
   - Manual paste fallback

4. **Iterate Based on Usage**
   - Add more platforms
   - Optimize scraper accuracy
   - Improve error handling
   - Enhance analytics

---

## Conclusion

This **generic URL-based import approach** is:

- ✅ **Universal** - Works with any content
- ✅ **Extensible** - Easy to add platforms
- ✅ **Robust** - Multiple fallback strategies
- ✅ **Practical** - 1-2 weeks to MVP
- ✅ **Future-Proof** - No lock-in to single platform

Ready to implement! 🚀
