import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { getUserFeedback } from '@/app/lib/feedback/service';

/**
 * GET /api/feedback/my
 *
 * Fetches feedback submitted by the authenticated user.
 *
 * Query parameters:
 * - sort: Sort order (newest, oldest, most_votes)
 * - page: Page number (default: 1)
 * - limit: Number of items per page (default: 20, max: 50)
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const sort = searchParams.get('sort') as 'newest' | 'oldest' | 'most_votes' | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Fetch user's feedback
    const result = await getUserFeedback(supabase, user.id, {
      sort: sort || 'newest',
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[Feedback API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
