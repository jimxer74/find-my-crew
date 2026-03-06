import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * POST /api/messages/[conversationId]/send
 *
 * Sends a message in a conversation.
 * Only participants of an open conversation can send messages.
 *
 * Body:
 * - content: string (required)
 * - attachments: array of {type, url, name, vault_document_id?} (optional)
 */
export async function POST(
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

    const body = await request.json();
    const { content, attachments } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    if (content.length > 10000) {
      return NextResponse.json({ error: 'Message is too long (max 10,000 characters)' }, { status: 400 });
    }

    // Verify conversation exists and user is a participant
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
      return NextResponse.json({ error: 'This conversation has been closed' }, { status: 400 });
    }

    // Insert message
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim(),
        attachments: attachments ?? [],
        read_by: [user.id], // sender has read their own message
      })
      .select('id, conversation_id, sender_id, content, attachments, read_by, created_at')
      .single();

    if (msgError) {
      logger.error('[MessagesAPI] Failed to send message:', { error: msgError.message });
      return NextResponse.json(
        sanitizeErrorResponse(msgError, 'Failed to send message'),
        { status: 500 }
      );
    }

    // Update conversation's updated_at (so conversations list sorts correctly)
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Fire notification to other participant (non-blocking)
    const otherId = conv.participant_1_id === user.id ? conv.participant_2_id : conv.participant_1_id;
    notifyNewMessage(supabase, otherId, user.id, conversationId).catch((err) => {
      logger.warn('[MessagesAPI] Failed to send message notification:', { error: err instanceof Error ? err.message : String(err) });
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: any) {
    logger.error('[MessagesAPI] Unexpected error in send:', { error });
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}

async function notifyNewMessage(
  supabase: any,
  recipientId: string,
  senderId: string,
  conversationId: string
): Promise<void> {
  try {
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderId)
      .single();

    const senderName = senderProfile?.full_name || senderProfile?.username || 'Someone';

    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'message_received',
      title: 'New message',
      message: `${senderName} sent you a message`,
      data: { conversation_id: conversationId, sender_id: senderId },
      read: false,
    });
  } catch (err) {
    logger.warn('[MessagesAPI] Notification insert failed:', { error: err instanceof Error ? err.message : String(err) });
  }
}
