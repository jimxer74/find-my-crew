import { logger } from '@shared/logging';
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { cookies } from 'next/headers';

/**
 * Debug endpoint to check session linking status
 * GET /api/debug/session-check
 */
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const cookieStore = await cookies();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        authenticated: false,
        error: 'Not authenticated',
      });
    }

    // Check for session cookies
    const ownerSessionId = cookieStore.get('owner_session_id')?.value;
    const prospectSessionId = cookieStore.get('prospect_session_id')?.value;

    // Check for sessions with user_id
    const { data: ownerSessions, error: ownerError } = await supabase
      .from('owner_sessions')
      .select('session_id, user_id, onboarding_state, created_at')
      .eq('user_id', user.id);

    const { data: prospectSessions, error: prospectError } = await supabase
      .from('prospect_sessions')
      .select('session_id, user_id, onboarding_state, created_at')
      .eq('user_id', user.id);

    // Check for NULL user_id sessions matching cookies
    const { data: nullOwnerSession } = ownerSessionId
      ? await supabase
          .from('owner_sessions')
          .select('session_id, user_id, onboarding_state, created_at')
          .eq('session_id', ownerSessionId)
          .is('user_id', null)
          .maybeSingle()
      : { data: null };

    const { data: nullProspectSession } = prospectSessionId
      ? await supabase
          .from('prospect_sessions')
          .select('session_id, user_id, onboarding_state, created_at')
          .eq('session_id', prospectSessionId)
          .is('user_id', null)
          .maybeSingle()
      : { data: null };

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      cookies: {
        ownerSessionId: ownerSessionId || null,
        prospectSessionId: prospectSessionId || null,
      },
      sessionsWithUserId: {
        owner: ownerSessions || [],
        ownerError: ownerError?.message || null,
        prospect: prospectSessions || [],
        prospectError: prospectError?.message || null,
      },
      nullUserIdSessions: {
        owner: nullOwnerSession || null,
        prospect: nullProspectSession || null,
      },
      summary: {
        hasOwnerSessionCookie: !!ownerSessionId,
        hasProspectSessionCookie: !!prospectSessionId,
        ownerSessionLinked: ownerSessions && ownerSessions.length > 0,
        prospectSessionLinked: prospectSessions && prospectSessions.length > 0,
        hasUnlinkedOwnerSession: !!nullOwnerSession,
        hasUnlinkedProspectSession: !!nullProspectSession,
      },
    });
  } catch (error: any) {
    logger.error('[session-check] Error:', { error: error.message });
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
