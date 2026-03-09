---
id: TASK-158
title: Own screen scraper utility
status: Done
assignee: []
created_date: '2026-03-08 19:08'
updated_date: '2026-03-09 10:41'
labels:
  - scraping
  - infrastructure
  - sailboatdata
dependencies: []
references:
  - app/lib/sailboatdata_queries.ts
  - app/api/sailboatdata/search/route.ts
  - app/api/sailboatdata/fetch-details/route.ts
  - app/components/manage/NewBoatWizardStep1.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design and implement an own screen scraper utility for accessing sailboatdata.com (and future sites) without relying on costly external scraping APIs like ScraperAPI.

**Problem Statement:**
ScraperAPI is returning 403 Forbidden from sailboatdata.com even with `render=true` and `use_proxy=true`. The current implementation in `app/lib/sailboatdata_queries.ts` uses ScraperAPI for:
1. **Search** (`searchSailboatData`) — needs JavaScript rendering because results load dynamically via Algolia
2. **Detail pages** (`fetchSailboatDetails`) — fetches individual boat specification pages

**Current Files to Replace:**
- `app/lib/sailboatdata_queries.ts` — `fetchWithScraperAPI()` function and all callers
- Env var `SCRAPERAPI_API_KEY` can be retired once replaced

**Already Available in Project:**
- `@playwright/test` v1.58.2 (includes full Playwright library)
- `jsdom` v27.4.0 (for HTML parsing without a browser)
- Deployment: Vercel (`@vercel/functions` already used)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Algolia App ID, Search Key and Index name are discovered and documented from sailboatdata.com network traffic
- [ ] #2 searchSailboatData() uses Algolia API directly — no ScraperAPI, no browser rendering
- [ ] #3 fetchSailboatDetails() uses direct HTTP fetch + jsdom — no ScraperAPI
- [ ] #4 fetchWithScraperAPI() function is removed from sailboatdata_queries.ts
- [ ] #5 SCRAPERAPI_API_KEY environment variable is no longer required
- [ ] #6 Search results match or exceed current quality (same fields: name, url, slug)
- [ ] #7 Detail page parsing returns same fields as before (LOA, beam, displacement, ratios, etc.)
- [ ] #8 Boat registry cache layer is preserved (no regression)
- [ ] #9 Works correctly on Vercel production deployment
- [ ] #10 Retry logic retained for transient HTTP failures
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Technical Options Analysis

### Option A: Direct Algolia API (Recommended for Search)
sailboatdata.com uses Algolia to power its search. The Algolia App ID and Search-Only API key are embedded in the frontend JavaScript and are public (read-only). We can query Algolia's REST API directly:
```
GET https://{APP_ID}-dsn.algolia.net/1/indexes/{INDEX}/query
X-Algolia-Application-Id: {APP_ID}
X-Algolia-API-Key: {SEARCH_KEY}
```
- **Pros**: No browser needed, instant, works on any serverless platform, no rate-limiting concerns
- **Cons**: Algolia credentials may change if sailboatdata.com rotates them; need to discover App ID and Index name by inspecting network requests
- **How to find**: Open sailboatdata.com in browser DevTools → Network tab → filter by `algolia` → find the XHR/fetch request to `algolia.net`

### Option B: Playwright with @sparticuz/chromium (For JS-rendered pages)
Use Playwright with a serverless-compatible Chromium binary for Vercel:
```
npm install playwright-core @sparticuz/chromium
```
- **Pros**: Full browser rendering, handles any JS-heavy page, reliable
- **Cons**: ~50MB binary, slow cold start (2-5s), higher memory usage, complex Vercel setup
- **Vercel limit**: Max 50MB function size — chromium fits if compressed

### Option C: Direct HTTP + jsdom (For non-JS pages)
For detail pages (individual boat specs) which appear to be server-rendered:
- Fetch with realistic browser headers
- Parse HTML with `jsdom` (already installed)
- **Pros**: Zero dependencies, instant, works everywhere
- **Cons**: Breaks if sailboatdata.com adds Cloudflare/JS protection to detail pages

### Option D: Puppeteer + @sparticuz/chromium
Similar to Option B but uses Puppeteer instead of Playwright. Playwright is preferred since it's already installed.

---

## Recommended Architecture

**Two-layer approach:**

**Layer 1 — Search (Algolia API):**
Discover Algolia credentials from sailboatdata.com network traffic. Query Algolia directly — no browser, no proxy. Returns structured JSON from Algolia, eliminating HTML parsing for search entirely.

**Layer 2 — Detail Pages (HTTP + jsdom):**
Direct HTTP fetch with browser-like headers + jsdom parsing. Already works well (no JS rendering needed for static spec pages). Keep the existing `parseSailboatDetailsHTML()` parsing logic as-is.

