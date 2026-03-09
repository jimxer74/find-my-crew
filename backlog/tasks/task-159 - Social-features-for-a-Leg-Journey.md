---
id: TASK-159
title: Social features for a Leg / Journey
status: To Do
assignee: []
created_date: '2026-03-09 10:45'
updated_date: '2026-03-09 17:29'
labels:
  - social
  - ui
  - database
  - api
dependencies: []
references:
  - app/components/crew/LegDetailsPanel.tsx
  - 'app/owner/journeys/[journeyId]/edit/page.tsx'
  - 'app/api/legs/[legId]/route.ts'
  - app/api/user/delete-account/route.ts
  - specs/tables.sql
  - migrations/
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable social features on Legs and Journeys: Commenting, Likes, and Sharing.

**Commenting**
- Users can post, edit, and delete their own comments on a Leg inside LegDetailsPanel (displayed under the images section)
- Skippers can delete any comment on their Journey's legs
- Skippers can enable/disable commenting at Journey level (default: enabled)
- Commenting toggle is managed in the Journey edit page
- When commenting is disabled, existing comments are hidden and the input is replaced with a notice

**Likes**
- Any visitor (authenticated or not) can see the like count
- Authenticated users can toggle a like on a Leg
- Always enabled regardless of commenting setting

**Sharing**
- Share a Leg via: Facebook post, Facebook Messenger, WhatsApp, and copy-to-clipboard URL
- Always enabled regardless of commenting setting
- Sharing uses the public crew browse URL for the leg (`/crew?leg=<legId>`)

**UI placement**
- Social section is inserted in LegDetailsPanel directly below the images carousel and above the card content area
- Section order: Like button + count → Share buttons → Comments (if enabled)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Likes: authenticated users can toggle a like on a leg; like count is visible to all users
- [ ] #2 Comments: authenticated users can post a comment on a leg when commenting is enabled for the journey
- [ ] #3 Comments: users can edit and delete their own comments inline
- [ ] #4 Comments: skippers can delete any comment on their journey's legs
- [ ] #5 Comments: commenting can be toggled on/off per Journey by the skipper (default: on)
- [ ] #6 Comments: when commenting is disabled, existing comments are hidden and new input is replaced with a notice
- [ ] #7 Commenting toggle is accessible in the Journey edit page (`/owner/journeys/[id]/edit`)
- [ ] #8 Sharing: leg can be shared via Facebook post, Facebook Messenger, WhatsApp, and copy-to-clipboard URL
- [ ] #9 Social section appears in LegDetailsPanel below the images carousel
- [ ] #10 Like count and comment count update in real-time (or on interaction) without full page reload
- [ ] #11 GDPR: user comments and likes are deleted when a user deletes their account
- [ ] #12 Database migration created and `specs/tables.sql` updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
"## Implementation Plan

### Phase 1 — Database

**File:** `migrations/062_social_features.sql` (new)
**File:** `specs/tables.sql` (update)

```sql
-- 1. Add commenting toggle to journeys
ALTER TABLE journeys ADD COLUMN comments_enabled boolean NOT NULL DEFAULT true;

-- 2. Leg likes
CREATE TABLE leg_likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id      uuid NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leg_id, user_id)
);
CREATE INDEX leg_likes_leg_id_idx ON leg_likes(leg_id);
CREATE INDEX leg_likes_user_id_idx ON leg_likes(user_id);

-- 3. Leg comments
CREATE TABLE leg_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id      uuid NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leg_comments_leg_id_idx ON leg_comments(leg_id);
CREATE INDEX leg_comments_user_id_idx ON leg_comments(user_id);

-- 4. RLS
ALTER TABLE leg_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY \"anyone can view likes\" ON leg_likes FOR SELECT USING (true);
CREATE POLICY \"users can like\" ON leg_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY \"users can unlike\" ON leg_likes FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE leg_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY \"anyone can view comments\" ON leg_comments FOR SELECT USING (true);
CREATE POLICY \"users can comment\" ON leg_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY \"users can edit own comment\" ON leg_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY \"users can delete own comment\" ON leg_comments FOR DELETE USING (
  auth.uid() = user_id OR
  auth.uid() IN (
    SELECT b.owner_id FROM legs l
    JOIN journeys j ON j.id = l.journey_id
    JOIN boats b ON b.id = j.boat_id
    WHERE l.id = leg_comments.leg_id
  )
);
```

---

### Phase 2 — API Routes

**`GET /api/legs/[legId]/social`**
Returns: `{ likes_count, user_has_liked, comments_enabled, comments_count }`
- Public access; `user_has_liked` is false for unauthenticated users

**`POST /api/legs/[legId]/like`** (toggle)
Returns: `{ liked: boolean, likes_count: number }`
- Requires auth; inserts or deletes from `leg_likes`

**`GET /api/legs/[legId]/comments`**
Returns: `{ comments: [{ id, content, user_id, author_name, author_image_url, created_at, updated_at, is_own }], has_more }`
- Paginated (limit 20, cursor-based); joins with `profiles`

