---
id: TASK-135
title: Async AI agents
status: To Do
assignee: []
created_date: '2026-02-26 08:19'
updated_date: '2026-02-26 08:22'
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

Create a shared infrastructure capability that enables long-running AI agentic workflows to execute in the background, bypassing serverless function timeout limits. Workflows can be triggered either by the user explicitly or by a scheduler. The user must be able to track progress in real time and know when a workflow has completed.

This is a foundational piece of infrastructure — once built it should be reusable for any AI workflow in the platform (owner onboarding, journey generation, crew matching analysis, etc.).

---

## Why This Is Needed

### The Timeout Problem (doc-010)

Vercel Pro plan hard-caps serverless function execution at **60 seconds**. The current AI chat endpoints already hit this limit:

- Owner chat: `app/api/ai/owner/chat/route.ts` — `maxDuration = 60`
- Prospect chat: `app/api/ai/prospect/chat/route.ts` — `maxDuration = 60`

A full owner onboarding session can take **85+ seconds**:
- Initial AI greeting: ~15s
- Profile creation (AI + tool + DB): ~10s
- Boat suggestions (AI response): ~15s
- Boat creation (tool + DB): ~15s
- Journey generation (AI reasoning + RPC + geocoding): ~30s

The inner tool loop in `app/lib/ai/owner/service.ts` allows up to `MAX_TOOL_ITERATIONS = 10` iterations, each making an AI call and executing tools (DB inserts, web scraping, RPC). No amount of optimisation fully solves this for complex flows.

### The Intermediate Messages Problem (doc-012)

The current synchronous tool loop discards intermediate AI messages — the reasoning the AI produces *before* executing a tool call is never returned to the user. Async architecture naturally solves this: each iteration's output can be streamed/pushed to the client as it completes.

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

## Technology Options to Evaluate

### Option A — Supabase-Native (Preferred starting point)

Use Supabase's own primitives:
- **pg_cron** — for scheduled/recurring job triggering
- **Supabase Realtime** — push progress updates to the client via websocket subscriptions (already available in client, zero new infrastructure)
- **Database job table** — persist job state (`pending`, `running`, `completed`, `failed`) and progress log

**Pros:** No new services, same auth/RLS model, Realtime already integrated, pg_cron available on Pro+  
**Cons:** pg_cron limited to cron-syntax triggers (not event-driven); workers need a runner (Edge Functions or external service)

### Option B — Inngest

Event-driven background job platform purpose-built for Vercel/Next.js serverless. Functions registered as Inngest steps, each step has its own timeout, and steps can chain indefinitely.

**Pros:** First-class Vercel integration, per-step timeouts (not per-function), built-in retries, scheduling, progress events, excellent DX  
**Cons:** New external dependency, cost scales with invocations, adds operational surface

### Option C — QStash (Upstash)

HTTP message queue. POST a message → QStash delivers it to a Next.js API route as a webhook, retrying on failure. Use Supabase Realtime or polling for progress.

**Pros:** Very simple, serverless-native, works with existing Next.js routes  
**Cons:** Delivery is fire-and-forget; progress tracking requires additional work

### Option D — Vercel Cron + Supabase job table

Use Vercel's built-in cron to poll a jobs table, execute pending jobs (one per cron tick). Progress stored in DB, client polls or uses Realtime.

**Pros:** No new services beyond Supabase  
**Cons:** Cron minimum interval is 1 minute (too slow for user-triggered tasks); not event-driven

### Not Recommended

- Vercel Enterprise upgrade (just for longer timeouts): cost-prohibitive, doesn't add progress tracking
- BullMQ + Redis: Redis adds cost and ops overhead when Supabase already covers the same

---

## Required Capabilities (what to build)

Regardless of technology choice, the shared capability must provide:

1. **Job submission** — any part of the codebase can enqueue an async AI job (passing a typed payload)
2. **Job execution** — the worker receives the payload, runs the AI loop (no timeout limit), persists output
3. **Progress emission** — worker emits discrete progress events as each tool iteration completes (e.g., `{step: "Generating journey", percent: 60}`)
4. **Progress subscription** — client subscribes to progress for a given job ID (via Supabase Realtime or polling)
5. **Completion notification** — client is notified when the job is done and the result is available
6. **Scheduled trigger** — a workflow can also be queued by a cron/scheduler (not only by user action)
7. **Shared module** — the capability lives under `shared/` (e.g., `shared/lib/async-jobs/`) so any part of the platform can use it

---

## Relationship to doc-012 (Intermediate Messages)

Implementing async jobs also enables intermediate message display. Each tool-loop iteration can emit its intermediate AI message as a progress event, and the client can render them incrementally — solving the doc-012 problem as a natural byproduct without a separate API-contract change.

---

## Suggested Investigation Order

1. Assess whether Supabase Edge Functions can serve as the worker runtime (removes Vercel timeout entirely)
2. Evaluate Inngest as the orchestration layer (event dispatch + step chaining + scheduling)
3. Decide on progress transport (Supabase Realtime preferred — already in use)
4. Design the shared job schema (DB table, TypeScript types)
5. Prototype with one existing workflow (owner onboarding journey generation — the slowest step)
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

- Vercel Pro plan: 60-second hard limit on serverless functions — cannot be raised without Enterprise
- Supabase Realtime is already integrated in the client (`getSupabaseBrowserClient`) — use it for progress rather than polling
- All new DB tables must follow `/migrations/` numbering and update `/specs/tables.sql`
- GDPR deletion logic must cover any new tables storing user/AI data

## Recommended First Step

Before any code, produce a short technology decision document (can be a new backlog doc) that evaluates Options A–D above and picks the approach. The implementation should not start until that decision is made.
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
