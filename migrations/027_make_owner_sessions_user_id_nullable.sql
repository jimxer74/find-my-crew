-- ============================================================================
-- MIGRATION: Make owner_sessions.user_id nullable
-- ============================================================================
-- Description: Allows unauthenticated users to create owner sessions
--              Similar to prospect_sessions, enabling onboarding before signup

-- Drop existing RLS policies
drop policy if exists "Users can view own owner sessions" on public.owner_sessions;
drop policy if exists "Users can create own owner sessions" on public.owner_sessions;
drop policy if exists "Users can update own owner sessions" on public.owner_sessions;
drop policy if exists "Users can delete own owner sessions" on public.owner_sessions;

-- Make user_id nullable
alter table public.owner_sessions 
  alter column user_id drop not null;

-- Update index to handle null values
drop index if exists idx_owner_sessions_user_id;
create index if not exists idx_owner_sessions_user_id 
  on public.owner_sessions(user_id) 
  where user_id is not null;

-- Update email index to handle unauthenticated sessions
drop index if exists idx_owner_sessions_email;
create index if not exists idx_owner_sessions_email 
  on public.owner_sessions(email) 
  where email is not null and user_id is null;

-- Recreate RLS Policies (similar to prospect_sessions)

-- SELECT: Unauthenticated users can view sessions with user_id = NULL
create policy "Unauthenticated users can view their owner sessions"
  on public.owner_sessions
  for select
  using (user_id is null);

-- INSERT: Unauthenticated users can create sessions with user_id = NULL
create policy "Unauthenticated users can create owner sessions"
  on public.owner_sessions
  for insert
  with check (user_id is null);

-- UPDATE: Unauthenticated users can update sessions with user_id = NULL
create policy "Unauthenticated users can update their owner sessions"
  on public.owner_sessions
  for update
  using (user_id is null)
  with check (user_id is null);

-- DELETE: Unauthenticated users can delete sessions with user_id = NULL
create policy "Unauthenticated users can delete their owner sessions"
  on public.owner_sessions
  for delete
  using (user_id is null);

-- Authenticated users can access their own sessions
create policy "Users can view own owner sessions"
  on public.owner_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can update own owner sessions"
  on public.owner_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own owner sessions"
  on public.owner_sessions
  for delete
  using (auth.uid() = user_id);

-- Service role can access all sessions (for cleanup jobs and session linking)
-- Drop and recreate to ensure it works with nullable user_id
drop policy if exists "Service role can manage all owner sessions" on public.owner_sessions;
create policy "Service role can manage all owner sessions"
  on public.owner_sessions
  for all
  using (auth.jwt() ->> 'role' = 'service_role');
