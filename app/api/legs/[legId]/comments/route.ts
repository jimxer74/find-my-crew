import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * GET /api/legs/[legId]/comments
 *
 * Returns paginated comments for a leg, joined with author profile data.
 * Query params: cursor (comment id for pagination), limit (default 20)
 * Public access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ legId: string }> }
) {
  try {
    const { legId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
    const cursor = searchParams.get('cursor');

    let query = supabase
      .from('leg_comments')
      .select('id, content, user_id, created_at, updated_at')
      .eq('leg_id', legId)
      .order('created_at', { ascending: true })
      .limit(limit + 1); // fetch one extra to determine has_more

    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    const { data: comments, error } = await query;

    if (error) {
      return NextResponse.json(sanitizeErrorResponse(error, 'Failed to fetch comments'), { status: 500 });
    }

    const hasMore = (comments?.length ?? 0) > limit;
    const pageComments = hasMore ? comments!.slice(0, limit) : (comments ?? []);

    // Fetch author profiles
    const userIds = [...new Set(pageComments.map((c) => c.user_id))];
    let profilesMap: Record<string, { full_name: string | null; profile_image_url: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, profile_image_url')
        .in('id', userIds);

      if (profiles) {
        for (const p of profiles) {
          profilesMap[p.id] = { full_name: p.full_name, profile_image_url: p.profile_image_url };
        }
      }
    }

    const enrichedComments = pageComments.map((c) => ({
      id: c.id,
      content: c.content,
      user_id: c.user_id,
      author_name: profilesMap[c.user_id]?.full_name ?? 'Unknown',
      author_image_url: profilesMap[c.user_id]?.profile_image_url ?? null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      is_own: user?.id === c.user_id,
    }));

    return NextResponse.json({ comments: enrichedComments, has_more: hasMore });
  } catch (error: any) {
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}

/**
 * POST /api/legs/[legId]/comments
 *
 * Posts a new comment on a leg.
 * Body: { content: string }
 * Requires auth; checks journey.comments_enabled.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ legId: string }> }
) {
  try {
    const { legId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > 2000) {
      return NextResponse.json({ error: 'Content must be between 1 and 2000 characters' }, { status: 400 });
    }

    // Check comments_enabled on the journey
    const { data: leg } = await supabase
      .from('legs')
      .select('journey_id, journeys!inner(comments_enabled)')
      .eq('id', legId)
      .single();

    const commentsEnabled = (leg?.journeys as any)?.comments_enabled ?? true;
    if (!commentsEnabled) {
      return NextResponse.json({ error: 'Commenting is disabled for this journey' }, { status: 403 });
    }

    const { data: comment, error } = await supabase
      .from('leg_comments')
      .insert({ leg_id: legId, user_id: user.id, content })
      .select('id, content, user_id, created_at, updated_at')
      .single();

    if (error || !comment) {
      return NextResponse.json(sanitizeErrorResponse(error, 'Failed to post comment'), { status: 500 });
    }

    // Fetch author profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, profile_image_url')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        user_id: comment.user_id,
        author_name: profile?.full_name ?? 'Unknown',
        author_image_url: profile?.profile_image_url ?? null,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        is_own: true,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}
