-- Migration 038: Refactor registration requirements system
--
-- Replaces the old generic question-type requirements with domain-specific
-- requirement types: risk_level, experience_level, skill, passport, question.
--
-- CLEAN SLATE: Existing journey_requirements and registration_answers data is
-- test data and will be dropped. No backward compatibility needed.

-- ============================================================================
-- Step 1: Drop existing tables (clean slate)
-- ============================================================================

-- Drop registration_answers first (depends on journey_requirements)
drop table if exists public.registration_answers cascade;

-- Drop journey_requirements
drop table if exists public.journey_requirements cascade;

-- ============================================================================
-- Step 2: Add new columns to journeys table (if not exists)
-- ============================================================================

-- Auto-approval toggle
alter table public.journeys
  add column if not exists auto_approval_enabled boolean default false;

-- Auto-approval threshold (0-100 match score)
alter table public.journeys
  add column if not exists auto_approval_threshold integer default 80;

-- Add check constraint for auto_approval_threshold (only if column was just added or constraint doesn't exist)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'journeys_auto_approval_threshold_check'
  ) then
    alter table public.journeys
      add constraint journeys_auto_approval_threshold_check
      check (auto_approval_threshold >= 0 and auto_approval_threshold <= 100);
  end if;
end $$;

-- ============================================================================
-- Step 3: Add AI assessment columns to registrations table (if not exists)
-- ============================================================================

alter table public.registrations
  add column if not exists ai_match_score integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'registrations_ai_match_score_check'
  ) then
    alter table public.registrations
      add constraint registrations_ai_match_score_check
      check (ai_match_score >= 0 and ai_match_score <= 100);
  end if;
end $$;

alter table public.registrations
  add column if not exists ai_match_reasoning text;

alter table public.registrations
  add column if not exists auto_approved boolean default false;

-- Indexes for AI fields
create index if not exists registrations_ai_match_score_idx
  on public.registrations (ai_match_score);
create index if not exists registrations_auto_approved_idx
  on public.registrations (auto_approved);

-- ============================================================================
-- Step 4: Create journey_requirements table (new schema)
-- ============================================================================

create table public.journey_requirements (
  id                      uuid primary key default gen_random_uuid(),
  journey_id              uuid not null references public.journeys (id) on delete cascade,
  requirement_type        varchar(50) not null,  -- 'risk_level', 'experience_level', 'skill', 'passport', 'question'
  -- For 'question' type:
  question_text           text,
  -- For 'skill' type:
  skill_name              text,  -- Canonical skill name from skills-config.json
  -- For 'skill' and 'question' types:
  qualification_criteria  text,  -- Free-text criteria for AI assessment
  weight                  integer default 5 check (weight >= 0 and weight <= 10),
  -- For 'passport' type:
  require_photo_validation boolean default false,
  pass_confidence_score   integer default 7 check (pass_confidence_score >= 0 and pass_confidence_score <= 10),
  -- Common fields:
  is_required             boolean default true,
  "order"                 integer default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Indexes
create index journey_requirements_journey_id_idx
  on public.journey_requirements (journey_id);
create index journey_requirements_journey_order_idx
  on public.journey_requirements (journey_id, "order");

-- Enable RLS
alter table public.journey_requirements enable row level security;

-- Policies
create policy "Requirements for published journeys are viewable by all"
on public.journey_requirements for select
using (
  exists (
    select 1 from journeys
    where journeys.id = journey_requirements.journey_id
    and (
      journeys.state = 'Published'::journey_state
      or exists (
        select 1 from boats
        where boats.id = journeys.boat_id
        and boats.owner_id = auth.uid()
      )
    )
  )
);

create policy "Owners can insert requirements for their journeys"
on public.journey_requirements for insert
to authenticated
with check (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = journey_requirements.journey_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Owners can update requirements for their journeys"
on public.journey_requirements for update
using (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = journey_requirements.journey_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Owners can delete requirements for their journeys"
on public.journey_requirements for delete
using (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = journey_requirements.journey_id
    and boats.owner_id = auth.uid()
  )
);

-- ============================================================================
-- Step 5: Create registration_answers table (new schema)
-- ============================================================================

create table public.registration_answers (
  id                        uuid primary key default gen_random_uuid(),
  registration_id           uuid not null references public.registrations (id) on delete cascade,
  requirement_id            uuid not null references public.journey_requirements (id) on delete cascade,
  -- For 'question' type:
  answer_text               text,
  answer_json               jsonb,
  -- For AI-assessed types (skill, question, passport):
  ai_score                  integer check (ai_score >= 0 and ai_score <= 10),
  ai_reasoning              text,
  -- For passport type:
  passport_document_id      uuid references public.document_vault (id),
  photo_verification_passed boolean,
  photo_confidence_score    numeric(3,2) check (photo_confidence_score >= 0 and photo_confidence_score <= 1),
  -- Common:
  passed                    boolean,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- Constraints:
  constraint registration_answers_unique unique (registration_id, requirement_id)
);

-- Indexes
create index registration_answers_registration_id_idx
  on public.registration_answers (registration_id);
create index registration_answers_requirement_id_idx
  on public.registration_answers (requirement_id);

-- Enable RLS
alter table public.registration_answers enable row level security;

-- Policies
create policy "Users can view their own registration answers"
on public.registration_answers for select
using (
  exists (
    select 1 from registrations
    where registrations.id = registration_answers.registration_id
    and registrations.user_id = auth.uid()
  )
);

create policy "Owners can view answers for their journey registrations"
on public.registration_answers for select
using (
  exists (
    select 1 from registrations
    join legs on legs.id = registrations.leg_id
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where registrations.id = registration_answers.registration_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Users can insert their own registration answers"
on public.registration_answers for insert
to authenticated
with check (
  exists (
    select 1 from registrations
    where registrations.id = registration_answers.registration_id
    and registrations.user_id = auth.uid()
  )
);

create policy "Users can update their own registration answers"
on public.registration_answers for update
using (
  exists (
    select 1 from registrations
    where registrations.id = registration_answers.registration_id
    and registrations.user_id = auth.uid()
    and registrations.status = 'Pending approval'
  )
);

-- ============================================================================
-- Step 6: Clean up orphaned AI assessment data on registrations
-- ============================================================================

-- Reset AI fields on all registrations since requirements were dropped
update public.registrations
set ai_match_score = null,
    ai_match_reasoning = null,
    auto_approved = false
where ai_match_score is not null or auto_approved = true;
