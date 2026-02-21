import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * POST /api/onboarding/after-consent
 *
 * Called by ConsentSetupModal after user saves consents.
 * Looks up post-signup intent from session tables (prospect_sessions, owner_sessions)
 * and returns redirect path + whether to trigger profile completion.
 *
 * Single source of truth - replaces fragile window events and localStorage flags.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', redirect: '/auth/login' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const aiProcessingConsent = body.aiProcessingConsent ?? false;

    // Check owner_sessions first (owner takes precedence if user visited both)
    const { data: ownerSession } = await supabase
      .from('owner_sessions')
      .select('session_id, conversation')
      .eq('user_id', user.id)
      .eq('onboarding_state', 'consent_pending')
      .limit(1)
      .maybeSingle();

    if (ownerSession) {
      if (!aiProcessingConsent && ownerSession.conversation && ownerSession.conversation.length > 0) {
        // User opted out of AI processing but had a session. Store history for GDPR and terminate session
        const { data: conv } = await supabase.from('ai_conversations').insert({
          user_id: user.id,
          title: 'Owner Onboarding Chat'
        }).select('id').single();

        if (conv) {
          const formattedMessages = ownerSession.conversation.map((msg: any) => ({
            conversation_id: conv.id,
            role: msg.role,
            content: msg.content,
          }));
          await supabase.from('ai_messages').insert(formattedMessages);
        }

        await supabase.from('owner_sessions').delete().eq('session_id', ownerSession.session_id);

        // User opted out of AI - return to home page instead of profile setup
        // This allows them to use non-AI profile setup or other functionality if they choose
        return NextResponse.json({
          redirect: '/',
          role: null,
          triggerProfileCompletion: false,
        });
      }

      // Update onboarding state to profile_pending
      await supabase
        .from('owner_sessions')
        .update({ onboarding_state: 'profile_pending' })
        .eq('session_id', ownerSession.session_id);

      return NextResponse.json({
        redirect: '/welcome/owner?profile_completion=true',
        role: 'owner',
        triggerProfileCompletion: aiProcessingConsent,
        sessionId: ownerSession.session_id,
      });
    }

    // Check prospect_sessions
    const { data: prospectSession } = await supabase
      .from('prospect_sessions')
      .select('session_id, conversation')
      .eq('user_id', user.id)
      .eq('onboarding_state', 'consent_pending')
      .limit(1)
      .maybeSingle();

    if (prospectSession) {
      if (!aiProcessingConsent && prospectSession.conversation && prospectSession.conversation.length > 0) {
        // User opted out of AI processing but had a session. Store history for GDPR and terminate session
        const { data: conv } = await supabase.from('ai_conversations').insert({
          user_id: user.id,
          title: 'Crew Onboarding Chat'
        }).select('id').single();

        if (conv) {
          const formattedMessages = prospectSession.conversation.map((msg: any) => ({
            conversation_id: conv.id,
            role: msg.role,
            content: msg.content,
          }));
          await supabase.from('ai_messages').insert(formattedMessages);
        }

        await supabase.from('prospect_sessions').delete().eq('session_id', prospectSession.session_id);

        // User opted out of AI - return to home page instead of profile setup
        // This allows them to use non-AI profile setup or other functionality if they choose
        return NextResponse.json({
          redirect: '/',
          role: null,
          triggerProfileCompletion: false,
        });
      }

      // Update onboarding state to profile_pending
      await supabase
        .from('prospect_sessions')
        .update({ onboarding_state: 'profile_pending' })
        .eq('session_id', prospectSession.session_id);

      return NextResponse.json({
        redirect: '/welcome/crew?profile_completion=true',
        role: 'prospect',
        triggerProfileCompletion: aiProcessingConsent,
        sessionId: prospectSession.session_id,
      });
    }

    // No pending intent - user completed consent but didn't come from onboarding signup
    // Always redirect to home page - no more /profile-setup route
    return NextResponse.json({
      redirect: '/',
      role: null,
      triggerProfileCompletion: false,
    });
  } catch (error: any) {
    logger.error('[after-consent] Error:', { error });
    return NextResponse.json(
      { error: 'Internal server error', redirect: '/' },
      { status: 500 }
    );
  }
}
