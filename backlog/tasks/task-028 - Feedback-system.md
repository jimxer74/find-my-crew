---
id: TASK-028
title: Feedback system
status: In Progress
assignee: []
created_date: '2026-01-25 11:55'
updated_date: '2026-02-01 12:27'
labels:
  - feature
  - community
  - ux
  - engagement
dependencies: []
references:
  - app/lib/notifications/service.ts
  - app/lib/notifications/types.ts
  - app/components/notifications/NotificationCenter.tsx
  - 'app/api/registrations/[registrationId]/route.ts'
  - specs/tables.sql
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a user feedback system that allows users to submit enhancement proposals, bug reports, and recommendations. The system should also support community voting on proposed features to help prioritize development.

## Problem Statement
Currently there's no structured way for users to:
1. Report bugs or issues they encounter
2. Suggest new features or improvements
3. See what others have suggested
4. Vote on features they want prioritized

## Solution Overview
A feedback system with:
- **Feedback submission** - Quick form to submit bugs, features, or general feedback
- **Public feedback board** - Browse and search submitted feedback
- **Voting system** - Upvote/downvote proposals to indicate interest
- **Status tracking** - See if feedback is under review, planned, in progress, or completed
- **Smart prompts** - Non-intrusive prompts at natural moments in user flows

## Key Principles
- **Non-intrusive** - Prompts should enhance, not interrupt user experience
- **Low friction** - Quick to submit feedback (1-2 fields minimum)
- **Transparent** - Users can see status of their and others' feedback
- **Community-driven** - Voting helps prioritize what matters most
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can submit feedback with type (bug/feature/improvement/other), title, and optional description
- [ ] #2 Users can browse all public feedback submissions in a searchable/filterable list
- [ ] #3 Users can upvote or downvote feedback (one vote per user per item)
- [ ] #4 Feedback items show vote count, submission date, and current status
- [ ] #5 Admin/system can update feedback status (New, Under Review, Planned, In Progress, Completed, Declined)
- [ ] #6 Feedback prompts appear at strategic moments (post-journey, after key actions) without being annoying
- [ ] #7 Users can dismiss prompts and not see them again for a configurable period
- [ ] #8 Users receive notification when their feedback status changes
- [ ] #9 Feedback form is accessible from navigation menu and footer
- [ ] #10 Mobile-friendly UI for all feedback features
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Database Schema

**Migration:** `migrations/014_create_feedback_system.sql`

