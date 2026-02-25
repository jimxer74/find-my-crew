import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { markAllAsRead } from '@/app/lib/notifications';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';

/**
 * POST /api/notifications/mark-all-read
 *
 * Marks all notifications as read for the authenticated user.
 */
export async function POST() {
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

    // Mark all as read
    const result = await markAllAsRead(supabase, user.id);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Marked ${result.count} notifications as read`,
    });
  } catch (error: any) {
    logger.error('[Notifications API] Unexpected error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
