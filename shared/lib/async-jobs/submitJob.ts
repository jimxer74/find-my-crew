'use client';

import type { SubmitJobOptions, SubmitJobResult } from './types';

/**
 * Submit an async job and receive a jobId immediately.
 * The job will be executed in the background by the Supabase Edge Function worker.
 * Use useJobProgress() and useJobResult() to track execution.
 */
export async function submitJob<T extends Record<string, unknown>>(
  options: SubmitJobOptions<T>
): Promise<SubmitJobResult> {
  const res = await fetch('/api/async-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to submit async job');
  }

  return { jobId: json.jobId as string };
}
