/**
 * Job handler registry.
 *
 * Maps job_type strings (stored in async_jobs.job_type) to their handlers.
 *
 * HOW TO ADD A NEW USE CASE:
 *   1. Create  handlers/<your-use-case>.ts  (export a `handler` object)
 *   2. Import it below and add one line to the registry object
 *   3. Add the new job_type to JobType in shared/lib/async-jobs/types.ts
 *   4. Redeploy:  supabase functions deploy ai-job-worker
 *
 * That's it — the dispatcher (index.ts) needs no changes.
 */

import type { HandlerRegistry } from '../_shared/types.ts';
import { handler as generateJourney } from './handlers/generate-journey.ts';
import { handler as generateBoatEquipment } from './handlers/generate-boat-equipment.ts';

// ---------------------------------------------------------------------------
// Registry — one entry per supported job type
// ---------------------------------------------------------------------------

export const registry: HandlerRegistry = {
  'generate-journey': generateJourney,
  'generate-boat-equipment': generateBoatEquipment,

  // Add future use cases here, e.g.:
  // 'analyse-crew-match':      analyseCrewMatch,
  // 'generate-leg-briefing':   generateLegBriefing,
  // 'assess-registration':     assessRegistration,
  // 'suggest-boat-upgrade':    suggestBoatUpgrade,
};
