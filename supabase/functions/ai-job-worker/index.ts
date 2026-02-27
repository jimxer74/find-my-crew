/**
 * Supabase Edge Function: ai-job-worker
 *
 * Generic dispatcher for async AI background jobs.
 * Responds 202 immediately; actual work runs via EdgeRuntime.waitUntil()
 * so there is no timeout — jobs run to completion regardless of duration.
 *
 * ─────────────────────────────────────────
 * TO ADD A NEW USE CASE:
 *   1. Create  handlers/<use-case>.ts
 *   2. Add one line to  _registry.ts
 *   3. Redeploy this function
 *   — Do NOT modify this file —
 * ─────────────────────────────────────────
 *
 * Environment variables (auto-injected by Supabase):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Secret (set via: supabase secrets set OPENROUTER_API_KEY=sk-or-...):
 *   OPENROUTER_API_KEY
 */

import { supabase, emitProgress, markRunning, markCompleted, markFailed } from '../_shared/job-helpers.ts';
import { registry } from './_registry.ts';
import type { HandlerContext } from '../_shared/types.ts';

// ---------------------------------------------------------------------------
// HandlerContext — injected into every handler's run() call
// ---------------------------------------------------------------------------

const ctx: HandlerContext = { emitProgress };

// ---------------------------------------------------------------------------
// Job dispatcher
// ---------------------------------------------------------------------------

async function runJob(jobId: string): Promise<void> {
  const { data: job, error } = await supabase
    .from('async_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    console.error(`[ai-job-worker] Job not found: ${jobId}`);
    return;
  }

  if (job.status !== 'pending') {
    console.warn(`[ai-job-worker] Job ${jobId} is already ${job.status}, skipping`);
    return;
  }

  await markRunning(jobId);

  const handler = registry[job.job_type];
  if (!handler) {
    await markFailed(jobId, `Unknown job type: "${job.job_type}". Register it in _registry.ts.`);
    return;
  }

  try {
    const result = await handler.run(jobId, job.payload as Record<string, unknown>, ctx);
    await markCompleted(jobId, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-job-worker] Job ${jobId} (${job.job_type}) failed:`, message);
    await markFailed(jobId, message);
  }
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let jobId: string;
  try {
    const body = await req.json();
    jobId = body.jobId;
    if (!jobId) throw new Error('jobId is required');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Respond 202 immediately — job runs to completion in the background
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(runJob(jobId));

  return new Response(JSON.stringify({ accepted: true, jobId }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
});
