import { NextRequest, NextResponse } from 'next/server';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { getFeedbackById, updateFeedback, deleteFeedback } from '@/app/lib/feedback/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/feedback/[id]
 *
 * Fetches a single feedback item by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    // Get authenticated user (optional)
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch feedback
    const result = await getFeedbackById(supabase, id, user?.id);

    if (result.error || !result.feedback) {
      return NextResponse.json(
        { error: result.error || 'Feedback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.feedback);
  } catch (error: unknown) {
    logger.error('[Feedback API] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/feedback/[id]
 *
 * Updates a feedback item. Only the owner can update their feedback.
 *
 * Request body:
 * - title: New title (optional)
 * - description: New description (optional)
 * - is_public: Visibility (optional)
 * - is_anonymous: Anonymous flag (optional)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const { title, description, is_public, is_anonymous } = body;

    // Validate title if provided
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title cannot be empty' },
          { status: 400 }
        );
      }
      if (title.length > 200) {
        return NextResponse.json(
          { error: 'Title must be 200 characters or less' },
          { status: 400 }
        );
      }
    }

    // Update feedback
    const result = await updateFeedback(supabase, id, user.id, {
      title: title?.trim(),
      description: description?.trim(),
      is_public,
      is_anonymous,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    if (!result.feedback) {
      return NextResponse.json(
        { error: 'Feedback not found or you do not have permission to update it' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.feedback);
  } catch (error: unknown) {
    logger.error('[Feedback API] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feedback/[id]
 *
 * Deletes a feedback item. Only the owner can delete their feedback.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Delete feedback
    const result = await deleteFeedback(supabase, id, user.id);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('[Feedback API] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
