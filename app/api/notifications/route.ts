import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { getNotifications } from '@/app/lib/notifications';

/**
 * GET /api/notifications
 *
 * Fetches notifications for the authenticated user with pagination.
 *
 * Query parameters:
 * - limit: Number of notifications to return (default: 20, max: 100)
 * - offset: Number of notifications to skip (default: 0)
 * - unread_only: If "true", only return unread notifications
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const unreadOnly = searchParams.get('unread_only') === 'true';

    // Fetch notifications
    const result = await getNotifications(supabase, user.id, {
      limit,
      offset,
      unread_only: unreadOnly,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Notifications API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
