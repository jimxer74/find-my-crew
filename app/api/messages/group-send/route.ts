import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * POST /api/messages/group-send
 *
 * Sends the same message to multiple registrants via their existing conversations.
 * Creates a conversation if one doesn't exist yet for the registration.
 *
 * Body:
 * - registrationIds: string[] (required) — list of registration IDs to message
 * - content: string (required) — message text
 * - attachments: array of {type, url, name, vault_document_id?} (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { registrationIds, content, attachments } = body;

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      return NextResponse.json({ error: 'registrationIds must be a non-empty array' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    if (content.length > 10000) {
      return NextResponse.json({ error: 'Message is too long (max 10,000 characters)' }, { status: 400 });
    }

    // Verify all registrations belong to boats owned by the requesting user
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('id, user_id, legs(journeys(boats(owner_id)))')
      .in('id', registrationIds);

    if (regError) {
      logger.error('[GroupSend] Failed to fetch registrations:', { error: regError.message });
      return NextResponse.json(sanitizeErrorResponse(regError, 'Failed to fetch registrations'), { status: 500 });
    }

    // Filter to only registrations where the user is the boat owner
    const authorizedRegistrations = (registrations || []).filter((reg: any) => {
      const ownerIds = reg.legs?.journeys?.boats?.owner_id;
      return ownerIds === user.id;
    });

    if (authorizedRegistrations.length === 0) {
      return NextResponse.json({ error: 'No authorized registrations found' }, { status: 403 });
    }

    // Deduplicate by user_id — keep only one registration per unique recipient.
    // A user may have registered for multiple legs; we only send them one message.
    const seenUserIds = new Set<string>();
    const deduplicatedRegistrations = authorizedRegistrations.filter((reg: any) => {
      if (seenUserIds.has(reg.user_id)) return false;
      seenUserIds.add(reg.user_id);
      return true;
    });

    const authorizedIds = deduplicatedRegistrations.map((r: any) => r.id);

    // Find existing conversations for these registrations
    const { data: existingConvs, error: convError } = await supabase
      .from('conversations')
      .select('id, registration_id, participant_1_id, participant_2_id, status')
      .in('registration_id', authorizedIds);

    if (convError) {
      logger.error('[GroupSend] Failed to fetch conversations:', { error: convError.message });
      return NextResponse.json(sanitizeErrorResponse(convError, 'Failed to fetch conversations'), { status: 500 });
    }

    const convByRegId = new Map((existingConvs || []).map((c: any) => [c.registration_id, c]));

    // For registrations without a conversation, create one
    const missingRegIds = authorizedIds.filter((id: string) => !convByRegId.has(id));
    if (missingRegIds.length > 0) {
      const regsWithUsers = deduplicatedRegistrations.filter((r: any) => missingRegIds.includes(r.id));
      const newConvs = regsWithUsers.map((reg: any) => ({
        registration_id: reg.id,
        participant_1_id: user.id,
        participant_2_id: reg.user_id,
        status: 'open',
      }));

      const { data: createdConvs, error: createError } = await supabase
        .from('conversations')
        .insert(newConvs)
        .select('id, registration_id, participant_1_id, participant_2_id, status');

      if (createError) {
        logger.warn('[GroupSend] Failed to create some conversations:', { error: createError.message });
      } else {
        (createdConvs || []).forEach((c: any) => convByRegId.set(c.registration_id, c));
      }
    }

    // Send message to each conversation
    const trimmedContent = content.trim();
    const results: { registrationId: string; conversationId: string; success: boolean; error?: string }[] = [];

    for (const regId of authorizedIds) {
      const conv = convByRegId.get(regId);
      if (!conv) {
        results.push({ registrationId: regId, conversationId: '', success: false, error: 'No conversation found' });
        continue;
      }

      if (conv.status === 'closed') {
        results.push({ registrationId: regId, conversationId: conv.id, success: false, error: 'Conversation is closed' });
        continue;
      }

      const { error: msgError } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conv.id,
          sender_id: user.id,
          content: trimmedContent,
          attachments: attachments ?? [],
          read_by: [user.id],
        });

      if (msgError) {
        logger.error('[GroupSend] Failed to send to conversation:', { conversationId: conv.id, error: msgError.message });
        results.push({ registrationId: regId, conversationId: conv.id, success: false, error: msgError.message });
        continue;
      }

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conv.id);

      // Notify recipient (non-blocking)
      const otherId = conv.participant_1_id === user.id ? conv.participant_2_id : conv.participant_1_id;
      notifyNewMessage(supabase, otherId, user.id, conv.id).catch(() => {});

      results.push({ registrationId: regId, conversationId: conv.id, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    logger.debug('[GroupSend] Completed', { successCount, failureCount });

    return NextResponse.json({
      sent: successCount,
      failed: failureCount,
      results,
    }, { status: 200 });
  } catch (error: any) {
    logger.error('[GroupSend] Unexpected error:', { error: error instanceof Error ? error.message : String(error) });
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
    logger.warn('[GroupSend] Notification failed:', { error: err instanceof Error ? err.message : String(err) });
  }
}
