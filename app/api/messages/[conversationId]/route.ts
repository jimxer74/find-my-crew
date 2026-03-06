import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * GET /api/messages/[conversationId]
 *
 * Returns messages for a conversation (paginated, newest first).
 * Only the two participants can access it.
 *
 * PATCH /api/messages/[conversationId]
 *
 * Close the conversation. Either participant can close it.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { conversationId } = resolvedParams;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const before = searchParams.get('before'); // ISO date string for cursor pagination

    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify participant access
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id, participant_1_id, participant_2_id, status, registration_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conv.participant_1_id !== user.id && conv.participant_2_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch messages
    let query = supabase
      .from('conversation_messages')
      .select('id, sender_id, content, attachments, read_by, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error: msgError } = await query;

    if (msgError) {
      logger.error('[MessagesAPI] Failed to fetch messages:', { error: msgError.message });
      return NextResponse.json(
        sanitizeErrorResponse(msgError, 'Failed to fetch messages'),
        { status: 500 }
      );
    }

    // Fetch other participant's profile
    const otherId = conv.participant_1_id === user.id ? conv.participant_2_id : conv.participant_1_id;
    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('id, full_name, username, profile_image_url')
      .eq('id', otherId)
      .single();

    // Mark unread messages from other participant as read (fire and forget)
    const unreadIds = (messages ?? [])
      .filter((m) => m.sender_id !== user.id && !(m.read_by as string[])?.includes(user.id))
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      supabase
        .rpc('mark_messages_read', { p_message_ids: unreadIds, p_user_id: user.id })
        .then(({ error }) => {
          if (error) logger.warn('[MessagesAPI] Failed to mark messages read:', { error: error.message });
        });
    }

    return NextResponse.json({
      conversation: {
        id: conv.id,
        status: conv.status,
        registration_id: conv.registration_id,
        other_participant: otherProfile ?? { id: otherId, full_name: null, username: null, profile_image_url: null },
      },
      messages: (messages ?? []).reverse(), // Return oldest first for display
      has_more: (messages?.length ?? 0) === limit,
    });
  } catch (error: any) {
    logger.error('[MessagesAPI] Unexpected error in GET:', { error });
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { conversationId } = resolvedParams;

    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify participant access
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, participant_1_id, participant_2_id, status')
      .eq('id', conversationId)
      .single();

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conv.participant_1_id !== user.id && conv.participant_2_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (conv.status === 'closed') {
      return NextResponse.json({ error: 'Conversation is already closed' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (action !== 'close') {
      return NextResponse.json({ error: 'Invalid action. Use action: "close"' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      logger.error('[MessagesAPI] Failed to close conversation:', { error: updateError.message });
      return NextResponse.json(
        sanitizeErrorResponse(updateError, 'Failed to close conversation'),
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, status: 'closed' });
  } catch (error: any) {
    logger.error('[MessagesAPI] Unexpected error in PATCH:', { error });
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}
