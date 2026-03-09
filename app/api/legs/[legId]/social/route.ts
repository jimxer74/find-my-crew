import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * GET /api/legs/[legId]/social
 *
 * Returns social metadata for a leg: likes count, whether the current user has liked it,
 * comments_enabled flag from the journey, and comment count.
 * Public access; user_has_liked is false for unauthenticated users.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ legId: string }> }
) {
  try {
    const { legId } = await params;
    const supabase = await getSupabaseServerClient();

    // Get current user (optional – no error if unauthenticated)
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch likes count and user_has_liked in parallel with journey comments_enabled + comment count
    const [likesResult, journeyResult, commentCountResult, userLikeResult] = await Promise.all([
      supabase
        .from('leg_likes')
        .select('*', { count: 'exact', head: true })
        .eq('leg_id', legId),

      supabase
        .from('legs')
        .select('journey_id, journeys!inner(comments_enabled)')
        .eq('id', legId)
        .single(),

      supabase
        .from('leg_comments')
        .select('*', { count: 'exact', head: true })
        .eq('leg_id', legId),

      user
        ? supabase
            .from('leg_likes')
            .select('id')
            .eq('leg_id', legId)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const likesCount = likesResult.count ?? 0;
    const commentsCount = commentCountResult.count ?? 0;
    const commentsEnabled = (journeyResult.data?.journeys as any)?.comments_enabled ?? true;
    const userHasLiked = !!userLikeResult.data;

    return NextResponse.json({
      likes_count: likesCount,
      user_has_liked: userHasLiked,
      comments_enabled: commentsEnabled,
      comments_count: commentsCount,
    });
  } catch (error: any) {
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}