```sql
-- Feedback type enum
CREATE TYPE feedback_type AS ENUM ('bug', 'feature', 'improvement', 'other');

-- Feedback status enum  
CREATE TYPE feedback_status AS ENUM (
  'new',           -- Just submitted
  'under_review',  -- Being evaluated
  'planned',       -- Accepted, in roadmap
  'in_progress',   -- Currently being worked on
  'completed',     -- Done and deployed
  'declined'       -- Won't implement (with reason)
);

-- Main feedback table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Submitter
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Content
  type feedback_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Context (optional - where feedback was submitted from)
  context_page VARCHAR(100),      -- e.g., '/crew/dashboard'
  context_metadata JSONB,         -- Additional context like journey_id, leg_id
  
  -- Status tracking
  status feedback_status NOT NULL DEFAULT 'new',
  status_note TEXT,               -- Admin note explaining status change
  status_changed_at TIMESTAMPTZ,
  status_changed_by UUID REFERENCES auth.users(id),
  
  -- Voting (denormalized for performance)
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  vote_score INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,
  
  -- Visibility
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votes table (tracks who voted what)
CREATE TABLE public.feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)), -- -1 = downvote, 1 = upvote
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_feedback_vote UNIQUE (feedback_id, user_id)
);

-- Feedback prompt dismissals (tracks when users dismiss prompts)
CREATE TABLE public.feedback_prompt_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_type VARCHAR(50) NOT NULL, -- 'post_journey', 'post_registration', 'general'
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismiss_until TIMESTAMPTZ, -- NULL = forever, otherwise show again after this date
  
  CONSTRAINT unique_user_prompt_dismissal UNIQUE (user_id, prompt_type)
);

-- Indexes
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_type ON public.feedback(type);
CREATE INDEX idx_feedback_user ON public.feedback(user_id);
CREATE INDEX idx_feedback_vote_score ON public.feedback(vote_score DESC);
CREATE INDEX idx_feedback_created ON public.feedback(created_at DESC);
CREATE INDEX idx_feedback_votes_feedback ON public.feedback_votes(feedback_id);
CREATE INDEX idx_feedback_votes_user ON public.feedback_votes(user_id);

-- RLS Policies
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_prompt_dismissals ENABLE ROW LEVEL SECURITY;

-- Feedback: Public items viewable by all, own items always viewable
CREATE POLICY "Public feedback viewable by all"
ON public.feedback FOR SELECT
USING (is_public = true OR user_id = auth.uid());

-- Feedback: Users can create their own
CREATE POLICY "Users can create feedback"
ON public.feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Feedback: Users can update their own (only certain fields)
CREATE POLICY "Users can update own feedback"
ON public.feedback FOR UPDATE
USING (auth.uid() = user_id);

-- Votes: Viewable by all
CREATE POLICY "Votes viewable by all"
ON public.feedback_votes FOR SELECT
USING (true);

-- Votes: Users can manage their own votes
CREATE POLICY "Users can vote"
ON public.feedback_votes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change vote"
ON public.feedback_votes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can remove vote"
ON public.feedback_votes FOR DELETE
USING (auth.uid() = user_id);

-- Dismissals: Users can only access their own
CREATE POLICY "Users can view own dismissals"
ON public.feedback_prompt_dismissals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create dismissals"
ON public.feedback_prompt_dismissals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update dismissals"
ON public.feedback_prompt_dismissals FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger to update vote counts
CREATE OR REPLACE FUNCTION update_feedback_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feedback SET
      upvotes = upvotes + CASE WHEN NEW.vote = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote = -1 THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = NEW.feedback_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feedback SET
      upvotes = upvotes - CASE WHEN OLD.vote = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN OLD.vote = -1 THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = OLD.feedback_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.feedback SET
      upvotes = upvotes - CASE WHEN OLD.vote = 1 THEN 1 ELSE 0 END 
                        + CASE WHEN NEW.vote = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN OLD.vote = -1 THEN 1 ELSE 0 END
                            + CASE WHEN NEW.vote = -1 THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = NEW.feedback_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feedback_votes
AFTER INSERT OR UPDATE OR DELETE ON public.feedback_votes
FOR EACH ROW EXECUTE FUNCTION update_feedback_vote_counts();
```

---

### Phase 2: API Endpoints

**1. GET `/api/feedback`** - List feedback with filters
```typescript
interface FeedbackListParams {
  type?: 'bug' | 'feature' | 'improvement' | 'other';
  status?: feedback_status;
  sort?: 'newest' | 'oldest' | 'most_votes' | 'least_votes';
  search?: string;
  page?: number;
  limit?: number; // default 20
}

interface FeedbackListResponse {
  items: FeedbackItem[];
  total: number;
  page: number;
  hasMore: boolean;
}
```

**2. POST `/api/feedback`** - Create new feedback
```typescript
interface CreateFeedbackRequest {
  type: feedback_type;
  title: string;
  description?: string;
  is_anonymous?: boolean;
  context_page?: string;
  context_metadata?: object;
}
```

**3. GET `/api/feedback/[id]`** - Get single feedback item

**4. PATCH `/api/feedback/[id]`** - Update feedback (own) or status (admin)

**5. POST `/api/feedback/[id]/vote`** - Vote on feedback
```typescript
interface VoteRequest {
  vote: 1 | -1 | 0; // 0 = remove vote
}
```

**6. GET `/api/feedback/my`** - Get current user's submissions

**7. GET `/api/feedback/prompts`** - Check if any prompts should show
```typescript
interface PromptsResponse {
  showPostJourneyPrompt: boolean;
  showGeneralPrompt: boolean;
  // ... other prompt states
}
```

**8. POST `/api/feedback/prompts/dismiss`** - Dismiss a prompt
```typescript
interface DismissRequest {
  promptType: string;
  dismissDays?: number; // null = forever
}
```

