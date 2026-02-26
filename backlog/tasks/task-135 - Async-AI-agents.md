---
id: TASK-135
title: Async AI agents
status: To Do
assignee: []
created_date: '2026-02-26 08:19'
updated_date: '2026-02-26 09:29'
labels:
  - ai
  - architecture
  - background-jobs
  - infrastructure
dependencies: []
references:
  - doc-010
  - doc-012
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Overview

Create a shared infrastructure capability that enables long-running AI agentic workflows to execute in the background, bypassing Vercel's 60-second serverless timeout. Workflows can be triggered either by explicit user action or by a scheduler. The user sees real-time progress and is notified on completion.

**Technology decision: Option A — Supabase-native.** No new external services. Uses Supabase Edge Functions (worker runtime), Supabase Realtime (progress transport), pg_cron (scheduling), and a new database job table (state + progress log).

This is foundational infrastructure — once built it is reusable for any AI workflow in the platform (owner onboarding, journey generation, crew matching analysis, etc.).

---

## Why This Is Needed

### The Timeout Problem (doc-010)

Vercel Pro hard-caps serverless functions at **60 seconds**. The current AI chat endpoints already hit this:

- `app/api/ai/owner/chat/route.ts` — `maxDuration = 60`
- `app/api/ai/prospect/chat/route.ts` — `maxDuration = 60`

A full owner onboarding session takes **85+ seconds**:
- Initial AI greeting: ~15s
- Profile creation (AI + tool + DB): ~10s
- Boat suggestions (AI response): ~15s
- Boat creation (tool + DB): ~15s
- Journey generation (AI reasoning + RPC + geocoding): ~30s

The inner tool loop (`app/lib/ai/owner/service.ts`, `MAX_TOOL_ITERATIONS = 10`) makes an AI call and executes tools on every iteration. Optimisation alone cannot bring this within 60 seconds for complex flows.

### The Intermediate Messages Problem (doc-012)

The synchronous tool loop discards intermediate AI messages — the reasoning produced *before* each tool call is never returned to the user. Moving to async naturally solves this: each iteration's output is emitted as a progress event and rendered incrementally.

---

## Current Architecture Context

- **AI service**: `app/lib/ai/service.ts` — `callAI()` single entry point, synchronous
- **Owner chat loop**: `app/lib/ai/owner/service.ts` — synchronous while-loop, MAX_TOOL_ITERATIONS = 10
- **Prospect chat loop**: `app/lib/ai/prospect/service.ts` — same pattern
- **Route handlers**: `app/api/ai/owner/chat/route.ts`, `app/api/ai/prospect/chat/route.ts`
- **Database**: Supabase (PostgreSQL + Realtime + Storage)
- **Hosting**: Vercel (Pro plan, 60s limit)
- **Session state**: `owner_sessions`, `prospect_sessions` JSONB columns store conversation history

---

## Decided Architecture: Option A — Supabase-Native

### Components

| Component | Role |
|-----------|------|
| **Supabase Edge Function** | Worker runtime — executes the full AI tool loop with no Vercel timeout constraint. Runs on Deno at the edge. Invoked via HTTP (`supabase.functions.invoke()`). Responds immediately, continues processing via `EdgeRuntime.waitUntil()` for unbounded background work. |
| **Supabase Realtime** | Progress transport — client subscribes to DB changes on the `async_job_progress` table filtered by `job_id`. Zero new infrastructure; already integrated in client via `getSupabaseBrowserClient()`. |
| **pg_cron** | Scheduler — triggers recurring/scheduled jobs on a cron expression directly in PostgreSQL. Available on Supabase Pro. |
| **`async_jobs` table** | Job registry — tracks job state (`pending`, `running`, `completed`, `failed`), payload, owner user ID, timestamps, and final result. |
| **`async_job_progress` table** | Progress log — append-only rows written by the worker per iteration: step label, percentage, intermediate AI message content. Realtime listens here. |

### Request Flow — User-Triggered Job

```
1. User action in client (e.g. "Generate journey")
   ↓
2. Next.js API route (≤60s budget — just orchestrates):
   - Validates auth
   - Creates job row in `async_jobs` (status: pending)
   - Calls supabase.functions.invoke('ai-job-worker', { jobId })
   - Returns { jobId } to client immediately
   ↓
3. Client subscribes to Realtime on `async_job_progress` where job_id = jobId
   - Shows progress UI (step name, %, intermediate AI messages)
   ↓
4. Supabase Edge Function ('ai-job-worker'):
   - Responds 200 immediately (within Edge Function timeout)
   - Uses EdgeRuntime.waitUntil() to continue processing in background
   - Loads job payload, runs AI tool loop iteration by iteration
   - After each iteration: inserts row into `async_job_progress`
   - On complete: updates `async_jobs.status = 'completed'`, stores result
   - On error: updates `async_jobs.status = 'failed'`, stores error
   ↓
5. Client Realtime subscription receives progress rows as they arrive
   - Renders each intermediate AI message
   - Shows step/percentage progress bar
   - On job status → completed: fetches final result and closes progress UI
```

### Request Flow — Scheduled Job

```
1. pg_cron fires on schedule (e.g. '0 * * * *')
   ↓
2. pg_cron calls a PostgreSQL function that:
   - Creates a job row in `async_jobs` (status: pending, triggered_by: 'scheduler')
   - Calls net.http_post() to invoke the Edge Function (pg_net extension)
   ↓
3. Same Edge Function execution path as above
   (no client progress subscription for scheduler-triggered jobs)
```

### Database Schema (outline)

