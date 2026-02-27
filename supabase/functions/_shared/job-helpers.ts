/**
 * Supabase client + job lifecycle helpers shared by all Edge Function handlers.
 *
 * Uses the service role key so it bypasses RLS — safe inside Edge Functions
 * where ownership is validated before any job is executed.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Supabase client (service role)
// ---------------------------------------------------------------------------

export const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// ---------------------------------------------------------------------------
// Progress events — INSERT a row; Realtime pushes it to the client
// ---------------------------------------------------------------------------

export async function emitProgress(
  jobId: string,
  stepLabel: string,
  percent?: number,
  aiMessage?: string,
  isFinal = false,
): Promise<void> {
  const { error } = await supabase.from('async_job_progress').insert({
    job_id: jobId,
    step_label: stepLabel,
    percent: percent ?? null,
    ai_message: aiMessage ?? null,
    is_final: isFinal,
  });
  if (error) {
    console.error(`[job-helpers] emitProgress failed for job ${jobId}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// Job status transitions
// ---------------------------------------------------------------------------

export async function markRunning(jobId: string): Promise<void> {
  await supabase
    .from('async_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId);
}

export async function markCompleted(
  jobId: string,
  result: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from('async_jobs')
    .update({ status: 'completed', result, completed_at: new Date().toISOString() })
    .eq('id', jobId);
}

export async function markFailed(jobId: string, error: string): Promise<void> {
  await supabase
    .from('async_jobs')
    .update({ status: 'failed', error, completed_at: new Date().toISOString() })
    .eq('id', jobId);
  // Emit a final progress event so the client's progress panel closes cleanly
  await emitProgress(jobId, 'Failed', 100, undefined, true);
}
