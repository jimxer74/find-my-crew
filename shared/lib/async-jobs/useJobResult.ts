'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import type { AsyncJob } from './types';

/**
 * Subscribe to the final state of an async job.
 * Uses Supabase Realtime (postgres_changes UPDATE on async_jobs).
 * Also fetches the initial state immediately.
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

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // Fetch initial state (job might already be completed by the time we mount)
    supabase
      .from('async_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
      .then(({ data }) => {
        if (data) setJob(data as AsyncJob);
      });

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
          setJob(payload.new as AsyncJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return {
    job,
    isComplete: job?.status === 'completed',
    isFailed: job?.status === 'failed',
  };
}
