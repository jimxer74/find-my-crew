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
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email } = body as { email?: string };

    // User must be authenticated to link sessions
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Link current session by session_id
    const { error: linkCurrentError } = await supabase
      .from('owner_sessions')
      .update({ user_id: user.id })
      .eq('session_id', sessionId)
      .is('user_id', null); // Only update if user_id is null

    if (linkCurrentError) {
      console.error('[Owner Session Link API] Error linking current session:', linkCurrentError);
    } else {
      console.log('[Owner Session Link API] ✅ Linked current session to user:', user.id);
    }

    // Link all sessions with matching email (if email provided)
    if (email) {
      const { error: linkEmailError } = await supabase
        .from('owner_sessions')
        .update({ user_id: user.id })
        .eq('email', email.toLowerCase().trim())
        .is('user_id', null); // Only update if user_id is null

      if (linkEmailError) {
        console.error('[Owner Session Link API] Error linking sessions by email:', linkEmailError);
      } else {
        console.log('[Owner Session Link API] ✅ Linked sessions by email to user:', user.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Owner Session Link API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
