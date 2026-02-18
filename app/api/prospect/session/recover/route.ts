import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUnauthenticatedClient } from '@/app/lib/supabaseServer';
import { ProspectSession } from '@/app/lib/ai/prospect/types';

/**
 * POST /api/prospect/session/recover
 * Finds session by email for returning users who lost their cookie
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email: string };

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseUnauthenticatedClient();

    // Call database function to find session by email
    const { data, error } = await supabase.rpc('find_prospect_session_by_email', {
      p_email: email.trim().toLowerCase(),
    });

    if (error) {
      console.error('[Session Recover API] Error finding session:', error);
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Request failed'),
        { status: 500 }
      );
    }

    // Function returns array, get first result
    const sessionRow = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!sessionRow) {
      return NextResponse.json({ session: null });
    }

    // Transform database row to ProspectSession format
    const prospectSession: ProspectSession = {
      sessionId: sessionRow.session_id,
      createdAt: sessionRow.created_at,
      lastActiveAt: sessionRow.last_active_at,
      conversation: sessionRow.conversation || [],
      gatheredPreferences: sessionRow.gathered_preferences || {},
      viewedLegs: sessionRow.viewed_legs || [],
    };

    return NextResponse.json({ session: prospectSession });
  } catch (error: any) {
    console.error('[Session Recover API] Unexpected error:', error);
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}