```sql
-- Job registry
create table async_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  job_type     text not null,           -- e.g. 'owner-onboarding-chat', 'journey-generation'
  status       text not null default 'pending',  -- pending | running | completed | failed
  triggered_by text not null default 'user',     -- user | scheduler
  payload      jsonb not null default '{}',
  result       jsonb,
  error        text,
  created_at   timestamptz default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

-- Progress log (append-only, Realtime-enabled)
create table async_job_progress (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references async_jobs(id) on delete cascade,
  step_label      text not null,
  percent         int,                  -- 0-100, optional
  ai_message      text,                 -- intermediate AI message content, if any
  is_final        boolean default false,
  created_at      timestamptz default now()
);
```

RLS: jobs and progress rows are readable only by the owning user (or service role for the worker).

### Shared Module Structure

```
shared/lib/async-jobs/
  index.ts              — barrel export
  types.ts              — AsyncJob, JobProgress, JobType, JobStatus types
  submitJob.ts          — client helper: POST to API route, returns jobId
  useJobProgress.ts     — React hook: subscribes to Realtime, returns progress[]
  useJobResult.ts       — React hook: polls/subscribes for final result

shared/components/async-jobs/
  JobProgressPanel.tsx  — UI: step label, progress bar, streaming AI messages
  index.ts              — barrel export

supabase/functions/ai-job-worker/
  index.ts              — Edge Function entry point
```

---

## Proof-of-Concept Target

Owner onboarding **journey generation** — the slowest single step (~30s AI reasoning + RPC + geocoding). Migrating this one step proves the pattern end-to-end without rewriting the entire chat flow at once.

---

## Relationship to doc-012 (Intermediate Messages)

Async jobs naturally resolve the intermediate message problem. The worker emits one `async_job_progress` row per tool-loop iteration including the `ai_message` field. The `JobProgressPanel` renders these incrementally as they arrive via Realtime — no separate API contract change needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shared `async-jobs` module exists under `shared/lib/async-jobs/` with a typed API for submitting, tracking, and consuming background AI jobs
- [ ] #2 A background worker can execute the full AI tool loop without hitting any serverless timeout (job runs to completion regardless of duration)
- [ ] #3 Each tool-loop iteration emits a progress event that includes: current step label, optional percentage, and any intermediate AI message content
- [ ] #4 Client can subscribe to real-time progress updates for a given job ID and display them while the job is running
- [ ] #5 Client receives a clear completion event (success or failure) and can retrieve the final job result
- [ ] #6 A workflow can be triggered by the user (explicit action) or by a scheduler (cron/recurring trigger)
- [ ] #7 Technology choice is documented with rationale, pros/cons, and how it fits the existing Vercel + Supabase architecture
- [ ] #8 At least one existing slow AI workflow (e.g., owner onboarding journey generation) is migrated to the async pattern as a proof-of-concept
- [ ] #9 Intermediate AI messages from the tool loop are preserved and surfaced to the client (resolves doc-012 issue)
- [ ] #10 The async job infrastructure integrates with existing Supabase auth/RLS — jobs are scoped to the owning user
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Key Constraints

- Vercel Pro: 60-second hard limit — cannot be raised
- Supabase Edge Functions: use `EdgeRuntime.waitUntil()` to run AI loop past the HTTP response deadline
- Supabase Realtime must be enabled on `async_job_progress` table (set `REPLICA IDENTITY FULL`)
- pg_net extension required for pg_cron → Edge Function invocation (available on Supabase Pro)
- All new DB tables must follow `/migrations/` sequential numbering and update `/specs/tables.sql`
- GDPR: `async_jobs` and `async_job_progress` cascade-delete when `auth.users` row is deleted (ON DELETE CASCADE on user_id FK)
- The Edge Function runs with the Supabase **service role key** (not anon key) — it must validate the job belongs to the expected user before processing

## Implementation Order (when ready to start)

1. Technology spike: verify `EdgeRuntime.waitUntil()` works for long AI loops in Supabase Edge Functions (deploy a test function, measure actual uncapped duration)
2. Create DB migration: `async_jobs` + `async_job_progress` tables, RLS policies, enable Realtime on progress table
3. Implement TypeScript types and shared module skeleton (`shared/lib/async-jobs/`)
4. Implement Edge Function `ai-job-worker` with the AI tool loop
5. Implement `useJobProgress` hook (Realtime subscription)
6. Implement `JobProgressPanel` UI component
7. Migrate journey generation as PoC — wire up one API route to use async path
8. Add pg_cron scheduled trigger example
9. GDPR deletion verification
10. Regression test: existing synchronous flows still work
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Technology decision documented and approved before implementation begins
- [ ] #2 Database migration created for job tracking table (following migration numbering convention)
- [ ] #3 TypeScript types defined for job payload, progress events, and job result
- [ ] #4 Shared module `shared/lib/async-jobs/` has barrel export and is importable from anywhere in the codebase
- [ ] #5 Worker runtime identified and configured (Supabase Edge Function or equivalent) with no timeout constraint
- [ ] #6 Progress updates delivered via Supabase Realtime subscriptions (no polling fallback unless Realtime is infeasible)
- [ ] #7 UI component (or hook) for displaying job progress and completion exists under `shared/components/`
- [ ] #8 Owner onboarding journey generation migrated to async job as proof-of-concept — smoke tested end-to-end
- [ ] #9 GDPR: async job records (including stored AI messages) are deleted when user account is deleted
- [ ] #10 No regression in existing synchronous AI flows — short interactions still work without requiring async
<!-- DOD:END -->
