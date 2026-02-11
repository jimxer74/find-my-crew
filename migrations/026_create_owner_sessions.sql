-- ============================================================================
-- MIGRATION: Create owner_sessions table
-- ============================================================================
-- Description: Creates owner_sessions table for storing owner onboarding chat data
--              Separate from prospect_sessions for clean separation of concerns
--              Owners are always authenticated, so simpler RLS policies

-- TABLE: owner_sessions
-- ============================================================================

create table if not exists public.owner_sessions (
  session_id uuid primary key,
  -- Owners are always authenticated, so user_id is required
  user_id uuid references auth.users(id) on delete cascade not null,
  -- Optional: email for session recovery
  email text,
  conversation jsonb not null default '[]'::jsonb,
  gathered_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Indexes for performance
create index if not exists idx_owner_sessions_user_id 
  on public.owner_sessions(user_id);

-- Index for email-based session recovery
create index if not exists idx_owner_sessions_email 
  on public.owner_sessions(email) 
  where email is not null;

create index if not exists idx_owner_sessions_expires 
  on public.owner_sessions(expires_at);

create index if not exists idx_owner_sessions_last_active 
  on public.owner_sessions(last_active_at);

-- Enable Row Level Security
alter table public.owner_sessions enable row level security;

-- RLS Policies
-- Owners are always authenticated, so simpler policies than prospect_sessions

-- SELECT: Users can view their own sessions
create policy "Users can view own owner sessions"
  on public.owner_sessions
  for select
  using (auth.uid() = user_id);

-- INSERT: Users can create their own sessions
create policy "Users can create own owner sessions"
  on public.owner_sessions
  for insert
  with check (auth.uid() = user_id);

-- UPDATE: Users can update their own sessions
create policy "Users can update own owner sessions"
  on public.owner_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: Users can delete their own sessions
create policy "Users can delete own owner sessions"
  on public.owner_sessions
  for delete
  using (auth.uid() = user_id);

-- Service role can access all sessions (for cleanup jobs)
create policy "Service role can manage all owner sessions"
  on public.owner_sessions
  for all
  using (auth.jwt() ->> 'role' = 'service_role');
