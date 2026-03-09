import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * POST /api/legs/[legId]/like
 *
 * Toggles the authenticated user's like on a leg.
 * Returns { liked: boolean, likes_count: number }.
 * Requires authentication.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ legId: string }> }
) {
  try {
    const { legId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if already liked
    const { data: existing } = await supabase
      .from('leg_likes')
      .select('id')
      .eq('leg_id', legId)
      .eq('user_id', user.id)
      .maybeSingle();

    let liked: boolean;
    if (existing) {
      // Unlike
      await supabase
        .from('leg_likes')
        .delete()
        .eq('leg_id', legId)
        .eq('user_id', user.id);
      liked = false;
    } else {
      // Like
      await supabase
        .from('leg_likes')
        .insert({ leg_id: legId, user_id: user.id });
      liked = true;
    }

    // Get updated count
    const { count } = await supabase
      .from('leg_likes')
      .select('*', { count: 'exact', head: true })
      .eq('leg_id', legId);

    return NextResponse.json({ liked, likes_count: count ?? 0 });
  } catch (error: any) {
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}
