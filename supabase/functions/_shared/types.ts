/**
 * Shared types for Supabase Edge Function job handlers.
 * All job handlers must implement the JobHandler interface.
 */

// ---------------------------------------------------------------------------
// Handler context — injected into every handler's run() call
// ---------------------------------------------------------------------------

export interface HandlerContext {
  /**
   * Emit a progress event for the job.
   * Clients receive this via Supabase Realtime in real time.
   */
  emitProgress(
    jobId: string,
    stepLabel: string,
    percent?: number,
    aiMessage?: string,
    isFinal?: boolean,
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Job handler — every use case exports one of these
// ---------------------------------------------------------------------------

export interface JobHandler {
  /**
   * Execute the job and return the result payload.
   * The dispatcher calls this; it must not call markCompleted/markFailed itself.
   * Throw an Error to signal failure — the dispatcher handles markFailed.
   */
  run(
    jobId: string,
    payload: Record<string, unknown>,
    ctx: HandlerContext,
  ): Promise<Record<string, unknown>>;
}

export type HandlerRegistry = Record<string, JobHandler>;
