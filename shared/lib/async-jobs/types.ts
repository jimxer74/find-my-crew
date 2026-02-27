/**
 * Async AI Job Infrastructure — Type Definitions
 *
 * Shared types used by both the Next.js side (API routes, React hooks, components)
 * and the Supabase Edge Function worker.
 */

// ============================================================================
// Job lifecycle
// ============================================================================

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type JobTriggeredBy = 'user' | 'scheduler';

/**
 * All supported async job types.
 * Add new job types here as new workflows are migrated to async mode.
 */
export type JobType = 'generate-journey' | 'generate-boat-equipment';

// ============================================================================
// Database row shapes
// ============================================================================

export interface AsyncJob {
  id: string;
  user_id: string | null;
  job_type: JobType;
  status: JobStatus;
  triggered_by: JobTriggeredBy;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobProgress {
  id: string;
  job_id: string;
  step_label: string;
  percent: number | null;
  /** Intermediate AI message content emitted during a tool-loop iteration */
  ai_message: string | null;
  is_final: boolean;
  created_at: string;
}

// ============================================================================
// Client-facing interfaces
// ============================================================================

export interface SubmitJobOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  job_type: JobType;
  payload: T;
}

export interface SubmitJobResult {
  jobId: string;
}

// ============================================================================
// Job-type-specific payloads
// ============================================================================

/** Payload for the 'generate-boat-equipment' job type */
export interface GenerateBoatEquipmentPayload {
  boatId: string;
  makeModel: string;
  boatType: string | null;
  loa_m: number | null;
  yearBuilt: number | null;
  selectedCategories: string[];
  maintenanceCategories: string[];
}

/** Payload for the 'generate-journey' job type */
export interface GenerateJourneyPayload {
  startLocation: { name: string; lat: number; lng: number };
  endLocation: { name: string; lat: number; lng: number };
  intermediateWaypoints?: Array<{ name: string; lat: number; lng: number }>;
  boatId: string;
  startDate?: string;
  endDate?: string;
  useSpeedPlanning?: boolean;
  boatSpeed?: number;
  waypointDensity?: 'minimal' | 'moderate' | 'detailed';
}
