import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

const SESSION_COOKIE_NAME = 'prospect_session_id';

/**
 * POST /api/prospect/session/link
 * Links prospect session to authenticated user after signup
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID found' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email, postSignupOnboarding } = body as { email?: string; postSignupOnboarding?: boolean };
    const normalizedEmail = (email || user.email || '').toLowerCase().trim() || null;

    // Link current session by session_id
    const { error: linkError } = await supabase.rpc('link_prospect_session_to_user', {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_user_email: normalizedEmail,
    });

    if (linkError) {
      console.error('[Session Link API] Error linking session:', linkError);
      return NextResponse.json(
        { error: 'Failed to link session', details: linkError.message },
        { status: 500 }
      );
    }

    // Also link any other sessions with matching email (if email provided)
    if (normalizedEmail) {
      const { error: linkByEmailError } = await supabase.rpc('link_prospect_sessions_by_email', {
        p_user_id: user.id,
        p_user_email: normalizedEmail,
      });

      if (linkByEmailError) {
        // Log but don't fail - linking by email is optional
        console.warn('[Session Link API] Warning linking sessions by email:', linkByEmailError);
      }
    }

    // Ensure current session has email when available (even if already linked)
    if (normalizedEmail) {
      const { error: ensureEmailError } = await supabase
        .from('prospect_sessions')
        .update({ email: normalizedEmail })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .is('email', null);

      if (ensureEmailError) {
        console.warn('[Session Link API] Warning ensuring current session email:', ensureEmailError);
      }
    }

    // Set onboarding state to consent_pending for post-signup onboarding
    if (postSignupOnboarding) {
      const { error: stateError } = await supabase
        .from('prospect_sessions')
        .update({ onboarding_state: 'consent_pending' })
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (stateError) {
        console.warn('[Prospect Session Link API] Could not set onboarding_state:', stateError);
      } else {
        console.log('[Prospect Session Link API] ✅ Set onboarding_state to consent_pending');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Session Link API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
