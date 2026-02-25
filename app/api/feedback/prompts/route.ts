import { NextRequest, NextResponse } from 'next/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { getSupabaseServerClient } from '@shared/database/server';
import { getPromptStatus } from '@shared/lib/feedback/service';

/**
 * GET /api/feedback/prompts
 *
 * Checks which feedback prompts should be shown to the user.
 *
 * Returns:
 * - showPostJourneyPrompt: Whether to show post-journey feedback prompt
 * - showGeneralPrompt: Whether to show general feedback prompt
 * - showEngagementPrompt: Whether to show engagement milestone prompt
 * - postJourneyContext: Context for post-journey prompt (if applicable)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get prompt status
    const result = await getPromptStatus(supabase, user.id);

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('[Feedback API] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
