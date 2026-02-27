'use client';

import { useEffect } from 'react';
import { useJobProgress } from '@shared/lib/async-jobs/useJobProgress';
import { useJobResult } from '@shared/lib/async-jobs/useJobResult';

interface JobProgressPanelProps {
  jobId: string;
  onComplete?: (result: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

/**
 * Displays real-time progress for an async background AI job.
 * Subscribes to Supabase Realtime for live progress updates.
 * Calls onComplete/onError when the job finishes.
 */
export function JobProgressPanel({ jobId, onComplete, onError }: JobProgressPanelProps) {
  const { progress } = useJobProgress(jobId);
  const { job, isComplete, isFailed } = useJobResult(jobId);

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
      {progress.length === 0 && !isFailed && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span>Waiting for worker to start…</span>
        </div>
      )}

      {isFailed && job?.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {job.error}
        </p>
      )}
    </div>
  );
}
