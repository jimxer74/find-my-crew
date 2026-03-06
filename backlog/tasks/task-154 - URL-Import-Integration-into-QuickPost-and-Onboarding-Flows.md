---
id: TASK-154
title: URL Import Integration into QuickPost and Onboarding Flows
status: In Progress
assignee: []
created_date: '2026-03-06 12:45'
updated_date: '2026-03-06 12:46'
labels:
  - onboarding
  - url-import
  - facebook
  - quickpost
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Goal
Allow users to paste an external URL (e.g. a Facebook post, Twitter/X post, or any web page) directly into the QuickPost textarea on the homepage, or into the chat input of `/welcome/crew` and `/welcome/owner`. The system auto-detects URLs, fetches the content using the existing `/api/url-import/fetch-content` infrastructure, and uses the extracted text as the AI context seed — eliminating the need to manually retype profile info.

---

## Background — Existing Infrastructure

All building blocks are already in place:

| Asset | Location | What it does |
|---|---|---|
| URL fetch API | `app/api/url-import/fetch-content/route.ts` | POST `{ url }` → detects platform (Facebook / Twitter / generic), fetches content via Graph API or ScraperAPI fallback, returns `{ content, title, author, source, metadata }` |
| Platform detector | `shared/lib/url-import/detectResourceType.ts` | Classifies URL as `facebook`, `twitter`, or `generic`; returns `authProvider` |
| Content fetcher | `shared/lib/url-import/fetchResourceContent.ts` | Multi-tier: official API (with OAuth token) → ScraperAPI fallback |
| Facebook Graph API | `shared/lib/facebook/graphApi.ts` | `fetchProfile`, `fetchPosts`, `fetchAllUserData` |
| Facebook fetch route | `app/api/facebook/fetch-data/route.ts` | GET, reads `fb_access_token` cookie, returns full FB user data |
| QuickPostBox | `app/components/QuickPostBox.tsx` | Homepage expandable textarea, calls `onPost(text)` |
| Homepage handlers | `app/page.tsx` (lines 466, 537) | `handleCrewPost` → `/welcome/crew?profile={text}`, `handleOwnerPost` → `/welcome/owner?skipperProfile={text}` |
| Crew chat context | `app/contexts/ProspectChatContext.tsx` | Reads `?profile=` query param as initial AI seed |
| Owner chat context | `app/contexts/OwnerChatContext.tsx` | Reads `?skipperProfile=` query param as initial AI seed |

Rate limit on URL fetch: 10/hour/user (in-memory).

---

## Scope of Changes

### 1 — QuickPostBox: URL detection + loading state
**File**: `app/components/QuickPostBox.tsx`

- When user clicks **Post**, check if `text.trim()` matches `isValidUrl()` (reuse logic from `detectResourceType.ts` or a simple regex).
- If it is a URL:
  - Show an inline loading indicator inside the box ("Fetching content…").
  - Call `POST /api/url-import/fetch-content` with `{ url: text }`.
  - On success: replace the textarea content with the fetched `content` string (truncated to a reasonable length if needed), then automatically call `onPost(fetchedContent)` — passing the extracted text onward exactly as if the user had typed it.
  - On error: show an inline error message ("Could not fetch this URL. Please paste the content directly."), remain expanded so user can edit.
- If it is **not** a URL: existing behaviour unchanged.
- New props needed: none (all state is internal to the component).
- Facebook-specific: if `detectResourceType` returns `authProvider: 'facebook'` AND the fetch returns a 401/403 or explicit `requiresAuth: true` flag, redirect user through Facebook OAuth before retrying. Implementation detail: show a "Connect Facebook" button/prompt instead of auto-redirecting, so user retains control.

### 2 — Homepage `handleCrewPost` / `handleOwnerPost`
**File**: `app/page.tsx`

- No change needed if URL resolution is handled entirely inside `QuickPostBox` before `onPost` is called. The extracted content simply flows through as text.
- The `?profile=` / `?skipperProfile=` query params already accept free-form text — fetched content works as a drop-in.

### 3 — `/welcome/crew` page: URL detection on arrival
**File**: `app/welcome/crew/page.tsx` (and `ProspectChatContext`)

- When the page mounts, check if `?profile=` value looks like a URL.
- If yes: show a loading banner ("Importing your profile from URL…"), call `/api/url-import/fetch-content`, then replace the query-param seed with the fetched content before starting the chat.
- Facebook gate: same as above — if Facebook URL and no `fb_access_token` cookie, show a one-step "Connect with Facebook" CTA that completes OAuth and returns to this page with the URL still in the params.

### 4 — `/welcome/owner` page: URL detection on arrival
**File**: `app/welcome/owner/page.tsx` (and `OwnerChatContext`)

- Same pattern as crew: check `?skipperProfile=` on mount, fetch if URL, seed AI with extracted content.
- Owner use-case: a skipper might paste a sailing club page or their existing boat listing.

### 5 — Facebook OAuth gating (shared helper)
- Create a small shared utility `shared/lib/url-import/requiresFacebookAuth.ts` that:
  - Takes a detected `resourceType` and checks for the `fb_access_token` cookie (client-side: check via a `GET /api/auth/facebook/token-status` endpoint or similar).
  - Returns `{ required: boolean }`.
- When Facebook auth is required, redirect to the existing FB OAuth flow with a `returnTo` param pointing back to the current page (so the user lands back exactly where they were after authenticating).

---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pasting a plain HTTPS URL into QuickPost triggers URL fetch on Post click
- [ ] #2 Fetch success: AI chat seeds from extracted content, not the raw URL
- [ ] #3 Facebook URL without FB auth: user sees Connect Facebook prompt, not a broken fetch
- [ ] #4 Fetch failure: inline error shown, user can edit/retry without page reload
- [ ] #5 URL detection works on /welcome/crew arrival via ?profile= query param
- [ ] #6 URL detection works on /welcome/owner arrival via ?skipperProfile= query param
- [ ] #7 Non-URL text behaves exactly as before (no regression)
- [ ] #8 Rate limit 429 shows friendly message to user
<!-- SECTION:DESCRIPTION:END -->

- [ ] #9 Loading/error states match glassmorphism visual style of surrounding UI
<!-- AC:END -->
