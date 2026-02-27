'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import type { JobProgress } from './types';

/**
 * Subscribe to real-time progress events for an async job.
 * Uses Supabase Realtime (postgres_changes INSERT on async_job_progress).
 *
 * @param jobId - The job ID to subscribe to, or null if no job yet.
 * @returns { progress, isSubscribed }
 */
export function useJobProgress(jobId: string | null): {
  progress: JobProgress[];
  isSubscribed: boolean;
} {
  const [progress, setProgress] = useState<JobProgress[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setProgress([]);
      setIsSubscribed(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // Fetch any progress rows that were emitted before we subscribed
    supabase
      .from('async_job_progress')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setProgress(data as JobProgress[]);
        }
      });

    const channel = supabase
      .channel(`job-progress-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'async_job_progress',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          setProgress((prev) => {
            // Deduplicate by id in case of replay
            const exists = prev.some((p) => p.id === payload.new.id);
            return exists ? prev : [...prev, payload.new as JobProgress];
          });
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [jobId]);

  return { progress, isSubscribed };
}
