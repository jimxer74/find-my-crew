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

    const body = await request.json();
    const { email } = body as { email?: string };

    // Link current session by session_id
    const { error: linkError } = await supabase.rpc('link_prospect_session_to_user', {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_user_email: email || user.email || null,
    });

    if (linkError) {
      console.error('[Session Link API] Error linking session:', linkError);
      return NextResponse.json(
        { error: 'Failed to link session', details: linkError.message },
        { status: 500 }
      );
    }

    // Also link any other sessions with matching email (if email provided)
    if (email || user.email) {
      const emailToUse = email || user.email!;
      const { error: linkByEmailError } = await supabase.rpc('link_prospect_sessions_by_email', {
        p_user_id: user.id,
        p_user_email: emailToUse,
      });

      if (linkByEmailError) {
        // Log but don't fail - linking by email is optional
        console.warn('[Session Link API] Warning linking sessions by email:', linkByEmailError);
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
