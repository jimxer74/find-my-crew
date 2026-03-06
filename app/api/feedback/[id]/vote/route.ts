import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { toggleFeedbackVote } from '@shared/lib/feedback/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/feedback/[id]/vote
 *
 * Toggles an upvote on a feedback item.
 * Returns the new upvote count and whether the current user has voted.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await toggleFeedbackVote(supabase, id);

    if (result.error) {
      const status = result.error.includes('Cannot vote on your own feedback') ? 403 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ upvotes: result.upvotes, user_voted: result.user_voted });
  } catch (error: unknown) {
    logger.error('[Feedback API] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Request failed'), { status: 500 });
  }
}
