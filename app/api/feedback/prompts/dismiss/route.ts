import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { dismissPrompt } from '@/app/lib/feedback/service';

/**
 * POST /api/feedback/prompts/dismiss
 *
 * Dismisses a feedback prompt.
 *
 * Request body:
 * - prompt_type: Type of prompt to dismiss (required)
 * - dismiss_days: Number of days to dismiss for (optional, null = forever)
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { prompt_type, dismiss_days } = body;

    // Validate prompt_type
    if (!prompt_type || typeof prompt_type !== 'string') {
      return NextResponse.json(
        { error: 'prompt_type is required' },
        { status: 400 }
      );
    }

    // Validate dismiss_days if provided
    if (dismiss_days !== undefined && dismiss_days !== null) {
      if (typeof dismiss_days !== 'number' || dismiss_days < 0) {
        return NextResponse.json(
          { error: 'dismiss_days must be a positive number or null' },
          { status: 400 }
        );
      }
    }

    // Dismiss prompt
    const result = await dismissPrompt(supabase, user.id, {
      prompt_type,
      dismiss_days: dismiss_days ?? undefined,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[Feedback API] Unexpected error:', error);
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}
