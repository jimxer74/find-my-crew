'use client';

import { useEffect, useRef, useState } from 'react';
import { useJobProgress } from '@shared/lib/async-jobs/useJobProgress';
import { useJobResult } from '@shared/lib/async-jobs/useJobResult';

/** After this many ms with no progress and no terminal state, show a "failed to start" message. */
const WORKER_START_TIMEOUT_MS = 60_000;

interface JobProgressPanelProps {
  jobId: string;
  onComplete?: (result: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

/**
 * Displays real-time progress for an async background AI job.
 * Subscribes to Supabase Realtime for live progress updates, with a polling
 * fallback every 5 s so missed Realtime events never leave the UI frozen.
 * Calls onComplete/onError when the job finishes.
 */
export function JobProgressPanel({ jobId, onComplete, onError }: JobProgressPanelProps) {
  const { progress } = useJobProgress(jobId);
  const { job, isComplete, isFailed } = useJobResult(jobId);

  // Show a helpful message if the worker never picks up the job
  const [workerTimedOut, setWorkerTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing timeout when state changes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Once we have progress or a terminal state, timeout is no longer needed
    if (progress.length > 0 || isComplete || isFailed) {
      setWorkerTimedOut(false);
      return;
    }

    // Start a fresh timeout while we're still waiting
    timeoutRef.current = setTimeout(() => {
      setWorkerTimedOut(true);
    }, WORKER_START_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [progress.length, isComplete, isFailed]);

  useEffect(() => {
    if (isComplete && job?.result) {
      onComplete?.(job.result as Record<string, unknown>);
    }
  }, [isComplete, job?.result, onComplete]);

  useEffect(() => {
    if (isFailed && job?.error) {
      onError?.(job.error);
    }
  }, [isFailed, job?.error, onError]);

  const latest = progress[progress.length - 1];
  const percent = latest?.percent ?? 0;
  const statusLabel = isFailed
    ? 'Failed'
    : isComplete
    ? 'Complete'
    : latest?.step_label ?? 'Starting…';

  return (
    <div className="space-y-4">
      {/* Status + percentage */}
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${isFailed ? 'text-destructive' : 'text-foreground'}`}>
          {statusLabel}
        </span>
        {!isFailed && (
          <span className="text-muted-foreground tabular-nums">{percent}%</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFailed
              ? 'bg-destructive'
              : isComplete
              ? 'bg-green-500'
              : 'bg-primary'
          }`}
          style={{ width: `${isFailed ? 100 : percent}%` }}
        />
      </div>

      {/* Step history */}
      {progress.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {progress.map((p) => (
            <div key={p.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                    p.is_final && !isFailed
                      ? 'bg-green-500 border-green-500'
                      : 'border-muted-foreground'
                  }`}
                />
                <span className="text-foreground">{p.step_label}</span>
                {p.percent !== null && (
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {p.percent}%
                  </span>
                )}
              </div>
              {p.ai_message && (
                <p className="ml-6 mt-1 text-xs text-muted-foreground line-clamp-3">
                  {p.ai_message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state while waiting for first event */}
      {progress.length === 0 && !isFailed && !workerTimedOut && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span>Waiting for worker to start…</span>
        </div>
      )}

      {/* Worker never started (60 s timeout) */}
      {progress.length === 0 && !isFailed && workerTimedOut && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          The background worker did not start. The Edge Function may not be deployed or reachable.
          Please try again or check server logs.
        </p>
      )}

      {isFailed && job?.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {job.error}
        </p>
      )}
    </div>
  );
}
