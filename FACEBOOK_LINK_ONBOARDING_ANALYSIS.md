# Analysis: Simplified Facebook Link Onboarding Flow

## Overview

**User Journey:**
1. User posts about their sailing journey/crew needs on their own Facebook timeline
2. User copies the post link
3. User opens sailsm.art and pastes the link
4. System fetches post content
5. AI assistant reads the content and starts onboarding flow
6. Normal AI-assisted onboarding continues

**Complexity: LOW** | **Feasibility: VERY HIGH** | **Implementation: 1 week**

---

## Why This Approach is Better

### ✅ Advantages Over Group Approach

| Aspect | Group Approach | Link Approach |
|--------|---|---|
| Meta App Review | Required ❌ | NOT Required ✅ |
| User's Own Content | Maybe (group member) | Always (their post) ✅ |
| Privacy Concerns | High (group data) | Low (user's own post) ✅ |
| GDPR Compliance | Complex | Simple ✅ |
| Implementation Time | 4-8 weeks | 1 week ✅ |
| Fallback Strategy | Manual paste | Built-in ✅ |
| Token Permissions | Complex | Simple ✅ |
| Parsing Complexity | High (various posts) | Medium (user's post) |
| UX | Pick group → pick post | Paste link ✅ |
| Rate Limiting | Potential issue | No issue ✅ |
| Error Recovery | Complex | Simple ✅ |

### ✅ No Meta App Review Needed

**Key Insight:** User is accessing their OWN post, not group data
- Can use standard `user_posts` scope (already granted ❌)
- OR use screen scraper as fallback (no OAuth needed)
- No group permissions required
- No privacy concerns with third-party data

---

## Technical Implementation

### Approach 1: Facebook Graph API (Preferred)

**Prerequisites:**
- User has Facebook OAuth access token
- User provides their post URL or post ID

**How It Works:**

```
User pastes: https://www.facebook.com/user_id/posts/post_id/

Extract: post_id from URL

Call: GET /{post_id}?fields=message,story,created_time,permalink_url&access_token={token}

Return: Post content
```

**Code Implementation:**

```typescript
// app/lib/facebook/fetchPostContent.ts

async function fetchPostFromFacebook(
  postUrl: string,
  accessToken: string
): Promise<{
  content: string;
  createdAt: string;
  url: string;
}> {
  // Extract post ID from URL
  // https://www.facebook.com/user_id/posts/post_id/
  // https://www.facebook.com/posts/post_id/
  // https://www.facebook.com/user_id/posts/post_id/

  const postIdMatch = postUrl.match(/\/posts\/(\d+)/);
  if (!postIdMatch) {
    throw new Error('Invalid Facebook post URL');
  }

  const postId = postIdMatch[1];

  // Fetch from Graph API
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${postId}?fields=message,story,created_time,permalink_url&access_token=${accessToken}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch post');
  }

  const data = await response.json();

  return {
    content: data.message || data.story || '',
    createdAt: data.created_time,
    url: data.permalink_url || postUrl
  };
}
```

**Advantages:**
- Official API (reliable)
- Structured data
- Metadata included
- Works as long as user has token

**Disadvantage:**
- Depends on access token
- Token may expire (but can refresh)
- Requires active OAuth session

### Approach 2: Screen Scraper Fallback

**For when:**
- User is not logged in with Facebook OAuth
- Access token not available
- API call fails

**Options:**

#### Option A: Cheerio (Lightweight, Server-side)

```typescript
import { load } from 'cheerio';
import axios from 'axios';

async function fetchPostWithScreenScaper(postUrl: string) {
  try {
    const response = await axios.get(postUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SailSmartBot/1.0)'
      }
    });

    const $ = load(response.data);

    // Extract post content - varies by Facebook HTML structure
    // This is fragile but works as fallback
    const content = $('[data-testid="post_message"]')?.text() ||
                   $('[role="article"]')?.text() ||
                   '';

    return { content };
  } catch (error) {
    throw new Error('Could not scrape post');
  }
}
```

#### Option B: Puppeteer (Full browser, More reliable)

```typescript
import puppeteer from 'puppeteer';

async function fetchPostWithPuppeteer(postUrl: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(postUrl);

  // Wait for post to load
  await page.waitForSelector('[data-testid="post_message"]', {
    timeout: 5000
  }).catch(() => null);

  // Extract content
  const content = await page.evaluate(() => {
    return document.querySelector('[data-testid="post_message"]')
      ?.textContent || '';
  });

  await browser.close();

  return { content };
}
```

#### Option C: Third-party Service (Easiest)

Use services like:
- **Apify** - `@apify/web-scraper` (easy, managed)
- **Bright Data** - Residential proxies
- **Scrapy Cloud** - Full scraping infrastructure

```typescript
// Using Apify
import { ApifyClient } from 'apify-client';

async function fetchPostWithApify(postUrl: string) {
  const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN
  });

  const run = await client.actor('apify/web-scraper').call({
    startUrls: [{ url: postUrl }],
    globs: [],
    pseudoUrls: [],
    linkSelector: null,
    keepUrlFragments: false,
    crawlerType: 'cheerio',
    maxRequestsPerCrawl: 1,
    maxPagesPerRun: 1,
    pageLoadTimeoutSecs: 30,
    pageFunctionTimeout: 60,
    pageFunction: `
      return {
        content: document.querySelector('[data-testid="post_message"]')?.textContent || '',
        url: window.location.href,
        timestamp: new Date().toISOString()
      };
    `
  });

  const output = await client
    .dataset(run.defaultDatasetId)
    .listItems();

  return output.items[0];
}
```

**Advantages:**
- Works without OAuth
- Fallback option
- More reliable parsing
- Works for multiple Facebook formats

**Disadvantages:**
- More complex
- May break if Facebook changes HTML
- Extra service cost (if using third-party)
- Slower than API

---

## Recommended Hybrid Approach

```typescript
// app/lib/facebook/fetchPostContent.ts

async function fetchPostContent(
  postUrl: string,
  accessToken?: string
): Promise<{ content: string; source: 'api' | 'scraper' }> {

  // Try 1: Facebook Graph API (if token available)
  if (accessToken) {
    try {
      const result = await fetchPostFromFacebook(postUrl, accessToken);
      return { content: result.content, source: 'api' };
    } catch (error) {
      console.warn('API fetch failed, trying scraper:', error);
      // Fall through to scraper
    }
  }

  // Try 2: Screen Scraper (Cheerio - lightweight)
  try {
    const result = await fetchPostWithCheerio(postUrl);
    return { content: result.content, source: 'scraper' };
  } catch (error) {
    console.warn('Cheerio failed, trying Puppeteer:', error);
    // Fall through
  }

  // Try 3: Puppeteer (more reliable but slower)
  try {
    const result = await fetchPostWithPuppeteer(postUrl);
    return { content: result.content, source: 'scraper' };
  } catch (error) {
    console.warn('Puppeteer failed, asking user to paste manually');
    throw new Error(
      'Could not fetch post. Please copy-paste the content manually.'
    );
  }
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User copies Facebook post link                              │
│ (from their own timeline)                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ User goes to sailsm.art                                     │
│ (already authenticated or signs up/logs in)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Show input: "Paste your Facebook post link"                 │
│ Validate URL format                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ System fetches post content                                 │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Try 1: Facebook Graph API (if OAuth session)          │   │
│ │ Try 2: Screen Scraper (Cheerio)                       │   │
│ │ Try 3: Puppeteer (if needed)                          │   │
│ │ Fallback: "Please paste manually"                     │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Show preview of extracted content                           │
│ "This is what we found from your post:"                    │
│ [Quoted post content]                                       │
│ [Buttons: "This looks good" / "Paste manually instead"]    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Create context block: [FACEBOOK_POST]                       │
│ {                                                           │
│   "source": "facebook",                                    │
│   "url": "https://facebook.com/...",                       │
│   "content": "Raw post content from user",                │
│   "fetchedAt": "2026-02-24T..."                           │
│ }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Start AI Onboarding Flow                                    │
│                                                             │
│ AI system message includes:                                │
│ "User is onboarding by sharing their Facebook post:"       │
│ [FACEBOOK_POST]:                                           │
│ {full post content}                                        │
│                                                             │
│ "Please help them fill in the details from this post."     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ AI Assistant Onboarding                                     │
│                                                             │
│ Assistant: "I can see from your post that you're sailing    │
│ from X to Y with these crew needs... Let me help you       │
│ set up your profile and journey!"                           │
│                                                             │
│ Continue normal onboarding flow...                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Basic Implementation (1 week)

```
Day 1-2: Create components and utilities
  - FacebookLinkInput.tsx component (50 lines)
  - fetchPostContent.ts utility (100 lines)
  - Cheerio-based scraper (50 lines)

Day 2-3: API integration
  - Create API route: /api/facebook/fetch-post (50 lines)
  - Handle errors gracefully
  - Add logging

Day 3-4: AI integration
  - Modify OwnerChatContext to pass Facebook data
  - Update buildOwnerPromptForStep to inject [FACEBOOK_POST]
  - Test with real posts

Day 4-5: UI and UX
  - Show loading state while fetching
  - Show preview of post content
  - Error handling and fallbacks
  - "Paste manually" option

Day 5-6: Testing
  - Test with various Facebook post URLs
  - Test without OAuth
  - Test scraper failures and fallbacks
  - Test with real users

Day 6-7: Refinement
  - Code review
  - Security review
  - Performance optimization
  - Documentation
```

### Phase 2: Enhancements (Optional)

```
- Add Puppeteer for more reliable scraping
- Support URLs with post ID only (no domain)
- Store fetched posts for audit trail
- Add analytics: how many users use this flow
- Support multiple social platforms (LinkedIn, etc.)
```

---

## Required Code Changes

### New Files

```
app/lib/facebook/fetchPostContent.ts          ~150 lines
  - Main function to fetch post content
  - Handles API and scraper methods

app/api/facebook/fetch-post/route.ts          ~100 lines
  - API endpoint to fetch post
  - Returns post content + metadata

app/components/onboarding/FacebookLinkInput.tsx  ~150 lines
  - Input form for Facebook link
  - Shows preview
  - Error handling
```

### Modified Files

```
app/lib/ai/owner/service.ts                    ~30 lines
  - Add [FACEBOOK_POST] context block injection
  - Update system prompt for Facebook data

app/contexts/OwnerChatContext.tsx              ~40 lines
  - Store facebookPost data in state
  - Pass to AI service

app/components/owner/OwnerChat.tsx             ~50 lines
  - Add FacebookLinkInput component
  - Show before or during onboarding
  - Clear preview after starting

app/auth/login/page.tsx                        ~5 lines
  - Ensure user_posts scope is requested
  - (likely already configured)
```

---

## Dependencies

### Required
```json
{
  "cheerio": "^1.0.0"      // HTML parsing (lightweight)
}
```

### Optional
```json
{
  "puppeteer": "^21.0.0",  // Full browser rendering
  "apify-client": "^1.7.0" // Managed scraping
}
```

### Note
- Don't need Puppeteer initially (Cheerio is sufficient)
- Add if needed based on scraping reliability
- Consider third-party service if in-house scraping fails

---

## Advantages of This Approach

### ✅ No External Dependencies
- No Meta App Review needed
- Works with existing OAuth
- Can add scraper as fallback

### ✅ Simple UX
- One input: "Paste link"
- Clear and intuitive
- No configuration needed

### ✅ Low Privacy Risk
- User's own content only
- No third-party data
- GDPR compliant by default

### ✅ Quick Implementation
- 1 week for MVP
- 1-2 files to create
- 4-5 files to modify
- ~350 lines of new code

### ✅ Reliable Fallbacks
- API first (if logged in with Facebook)
- Scraper second (if not logged in)
- Manual paste option (if both fail)

### ✅ Future-Proof
- Can extend to LinkedIn, Twitter, etc.
- Same pattern works for other platforms
- Users control their own content

---

## Security Considerations

### ✅ Safe by Design

1. **URL Validation**
   ```typescript
   // Only allow valid Facebook URLs
   const fbUrlRegex = /^https:\/\/(www\.)?facebook\.com\/.*\/posts\/\d+/;
   if (!fbUrlRegex.test(postUrl)) {
     throw new Error('Invalid Facebook URL');
   }
   ```

2. **Access Control**
   ```typescript
   // Only fetch content for authenticated user (or allow public scrape)
   // User must be logged in to sailsm.art
   // Don't expose access token in frontend
   ```

3. **Content Sanitization**
   ```typescript
   // Clean post content before passing to AI
   const clean = sanitizeHTML(postContent);
   ```

4. **Rate Limiting**
   ```typescript
   // Limit requests per user per hour
   // Prevent abuse of scraper/API
   ```

---

## User Scenario Examples

### Scenario 1: Owner Onboarding

```
Owner: "I just posted on Facebook about my upcoming Mediterranean cruise.
        Let me share that with SailSmart to find crew."

1. Copies post link: https://facebook.com/john_sailor/posts/123456
2. Opens sailsm.art
3. Pastes link in onboarding form
4. System fetches post:
   "Planning a 30-day Mediterranean cruise departing May 1st from Barcelona,
    ending in Venice. Looking for experienced crew with offshore sailing
    experience. Need: navigator, watch keeper, sail trimmer. My boat is
    a Bavaria 46. Shared costs model. Must be flexible with timeline."
5. AI reads the post and starts:
   "Great! I can see from your post that you're looking for experienced
    crew for your Bavaria 46. Let me help you set up your journey details
    and crew requirements..."
6. Normal onboarding continues
```

### Scenario 2: Crew Onboarding

```
Prospective Crew: "I posted on Facebook about my sailing experience
                  and what I'm looking for. Let me use that for signup."

1. Copies post link: https://facebook.com/sarah_crew/posts/789012
2. Opens sailsm.art
3. Pastes link in onboarding form
4. System fetches post:
   "Looking to join sailing adventures! I have 5 years sailing experience,
    ASA certification, comfortable with coastal and offshore sailing.
    Skills: navigation, sail handling, watch keeping. Available May-July.
    Open to various locations, prefer Mediterranean or Caribbean.
    Budget-conscious, looking for shared cost adventures."
5. AI reads the post and starts:
   "Perfect! I can see you're an experienced sailor looking for summer
    adventures. Let me help you create your crew profile..."
6. Normal onboarding continues
```

---

## Comparison: Old vs New

### Old Approach (Groups)
```
User → Select Group → Select Post → Fetch → Onboarding
Cost: 4-8 weeks, Meta App Review, Complex API
Risk: App Review rejection, Group access blocked
```

### New Approach (Direct Link)
```
User → Paste Link → Fetch → Onboarding
Cost: 1 week, No external approvals
Risk: Low, scraper fallback available
```

---

## Recommendation

### 🟢 PROCEED WITH THIS APPROACH

This is the **optimal solution** for your use case:

1. ✅ Simple to implement (1 week)
2. ✅ No external dependencies or app reviews
3. ✅ Works for user's own content (primary use case)
4. ✅ Multiple fallback strategies
5. ✅ Low privacy risk
6. ✅ Can extend to other platforms
7. ✅ MVP-ready immediately
8. ✅ No risk of rejection

### Implementation Timeline

```
Week 1 (Immediately):
  - Create FacebookLinkInput component
  - Build fetchPostContent utility
  - Integrate with onboarding flow
  - Deploy MVP

Week 2 (Optional):
  - Add Puppeteer for better scraping
  - Add analytics
  - User testing and refinement
```

### Success Metrics

Track:
- % of users using Facebook link import
- Success rate of post fetching
- Time saved vs manual entry
- Fallback usage (scraper vs API vs manual)
- User satisfaction

---

## Conclusion

This simplified approach is **highly recommended** because it:
- Solves the core problem (prefill onboarding with user's content)
- Requires minimal implementation (1 week)
- Has zero external blockers (no app reviews)
- Is more private and secure
- Provides excellent UX
- Can scale to other platforms

Ready to implement whenever you give the go-ahead! 🚀
