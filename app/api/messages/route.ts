import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * GET /api/messages
 *
 * Lists all conversations for the authenticated user.
 * Returns each conversation with the other participant's profile,
 * the last message preview, and the unread count.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch conversations where user is a participant
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, registration_id, participant_1_id, participant_2_id, status, created_at, updated_at')
      .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
      .order('updated_at', { ascending: false });

    if (convError) {
      logger.error('[MessagesAPI] Failed to fetch conversations:', { error: convError.message });
      return NextResponse.json(
        sanitizeErrorResponse(convError, 'Failed to fetch conversations'),
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // Collect other participant IDs
    const otherParticipantIds = conversations.map((c) =>
      c.participant_1_id === user.id ? c.participant_2_id : c.participant_1_id
    );
    const uniqueIds = [...new Set(otherParticipantIds)];

    // Fetch profiles for other participants
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, profile_image_url')
      .in('id', uniqueIds);

    const profileMap = (profiles ?? []).reduce<Record<string, any>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    // Fetch last message + unread count for each conversation
    const conversationIds = conversations.map((c) => c.id);

    // Get all messages across these conversations (last message per convo + unread)
    const { data: allMessages } = await supabase
      .from('conversation_messages')
      .select('id, conversation_id, sender_id, content, created_at, read_by')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    // Group by conversation_id
    const messagesByConv: Record<string, any[]> = {};
    for (const msg of allMessages ?? []) {
      if (!messagesByConv[msg.conversation_id]) {
        messagesByConv[msg.conversation_id] = [];
      }
      messagesByConv[msg.conversation_id].push(msg);
    }

    const result = conversations.map((conv) => {
      const otherId = conv.participant_1_id === user.id ? conv.participant_2_id : conv.participant_1_id;
      const otherProfile = profileMap[otherId] ?? null;
      const messages = messagesByConv[conv.id] ?? [];
      const lastMsg = messages[0] ?? null;
      const unreadCount = messages.filter(
        (m) => m.sender_id !== user.id && !(m.read_by as string[])?.includes(user.id)
      ).length;

      return {
        id: conv.id,
        registration_id: conv.registration_id,
        status: conv.status,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        other_participant: otherProfile
          ? {
              id: otherProfile.id,
              full_name: otherProfile.full_name,
              username: otherProfile.username,
              profile_image_url: otherProfile.profile_image_url,
            }
          : { id: otherId, full_name: null, username: null, profile_image_url: null },
        last_message: lastMsg
          ? {
              content: lastMsg.content,
              sender_id: lastMsg.sender_id,
              created_at: lastMsg.created_at,
            }
          : null,
        unread_count: unreadCount,
      };
    });

    return NextResponse.json({ conversations: result });
  } catch (error: any) {
    logger.error('[MessagesAPI] Unexpected error:', { error });
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}