**`POST /api/legs/[legId]/comments`**
Body: `{ content: string }`
- Requires auth; checks `journeys.comments_enabled` before inserting

**`PUT /api/legs/[legId]/comments/[commentId]`**
Body: `{ content: string }`
- Requires auth; only own comments

**`DELETE /api/legs/[legId]/comments/[commentId]`**
- Requires auth; own comments OR journey owner (check via boat.owner_id)

---

### Phase 3 — Frontend Components

**New file:** `app/components/crew/SocialSection.tsx`

Sub-components (can be inline or separate):
- `LikeButton` — heart icon + count, toggles on click, optimistic update
- `ShareButtons` — row of 4 icons: Facebook, Messenger, WhatsApp, Copy URL
  - Facebook: `https://www.facebook.com/sharer/sharer.php?u=<encodedUrl>`
  - Messenger: `https://www.facebook.com/dialog/send?link=<encodedUrl>&app_id=<FB_APP_ID>` (or `fb-messenger://share?link=<url>` for mobile deep link)
  - WhatsApp: `https://wa.me/?text=<encodedText>`
  - Copy URL: uses `navigator.clipboard.writeText(url)` with toast feedback
- `CommentList` — scrollable list of comments with edit/delete actions
- `CommentInput` — textarea + submit button; hidden when commenting disabled

**Integration in `LegDetailsPanel.tsx`:**
- Import and render `<SocialSection legId={leg.leg_id} journeyId={leg.journey_id} />` directly after the image carousel block (around line 1489, before the first card div)
- No new props needed on LegDetailsPanel itself; SocialSection fetches its own data

**Leg URL for sharing:** `/crew?leg=<legId>` (absolute URL using `window.location.origin`)

---

### Phase 4 — Journey Edit Page

**File:** `app/owner/journeys/[journeyId]/edit/page.tsx`

Add a new section (e.g., \"Community Settings\") with a toggle switch:
```
Comments enabled   [toggle - default ON]
Allow crew members to comment on this journey's legs.
```
- Reads `journey.comments_enabled` from the existing journey fetch
- Saves via existing journey update API (add `comments_enabled` to the PATCH/PUT body)
- Ensure the journey update API accepts and persists `comments_enabled`

---

### Phase 5 — GDPR Deletion

**File:** `app/api/user/delete-account/route.ts`

Add before the profile deletion step:
```typescript
// Delete social data
await supabase.from('leg_comments').delete().eq('user_id', userId);
await supabase.from('leg_likes').delete().eq('user_id', userId);
```

---

### Key Files to Modify

| File | Change |
|------|--------|
| `migrations/062_social_features.sql` | CREATE (new migration) |
| `specs/tables.sql` | Add `leg_likes`, `leg_comments`, `journeys.comments_enabled` |
| `app/api/legs/[legId]/social/route.ts` | CREATE |
| `app/api/legs/[legId]/like/route.ts` | CREATE |
| `app/api/legs/[legId]/comments/route.ts` | CREATE |
| `app/api/legs/[legId]/comments/[commentId]/route.ts` | CREATE |
| `app/components/crew/SocialSection.tsx` | CREATE |
| `app/components/crew/LegDetailsPanel.tsx` | Add `<SocialSection>` after images |
| `app/owner/journeys/[journeyId]/edit/page.tsx` | Add comments_enabled toggle |
| `app/api/user/delete-account/route.ts` | Add social data deletion |

---

### Implementation Order
1. Migration + tables.sql
2. API routes (social GET, like POST, comments CRUD)
3. SocialSection component
4. LegDetailsPanel integration
5. Journey edit page toggle
6. GDPR deletion update"
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Migration `062_social_features.sql` created with `leg_likes`, `leg_comments` tables and `journeys.comments_enabled` column
- [ ] #2 `specs/tables.sql` updated to reflect new tables and column
- [ ] #3 GDPR account deletion route updated to delete `leg_likes` and `leg_comments` for the deleted user
- [ ] #4 API routes implemented: GET/POST `/api/legs/[legId]/social`, POST/DELETE `/api/legs/[legId]/like`, GET/POST `/api/legs/[legId]/comments`, PUT/DELETE `/api/legs/[legId]/comments/[commentId]`
- [ ] #5 RLS policies set: users can read all likes/comments on published legs; users can insert/delete own records; journey owners can delete any comment on their legs
- [ ] #6 `SocialSection` component created and integrated into `LegDetailsPanel` below images
- [ ] #7 Sharing buttons (Facebook, Messenger, WhatsApp, Copy URL) implemented and working
- [ ] #8 Journey edit page includes a `Comments enabled` toggle that saves to `journeys.comments_enabled`
- [ ] #9 All components are mobile-responsive and consistent with existing design system (Button, Card, etc.)
- [ ] #10 TypeScript compiles with no errors
<!-- DOD:END -->