---

### Phase 3: UI Components

**1. FeedbackButton** (`app/components/feedback/FeedbackButton.tsx`)
- Floating action button (FAB) in bottom-right corner
- Or subtle button in footer/navigation
- Opens feedback modal on click

**2. FeedbackModal** (`app/components/feedback/FeedbackModal.tsx`)
- Quick submission form
- Type selector (bug/feature/improvement/other)
- Title input (required)
- Description textarea (optional)
- Anonymous toggle
- Submit button with loading state

**3. FeedbackCard** (`app/components/feedback/FeedbackCard.tsx`)
- Displays single feedback item
- Shows: type badge, title, description preview, vote count, status badge
- Vote buttons (up/down)
- Author (or "Anonymous")
- Timestamp

**4. FeedbackList** (`app/components/feedback/FeedbackList.tsx`)
- Grid/list of FeedbackCards
- Filter bar (type, status, sort)
- Search input
- Pagination or infinite scroll
- Empty state

**5. FeedbackPrompt** (`app/components/feedback/FeedbackPrompt.tsx`)
- Non-intrusive banner/toast for prompting feedback
- Variants: post-journey, general, contextual
- Dismiss button with "don't show again" option
- Quick action to open feedback modal

**6. VoteButtons** (`app/components/feedback/VoteButtons.tsx`)
- Upvote/downvote with counts
- Disabled state for own feedback
- Highlighted state for user's vote

---

### Phase 4: Pages

**1. Feedback Board** (`app/feedback/page.tsx`)
- Public page showing all feedback
- Tabs: All | Features | Bugs | Improvements
- Sidebar with status filters
- Top voted section
- Recently completed section

**2. My Feedback** (`app/feedback/my/page.tsx`)
- User's submitted feedback
- Status of each item
- Edit/delete own submissions

**3. Feedback Detail** (`app/feedback/[id]/page.tsx`)
- Full feedback view
- Vote buttons
- Status timeline (if status changed)
- Link back to list

---

### Phase 5: Prompt Integration Points

**Strategic moments to prompt for feedback (non-intrusive):**

| Trigger | Prompt Type | Implementation |
|---------|-------------|----------------|
| After journey completion | Post-journey | Check if user was crew on completed leg, show 24h after end_date |
| After 5 successful actions | Engagement milestone | Track in localStorage, show after threshold |
| After registration approved | Positive moment | Show subtle prompt in success notification |
| Monthly (if active) | General check-in | Show if user has been active but not submitted feedback recently |
| After encountering error | Bug report | Offer to report when error occurs |

**Prompt frequency rules:**
- Max 1 prompt per session
- Minimum 7 days between prompts
- Respect "don't show again" dismissals
- Never show during critical flows (checkout, registration, etc.)

---

### Phase 6: Notifications

**New notification types:**

| Type | Recipient | Trigger |
|------|-----------|---------|
| `FEEDBACK_STATUS_CHANGED` | Submitter | Status changes to planned/in_progress/completed/declined |
| `FEEDBACK_MILESTONE` | Submitter | Feedback reaches 10/50/100 upvotes |

**Email template (status change):**
```
Subject: Update on your feedback: "{title}"

Hi {name},

Your feedback "{title}" has been updated:

Status: {old_status} → {new_status}

{status_note if present}

View details: {link}

Thank you for helping us improve Find My Crew!
```

---

### Phase 7: Admin Features (Future Enhancement)

For MVP, status updates can be done directly in Supabase dashboard. Future admin panel could include:

- Bulk status updates
- Merge duplicate feedback
- Pin important items
- Feature announcement when completed
- Analytics dashboard (submission trends, response times)

---

## File Structure

