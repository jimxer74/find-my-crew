-- Migration: Create feedback system tables
-- Description: Tables for user feedback, voting, and prompt dismissals

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Feedback type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'feedback_type') then
    create type feedback_type as enum ('bug', 'feature', 'improvement', 'other');
  end if;
end$$;

-- Feedback status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'feedback_status') then
    create type feedback_status as enum (
      'new',           -- Just submitted
      'under_review',  -- Being evaluated
      'planned',       -- Accepted, in roadmap
      'in_progress',   -- Currently being worked on
      'completed',     -- Done and deployed
      'declined'       -- Won't implement (with reason)
    );
  end if;
end$$;


-- ============================================================================
-- TABLE: feedback
-- ============================================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),

  -- Submitter
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Content
  type feedback_type not null,
  title varchar(200) not null,
  description text,

  -- Context (optional - where feedback was submitted from)
  context_page varchar(100),      -- e.g., '/crew/dashboard'
  context_metadata jsonb,         -- Additional context like journey_id, leg_id

  -- Status tracking
  status feedback_status not null default 'new',
  status_note text,               -- Admin note explaining status change
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id),

  -- Voting (denormalized for performance)
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  vote_score integer generated always as (upvotes - downvotes) stored,

  -- Visibility
  is_public boolean not null default true,
  is_anonymous boolean not null default false,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_feedback_status on public.feedback(status);
create index if not exists idx_feedback_type on public.feedback(type);
create index if not exists idx_feedback_user_id on public.feedback(user_id);
create index if not exists idx_feedback_vote_score on public.feedback(vote_score desc);
create index if not exists idx_feedback_created_at on public.feedback(created_at desc);
create index if not exists idx_feedback_public on public.feedback(is_public) where is_public = true;

-- Enable Row Level Security
alter table public.feedback enable row level security;

-- Policies
-- Public feedback viewable by all, own feedback always viewable
create policy "Public feedback viewable by all"
on public.feedback for select
using (is_public = true or user_id = auth.uid());

-- Users can create their own feedback
create policy "Users can create feedback"
on public.feedback for insert
with check (auth.uid() = user_id);

-- Users can update their own feedback
create policy "Users can update own feedback"
on public.feedback for update
using (auth.uid() = user_id);

-- Users can delete their own feedback
create policy "Users can delete own feedback"
on public.feedback for delete
using (auth.uid() = user_id);

-- Trigger for updated_at
create or replace function update_feedback_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_feedback_updated_at
  before update on public.feedback
  for each row
  execute function update_feedback_updated_at();


-- ============================================================================
-- TABLE: feedback_votes
-- ============================================================================

create table if not exists public.feedback_votes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)), -- -1 = downvote, 1 = upvote
  created_at timestamptz not null default now(),

  constraint unique_user_feedback_vote unique (feedback_id, user_id)
);

-- Indexes
create index if not exists idx_feedback_votes_feedback_id on public.feedback_votes(feedback_id);
create index if not exists idx_feedback_votes_user_id on public.feedback_votes(user_id);

-- Enable Row Level Security
alter table public.feedback_votes enable row level security;

-- Policies
-- Votes viewable by all (to show who voted)
create policy "Votes viewable by all"
on public.feedback_votes for select
using (true);

-- Users can create their own votes
create policy "Users can vote"
on public.feedback_votes for insert
with check (auth.uid() = user_id);

-- Users can update their own votes
create policy "Users can change vote"
on public.feedback_votes for update
using (auth.uid() = user_id);

-- Users can remove their own votes
create policy "Users can remove vote"
on public.feedback_votes for delete
using (auth.uid() = user_id);

-- Trigger to update vote counts on feedback table
create or replace function update_feedback_vote_counts()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.feedback set
      upvotes = upvotes + case when new.vote = 1 then 1 else 0 end,
      downvotes = downvotes + case when new.vote = -1 then 1 else 0 end,
      updated_at = now()
    where id = new.feedback_id;
  elsif tg_op = 'DELETE' then
    update public.feedback set
      upvotes = upvotes - case when old.vote = 1 then 1 else 0 end,
      downvotes = downvotes - case when old.vote = -1 then 1 else 0 end,
      updated_at = now()
    where id = old.feedback_id;
  elsif tg_op = 'UPDATE' then
    update public.feedback set
      upvotes = upvotes - case when old.vote = 1 then 1 else 0 end
                        + case when new.vote = 1 then 1 else 0 end,
      downvotes = downvotes - case when old.vote = -1 then 1 else 0 end
                            + case when new.vote = -1 then 1 else 0 end,
      updated_at = now()
    where id = new.feedback_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger trigger_update_feedback_votes
  after insert or update or delete on public.feedback_votes
  for each row
  execute function update_feedback_vote_counts();


-- ============================================================================
-- TABLE: feedback_prompt_dismissals
-- ============================================================================

create table if not exists public.feedback_prompt_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_type varchar(50) not null, -- 'post_journey', 'post_registration', 'general'
  dismissed_at timestamptz not null default now(),
  dismiss_until timestamptz, -- NULL = forever, otherwise show again after this date

  constraint unique_user_prompt_dismissal unique (user_id, prompt_type)
);

-- Indexes
create index if not exists idx_feedback_prompt_dismissals_user_id on public.feedback_prompt_dismissals(user_id);

-- Enable Row Level Security
alter table public.feedback_prompt_dismissals enable row level security;

-- Policies
-- Users can only view their own dismissals
create policy "Users can view own dismissals"
on public.feedback_prompt_dismissals for select
using (auth.uid() = user_id);

-- Users can create their own dismissals
create policy "Users can create dismissals"
on public.feedback_prompt_dismissals for insert
with check (auth.uid() = user_id);

-- Users can update their own dismissals
create policy "Users can update dismissals"
on public.feedback_prompt_dismissals for update
using (auth.uid() = user_id);

-- Users can delete their own dismissals
create policy "Users can delete dismissals"
on public.feedback_prompt_dismissals for delete
using (auth.uid() = user_id);


-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table public.feedback is 'User-submitted feedback including bugs, feature requests, and improvements';
comment on column public.feedback.type is 'Category of feedback: bug, feature, improvement, or other';
comment on column public.feedback.status is 'Current status in the feedback lifecycle';
comment on column public.feedback.vote_score is 'Net votes (upvotes - downvotes), computed column for sorting';
comment on column public.feedback.is_anonymous is 'If true, submitter name is hidden from public view (user_id still tracked for rate limiting)';

comment on table public.feedback_votes is 'Tracks individual votes on feedback items, one vote per user per feedback';
comment on column public.feedback_votes.vote is '1 for upvote, -1 for downvote';

comment on table public.feedback_prompt_dismissals is 'Tracks when users dismiss feedback prompts to control prompt frequency';
comment on column public.feedback_prompt_dismissals.dismiss_until is 'NULL means dismissed forever, timestamp means show again after this date';
