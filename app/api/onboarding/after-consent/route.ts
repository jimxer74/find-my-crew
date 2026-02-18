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
      .select('session_id')
      .eq('user_id', user.id)
      .eq('onboarding_state', 'consent_pending')
      .limit(1)
      .maybeSingle();

    if (ownerSession) {
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
      .select('session_id')
      .eq('user_id', user.id)
      .eq('onboarding_state', 'consent_pending')
      .limit(1)
      .maybeSingle();

    if (prospectSession) {
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
    // Redirect based on ai consent: profile setup if no AI, or home
    if (!aiProcessingConsent) {
      return NextResponse.json({
        redirect: '/profile-setup',
        role: null,
        triggerProfileCompletion: false,
      });
    }

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