```
app/
├── api/
│   └── feedback/
│       ├── route.ts              # GET (list), POST (create)
│       ├── my/
│       │   └── route.ts          # GET (user's feedback)
│       ├── prompts/
│       │   ├── route.ts          # GET (check prompts)
│       │   └── dismiss/
│       │       └── route.ts      # POST (dismiss prompt)
│       └── [id]/
│           ├── route.ts          # GET, PATCH
│           └── vote/
│               └── route.ts      # POST (vote)
├── components/
│   └── feedback/
│       ├── FeedbackButton.tsx
│       ├── FeedbackModal.tsx
│       ├── FeedbackCard.tsx
│       ├── FeedbackList.tsx
│       ├── FeedbackPrompt.tsx
│       ├── VoteButtons.tsx
│       ├── StatusBadge.tsx
│       └── TypeBadge.tsx
├── feedback/
│   ├── page.tsx                  # Public feedback board
│   ├── my/
│   │   └── page.tsx              # User's submissions
│   └── [id]/
│       └── page.tsx              # Single feedback view
└── lib/
    └── feedback/
        ├── types.ts
        ├── service.ts
        └── prompts.ts

migrations/
└── 014_create_feedback_system.sql

specs/
└── tables.sql (updated)
```

---

## UI/UX Wireframes

### Feedback Modal (Quick Submit)
```
┌─────────────────────────────────────┐
│  Share Your Feedback           [X]  │
├─────────────────────────────────────┤
│                                     │
│  What type of feedback?             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ 🐛  │ │ ✨  │ │ 💡  │ │ 💬  │   │
│  │ Bug │ │Feat.│ │Impr.│ │Other│   │
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│                                     │
│  Title *                            │
│  ┌─────────────────────────────┐   │
│  │ e.g., "Add dark mode"       │   │
│  └─────────────────────────────┘   │
│                                     │
│  Description (optional)             │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ☐ Submit anonymously              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │        Submit Feedback       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Feedback Card
```
┌─────────────────────────────────────┐
│  [✨ Feature]              [New]    │
│                                     │
│  Add dark mode support              │
│                                     │
│  The app is hard to read at night   │
│  when my phone is in dark mode...   │
│                                     │
│  ┌───┐                              │
│  │ ▲ │  42        by @sailor123     │
│  │ ▼ │           2 days ago         │
│  └───┘                              │
└─────────────────────────────────────┘
```

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Database Schema | 2 hours |
| API Endpoints | 4 hours |
| UI Components | 6 hours |
| Pages | 4 hours |
| Prompt Integration | 3 hours |
| Notifications | 2 hours |
| Testing | 3 hours |
| **Total** | **~24 hours** |
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Technical Decisions

### Why denormalized vote counts?
- Avoids COUNT(*) query on every feedback list load
- Vote operations are relatively rare vs. reads
- Trigger keeps counts in sync automatically
- Can always recalculate if needed

### Why separate votes table?
- Enforces one vote per user per feedback
- Allows changing vote without delete+insert
- Provides audit trail of who voted
- Enables "see who voted" feature later

### Why prompt dismissals table?
- More flexible than localStorage (works across devices)
- Can implement "show again after X days"
- Analytics on prompt effectiveness
- Respects user preferences server-side

### Why not use a third-party feedback tool?
- Full control over UX and integration
- No external dependencies
- Data stays in our database
- Can customize to sailing/crew context
- No additional costs

### Anonymous feedback considerations
- Still tracks user_id for rate limiting
- Just hides display name publicly
- Admin can see submitter if needed (abuse prevention)

## Prompt Strategy Details

### Post-Journey Prompt
- Trigger: 24 hours after leg end_date where user was approved crew
- Dismissible for 30 days
- Only show once per journey
- Message: "How was your journey? Share feedback to help us improve"

### Engagement Milestone
- Track in localStorage: successful_actions counter
- Reset on feedback submission
- Threshold: 5 successful actions (registration, profile update, etc.)
- Dismissible for 14 days

### Error Recovery
- When user encounters an error page or API error
- Offer: "Something went wrong. Want to report this?"
- Pre-fill context (page, error message)
- No dismissal tracking (always offer on errors)

## Future Enhancements

1. **Comments on feedback** - Allow discussion threads
2. **Attachments** - Screenshots for bug reports
3. **Duplicate detection** - AI to suggest similar existing feedback
4. **Roadmap page** - Public view of planned features
5. **Release notes** - Announce when feedback is implemented
6. **Gamification** - Badges for helpful feedback
7. **Admin dashboard** - Manage feedback at scale
<!-- SECTION:NOTES:END -->
