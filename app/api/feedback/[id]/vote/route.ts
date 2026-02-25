import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { voteFeedback } from '@/app/lib/feedback/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/feedback/[id]/vote
 *
 * Vote on a feedback item.
 *
 * Request body:
 * - vote: 1 (upvote), -1 (downvote), or 0 (remove vote)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { vote } = body;

    // Validate vote value
    if (vote !== 1 && vote !== -1 && vote !== 0) {
      return NextResponse.json(
        { error: 'Vote must be 1 (upvote), -1 (downvote), or 0 (remove vote)' },
        { status: 400 }
      );
    }

    // Submit vote
    const result = await voteFeedback(supabase, id, user.id, vote);

    if (result.error) {
      // Check for specific error messages
      if (result.error.includes('Cannot vote on your own feedback')) {
        return NextResponse.json(
          { error: result.error },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('[Feedback API] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}
