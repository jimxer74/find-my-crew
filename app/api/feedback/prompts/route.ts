import { NextRequest, NextResponse } from 'next/server';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { getPromptStatus } from '@/app/lib/feedback/service';

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
    console.error('[Feedback API] Unexpected error:', error);
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
