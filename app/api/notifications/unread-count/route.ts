import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { getUnreadCount } from '@/app/lib/notifications';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';

/**
 * GET /api/notifications/unread-count
 *
 * Returns the count of unread notifications for the authenticated user.
 */
export async function GET() {
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

    // Get unread count
    const count = await getUnreadCount(supabase, user.id);

    return NextResponse.json({ count });
  } catch (error: any) {
    logger.error('[Notifications API] Unexpected error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
