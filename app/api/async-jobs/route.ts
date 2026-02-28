import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { logger } from '@shared/logging';
import type { JobType } from '@shared/lib/async-jobs';

const VALID_JOB_TYPES: JobType[] = ['generate-journey', 'generate-boat-equipment', 'generate-equipment-maintenance'];

/**
 * POST /api/async-jobs
 * Create an async job record and trigger the Edge Function worker.
 * Returns { jobId } immediately — the actual work runs in the background.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { job_type, payload } = body;

    if (!VALID_JOB_TYPES.includes(job_type)) {
      return NextResponse.json(
        { error: `Invalid job_type. Valid types: ${VALID_JOB_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'payload must be an object' }, { status: 400 });
    }

    // Create the job record
    const { data: job, error: insertError } = await supabase
      .from('async_jobs')
      .insert({
        user_id: user.id,
        job_type,
        status: 'pending',
        triggered_by: 'user',
        payload,
      })
      .select('id')
      .single();

    if (insertError || !job) {
      logger.error('[async-jobs] Failed to create job', { error: insertError?.message });
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    logger.debug('[async-jobs] Job created', { jobId: job.id, job_type, userId: user.id });

    // Trigger the Edge Function (fire-and-forget — do not await)
    const workerUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-job-worker`;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (workerUrl && serviceRoleKey) {
      fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: job.id }),
      }).catch((err) => {
        logger.error('[async-jobs] Failed to trigger worker', {
          jobId: job.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } else {
      logger.warn('[async-jobs] Worker URL or service role key not configured — job queued but not started', {
        jobId: job.id,
      });
    }

    return NextResponse.json({ jobId: job.id }, { status: 201 });
  } catch (error) {
    logger.error('[async-jobs] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
