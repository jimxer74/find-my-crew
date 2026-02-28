'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import type { JobProgress } from './types';

/** Poll every 5 s as a fallback when Realtime events are missed. */
const POLL_INTERVAL_MS = 5_000;

/**
 * Subscribe to real-time progress events for an async job.
 * Uses Supabase Realtime (postgres_changes INSERT on async_job_progress) as
 * the primary channel, with 5-second polling as a fallback so that missed
 * Realtime events never leave the progress bar frozen.
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setProgress([]);
      setIsSubscribed(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    function stopPolling() {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    async function fetchProgress() {
      const { data } = await supabase
        .from('async_job_progress')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        setProgress(data as JobProgress[]);
        // Stop polling once we see a final event
        if (data.some((p) => p.is_final)) {
          stopPolling();
        }
      }
    }

    // Fetch any progress rows that were emitted before we subscribed
    fetchProgress();

    // Poll as Realtime fallback
    pollRef.current = setInterval(fetchProgress, POLL_INTERVAL_MS);

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
            const next = exists ? prev : [...prev, payload.new as JobProgress];
            // Stop polling once we see a final event via Realtime
            if ((payload.new as JobProgress).is_final) {
              stopPolling();
            }
            return next;
          });
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsSubscribed(false);
      stopPolling();
    };
  }, [jobId]);

  return { progress, isSubscribed };
}
