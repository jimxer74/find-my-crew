import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { logger } from '@shared/logging';

type RouteParams = { params: Promise<{ jobId: string }> };

/**
 * GET /api/async-jobs/[jobId]
 * Fetch the current status and result of an async job.
 * Intended as a polling fallback if Realtime is unavailable.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: job, error } = await supabase
      .from('async_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id) // enforce ownership
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Optionally include the latest progress rows
    const { data: progress } = await supabase
      .from('async_job_progress')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    return NextResponse.json({ job, progress: progress ?? [] });
  } catch (error) {
    logger.error('[async-jobs] Failed to fetch job', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
