import { NextRequest, NextResponse } from 'next/server';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { createFeedback, getFeedbackList } from '@/app/lib/feedback/service';
import { FeedbackType, FeedbackStatus, isFeedbackType, isFeedbackStatus } from '@/app/lib/feedback/types';

/**
 * GET /api/feedback
 *
 * Fetches public feedback with filtering, sorting, and pagination.
 *
 * Query parameters:
 * - type: Filter by feedback type (bug, feature, improvement, other)
 * - status: Filter by status (new, under_review, planned, in_progress, completed, declined)
 * - sort: Sort order (newest, oldest, most_votes, least_votes)
 * - search: Search in title and description
 * - page: Page number (default: 1)
 * - limit: Number of items per page (default: 20, max: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // Get authenticated user (optional for viewing public feedback)
    const { data: { user } } = await supabase.auth.getUser();

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const typeParam = searchParams.get('type');
    const statusParam = searchParams.get('status');
    const sort = searchParams.get('sort') as 'newest' | 'oldest' | 'most_votes' | 'least_votes' | null;
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Validate type and status
    const type = typeParam && isFeedbackType(typeParam) ? typeParam as FeedbackType : undefined;
    const status = statusParam && isFeedbackStatus(statusParam) ? statusParam as FeedbackStatus : undefined;

    // Fetch feedback
    const result = await getFeedbackList(
      supabase,
      {
        type,
        status,
        sort: sort || 'newest',
        search: search || undefined,
        page,
        limit,
      },
      user?.id
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('[Feedback API] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/feedback
 *
 * Creates new feedback.
 *
 * Request body:
 * - type: Feedback type (required)
 * - title: Feedback title (required)
 * - description: Feedback description (optional)
 * - is_anonymous: Submit anonymously (optional, default: false)
 * - context_page: Page where feedback was submitted (optional)
 * - context_metadata: Additional context data (optional)
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
    const { type, title, description, is_anonymous, context_page, context_metadata } = body;

    // Validate required fields
    if (!type || !isFeedbackType(type)) {
      return NextResponse.json(
        { error: 'Invalid or missing feedback type' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Create feedback
    const result = await createFeedback(supabase, user.id, {
      type: type as FeedbackType,
      title: title.trim(),
      description: description?.trim() || undefined,
      is_anonymous: is_anonymous || false,
      context_page: context_page || undefined,
      context_metadata: context_metadata || undefined,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result.feedback, { status: 201 });
  } catch (error: unknown) {
    logger.error('[Feedback API] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
