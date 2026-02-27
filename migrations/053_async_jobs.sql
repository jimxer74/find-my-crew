-- Migration 053: Async AI Job Infrastructure
-- Creates tables for background AI job execution that bypasses Vercel's 60s timeout.
-- Jobs execute in a Supabase Edge Function; progress streams to clients via Realtime.

-- ============================================================================
-- async_jobs: Job registry — state, payload, result
-- ============================================================================
create table if not exists public.async_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  job_type     text not null,
  status       text not null default 'pending',
  triggered_by text not null default 'user',
  payload      jsonb not null default '{}',
  result       jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz,

  constraint async_jobs_status_valid check (
    status in ('pending', 'running', 'completed', 'failed')
  ),
  constraint async_jobs_triggered_by_valid check (
    triggered_by in ('user', 'scheduler')
  )
);

create index if not exists idx_async_jobs_user_id on public.async_jobs(user_id);
create index if not exists idx_async_jobs_status  on public.async_jobs(status);

alter table public.async_jobs enable row level security;

create policy "Users can view their own jobs"
  on public.async_jobs for select
  using (user_id = auth.uid());

create policy "Authenticated users can create jobs"
  on public.async_jobs for insert
  with check (user_id = auth.uid());

-- ============================================================================
-- async_job_progress: Append-only progress log per job
-- Realtime is enabled so clients receive updates without polling.
-- ============================================================================
create table if not exists public.async_job_progress (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.async_jobs(id) on delete cascade,
  step_label text not null,
  percent    int,
  ai_message text,
  is_final   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_async_job_progress_job_id
  on public.async_job_progress(job_id);
create index if not exists idx_async_job_progress_job_id_created_at
  on public.async_job_progress(job_id, created_at);

alter table public.async_job_progress enable row level security;

create policy "Users can view progress for their own jobs"
  on public.async_job_progress for select
  using (
    exists (
      select 1 from public.async_jobs
      where async_jobs.id = async_job_progress.job_id
        and async_jobs.user_id = auth.uid()
    )
  );

-- Enable Realtime so clients receive INSERT events without polling.
-- Run in Supabase Dashboard → Database → Replication after applying migration:
--   alter publication supabase_realtime add table async_job_progress;
--   alter publication supabase_realtime add table async_jobs;
--
-- Or via SQL (requires superuser / Supabase service role):
alter table public.async_job_progress replica identity full;
alter table public.async_jobs        replica identity full;