**Fallback — Playwright:**
If Algolia credentials change or detail pages add JS protection, implement a Playwright-based fallback using `playwright-core` + `@sparticuz/chromium` for Vercel compatibility.

---

## Implementation Plan

### Phase 1 — Discover Algolia Credentials
**Task:** Inspect sailboatdata.com network traffic to find:
- Algolia Application ID
- Algolia Search-Only API Key  
- Algolia Index Name
- Result schema (field names for boat name, URL, slug)

**How:** Open browser DevTools on sailboatdata.com, search for any boat, filter network tab by "algolia.net" requests.

**Deliverable:** Document the Algolia endpoint, credentials, and response schema.

### Phase 2 — Algolia Search Client
**New file:** `app/lib/scraper/sailboatdata-algolia.ts`

```typescript
// Direct Algolia API client — no browser required
export async function searchViaAlgolia(keyword: string): Promise<SailboatSearchResult[]>
```

- Calls Algolia REST API directly with hardcoded (but env-overridable) credentials
- Maps Algolia hits to existing `SailboatSearchResult` interface
- No HTML parsing needed — Algolia returns structured JSON
- Store credentials in `.env.local` as `SAILBOATDATA_ALGOLIA_APP_ID`, `SAILBOATDATA_ALGOLIA_KEY`, `SAILBOATDATA_ALGOLIA_INDEX`

### Phase 3 — HTTP Detail Page Scraper
**New file:** `app/lib/scraper/sailboatdata-http.ts`

```typescript
// Direct HTTP fetch with jsdom for non-JS detail pages
export async function fetchDetailPageHTML(url: string): Promise<string>
```

- Uses `fetch()` with comprehensive browser headers (already exists in fallback code)
- Returns raw HTML for parsing by existing `parseSailboatDetailsHTML()`
- No ScraperAPI, no browser needed
- Retry with exponential backoff (already partially implemented)

### Phase 4 — Update sailboatdata_queries.ts
**Modify:** `app/lib/sailboatdata_queries.ts`

- Replace `fetchWithScraperAPI()` calls with new scraper modules
- `searchSailboatData()` → use `searchViaAlgolia()` (Phase 2)
- `fetchSailboatDetails()` → use `fetchDetailPageHTML()` (Phase 3)
- Remove `fetchWithScraperAPI()` function entirely
- Remove `SCRAPERAPI_API_KEY` dependency

### Phase 5 — Playwright Fallback (If Algolia Fails)
**New file:** `app/lib/scraper/sailboatdata-playwright.ts`

Only implement if Algolia credentials are not discoverable or are unreliable.

```typescript
// Playwright-based scraper for JS-rendered pages
export async function scrapeWithBrowser(url: string): Promise<string>
```

Install: `npm install playwright-core @sparticuz/chromium`

Vercel configuration:
- Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to `@sparticuz/chromium` path
- Increase Vercel function memory to 1024MB in `vercel.json`
- Increase timeout to 30s

---

## File Structure

```
app/lib/scraper/
  sailboatdata-algolia.ts    # Phase 2 — Algolia search API client
  sailboatdata-http.ts       # Phase 3 — Direct HTTP for detail pages
  sailboatdata-playwright.ts # Phase 5 — Playwright fallback (optional)
  index.ts                   # Barrel export
app/lib/sailboatdata_queries.ts  # Modified to use new scrapers
```

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `SAILBOATDATA_ALGOLIA_APP_ID` | Algolia Application ID | Yes (Phase 2) |
| `SAILBOATDATA_ALGOLIA_KEY` | Algolia Search-Only API Key | Yes (Phase 2) |
| `SAILBOATDATA_ALGOLIA_INDEX` | Algolia index name | Yes (Phase 2) |
| `SCRAPERAPI_API_KEY` | Can be removed after migration | Retire |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Algolia credentials rotate | Medium | Store in env vars, easy to update |
| Algolia terms of service | Low | Using public read-only search key (same as browsers) |
| Detail pages add JS protection | Low | Implement Playwright fallback in Phase 5 |
| Playwright too large for Vercel | Medium | Use `@sparticuz/chromium` (compressed ~45MB) |
| Cold start latency with Playwright | High | Only use as fallback; primary path is Algolia + HTTP |
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All acceptance criteria pass
- [ ] #2 Existing boat search flow works end-to-end: type keyword → select boat → specs pre-filled
- [ ] #3 SCRAPERAPI_API_KEY removed from .env.local and .env.example
- [ ] #4 New env vars documented in .env.example
- [ ] #5 No regressions in NewBoatWizard step 1 search
<!-- DOD:END -->
