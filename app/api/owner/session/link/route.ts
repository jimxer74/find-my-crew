import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient, getSupabaseUnauthenticatedClient } from '@/app/lib/supabaseServer';

const SESSION_COOKIE_NAME = 'owner_session_id';

/**
 * POST /api/owner/session/link
 * Links owner session to authenticated user after signup
 * - Links by session_id (current session)
 * - Also links by email (all sessions with matching email)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId =
      cookieStore.get(SESSION_COOKIE_NAME)?.value ||
      request.headers.get('X-Session-Id') ||
      undefined;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID found' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email, postSignupOnboarding } = body as { email?: string; postSignupOnboarding?: boolean };

    // User must be authenticated to link sessions
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const normalizedEmail = (email || user.email || '').toLowerCase().trim() || null;

    // Link current session by session_id
    const { error: linkCurrentError } = await supabase
      .from('owner_sessions')
      .update({
        user_id: user.id,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      })
      .eq('session_id', sessionId)
      .is('user_id', null); // Only update if user_id is null

    if (linkCurrentError) {
      logger.error('[Owner Session Link API] Error linking current session:', linkCurrentError);
    } else {
      logger.info('[Owner Session Link API] ✅ Linked current session to user:', { userId: user.id });
    }

    // Ensure current session has email when available (even if already linked)
    if (normalizedEmail) {
      const { error: ensureEmailError } = await supabase
        .from('owner_sessions')
        .update({ email: normalizedEmail })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .is('email', null);

      if (ensureEmailError) {
        logger.error('[Owner Session Link API] Error ensuring current session email:', ensureEmailError);
      }
    }

    // Link all sessions with matching email (if email provided)
    if (normalizedEmail) {
      const { error: linkEmailError } = await supabase
        .from('owner_sessions')
        .update({ user_id: user.id })
        .eq('email', normalizedEmail)
        .is('user_id', null); // Only update if user_id is null

      if (linkEmailError) {
        logger.error('[Owner Session Link API] Error linking sessions by email:', linkEmailError);
      } else {
        logger.info('[Owner Session Link API] ✅ Linked sessions by email to user:', { userId: user.id });
      }
    }

    // Set onboarding state to consent_pending for post-signup onboarding
    if (postSignupOnboarding) {
      const { error: stateError } = await supabase
        .from('owner_sessions')
        .update({ onboarding_state: 'consent_pending' })
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (stateError) {
        logger.warn('[Owner Session Link API] Could not set onboarding_state:', { error: stateError });
      } else {
        logger.info('[Owner Session Link API] ✅ Set onboarding_state to consent_pending');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('[Owner Session Link API] Unexpected error:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}
