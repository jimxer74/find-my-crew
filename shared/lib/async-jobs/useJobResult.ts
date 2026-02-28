'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import type { AsyncJob } from './types';

/** Poll every 5 s as a fallback when Realtime events are missed. */
const POLL_INTERVAL_MS = 5_000;

/**
 * Subscribe to the final state of an async job.
 * Uses Supabase Realtime (postgres_changes UPDATE on async_jobs) as the
 * primary channel, with 5-second polling as a fallback so that missed
 * Realtime events never leave the UI stuck indefinitely.
 *
 * @param jobId - The job ID to watch, or null if no job yet.
 * @returns { job, isComplete, isFailed }
 */
export function useJobResult(jobId: string | null): {
  job: AsyncJob | null;
  isComplete: boolean;
  isFailed: boolean;
} {
  const [job, setJob] = useState<AsyncJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    function stopPolling() {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    async function fetchJob() {
      const { data } = await supabase
        .from('async_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (data) {
        setJob(data as AsyncJob);
        // Stop polling once the job reaches a terminal state
        if (data.status === 'completed' || data.status === 'failed') {
          stopPolling();
        }
      }
    }

    // Fetch immediately (job may already be done by the time we mount)
    fetchJob();

    // Poll as Realtime fallback
    pollRef.current = setInterval(fetchJob, POLL_INTERVAL_MS);

    const channel = supabase
      .channel(`job-status-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'async_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const updated = payload.new as AsyncJob;
          setJob(updated);
          // If Realtime delivers a terminal state, stop the poll
          if (updated.status === 'completed' || updated.status === 'failed') {
            stopPolling();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopPolling();
    };
  }, [jobId]);

  return {
    job,
    isComplete: job?.status === 'completed',
    isFailed: job?.status === 'failed',
  };
}
