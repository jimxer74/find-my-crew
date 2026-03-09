import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * PUT /api/legs/[legId]/comments/[commentId]
 *
 * Updates content of own comment.
 * Body: { content: string }
 * Requires auth; only own comments.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ legId: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;
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

    const { data: comment, error } = await supabase
      .from('leg_comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', user.id) // RLS also enforces this
      .select('id, content, user_id, created_at, updated_at')
      .single();

    if (error || !comment) {
      return NextResponse.json(sanitizeErrorResponse(error, 'Comment not found or not authorized'), { status: 404 });
    }

    return NextResponse.json({ comment: { ...comment, is_own: true } });
  } catch (error: any) {
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}

/**
 * DELETE /api/legs/[legId]/comments/[commentId]
 *
 * Deletes a comment. Allowed for comment author or journey owner (enforced via RLS policy).
 * Requires auth.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ legId: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('leg_comments')
      .delete()
      .eq('id', commentId);
    // RLS policy allows deletion for own comment OR journey owner

    if (error) {
      return NextResponse.json(sanitizeErrorResponse(error, 'Failed to delete comment'), { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}
