import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient, getSupabaseUnauthenticatedClient } from '@/app/lib/supabaseServer';
import { ProspectSession } from '@/app/lib/ai/prospect/types';

const SESSION_COOKIE_NAME = 'prospect_session_id';
const SESSION_EXPIRY_DAYS = 7;

/**
 * GET /api/prospect/session/data
 * Loads session data from database using session_id from cookie
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID found' },
        { status: 404 }
      );
    }

    // Use unauthenticated client first - RLS allows access to sessions with user_id = NULL
    // We'll switch to authenticated client only if session has user_id
    let supabase = getSupabaseUnauthenticatedClient();

    // Fetch session from database
    const { data: session, error } = await supabase
      .from('prospect_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      // Session doesn't exist - return null (not an error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ session: null });
      }
      console.error('[Session Data API] Error fetching session:', error);
      return NextResponse.json(
        { error: 'Failed to fetch session', details: error.message },
        { status: 500 }
      );
    }

    // Check if session is expired
    if (session && new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabase
        .from('prospect_sessions')
        .delete()
        .eq('session_id', sessionId);
      
      return NextResponse.json({ session: null });
    }

    // If session has user_id, verify user is authenticated and owns the session
    // BUT: Allow unauthenticated access if user is not logged in (they might be in prospect flow)
    // The cookie-based session_id is sufficient proof of ownership for unauthenticated users
    if (session.user_id) {
      try {
        // Try to get authenticated client and verify user
        supabase = await getSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        // If user is authenticated, verify they own the session
        if (user && !authError) {
          if (user.id !== session.user_id) {
            return NextResponse.json(
              { error: 'Unauthorized' },
              { status: 403 }
            );
          }
          // User is authenticated and owns the session - use authenticated client
        } else {
          // User is not authenticated, but session has user_id
          // This can happen if session was linked but user logged out
          // Allow access via cookie (cookie proves ownership)
          // Switch back to unauthenticated client
          supabase = getSupabaseUnauthenticatedClient();
          console.log('[Session Data API] ⚠️ Session has user_id but user is not authenticated - allowing cookie-based access');
        }
      } catch (authErr: any) {
        // Auth error means user is not authenticated
        // Allow access via cookie (cookie proves ownership)
        supabase = getSupabaseUnauthenticatedClient();
        console.log('[Session Data API] ⚠️ Auth check failed, allowing cookie-based access:', authErr.message);
      }
    }

    // Transform database row to ProspectSession format
    const prospectSession: ProspectSession = {
      sessionId: session.session_id,
      createdAt: session.created_at,
      lastActiveAt: session.last_active_at,
      conversation: session.conversation || [],
      gatheredPreferences: session.gathered_preferences || {},
      viewedLegs: session.viewed_legs || [],
    };

    return NextResponse.json({ session: prospectSession });
  } catch (error: any) {
    console.error('[Session Data API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prospect/session/data
 * Saves/updates session data in database
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
    const { session } = body as { session: ProspectSession };

    if (!session) {
      return NextResponse.json(
        { error: 'Session data is required' },
        { status: 400 }
      );
    }

    // CRITICAL: Validate session_id from cookie matches session data
    if (session.sessionId !== sessionId) {
      console.error('[Session Data API] ❌ Session ID mismatch!', {
        cookieSessionId: sessionId,
        sessionSessionId: session.sessionId,
        sessionData: {
          messagesCount: session.conversation?.length || 0,
          preferencesKeys: Object.keys(session.gatheredPreferences || {}),
        },
      });
      return NextResponse.json(
        { error: 'Session ID mismatch', details: `Cookie: ${sessionId}, Session: ${session.sessionId}` },
        { status: 403 }
      );
    }

    // Use unauthenticated client first - we'll switch if needed
    let supabase = getSupabaseUnauthenticatedClient();
    let userId: string | null = null;

    // Extract email from gatheredPreferences if present (user might share email in conversation)
    // Note: This is optional - most users don't share email before signup
    // Email is stored in preferences.email temporarily, then moved to session.email
    let email = (session.gatheredPreferences as any)?.email || null;
    
    // Clean email from preferences after extracting (don't store it in preferences)
    if (email && session.gatheredPreferences) {
      const { email: _, ...prefsWithoutEmail } = session.gatheredPreferences as any;
      session.gatheredPreferences = prefsWithoutEmail;
    }

    // Check if session exists
    // Note: .single() throws an error if no rows found, so we use maybeSingle() or handle the error
    const { data: existingSession, error: selectError } = await supabase
      .from('prospect_sessions')
      .select('user_id, email')
      .eq('session_id', sessionId)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no row exists
    
    // Log if there was an error (but continue - it might just mean session doesn't exist yet)
    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn('[Session Data API] ⚠️ Error checking existing session:', selectError);
    }

    // If session has user_id, verify user owns it
    if (existingSession?.user_id) {
      // Switch to authenticated client to verify user
      try {
        const authClient = await getSupabaseServerClient();
        const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
        // If auth error or user doesn't match, return unauthorized
        if (authError || !authUser || authUser.id !== existingSession.user_id) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 403 }
          );
        }
        supabase = authClient; // Use authenticated client
        userId = authUser.id; // Update userId
      } catch (authErr: any) {
        // Auth error means user is not authenticated, but session requires auth
        console.error('[Session Data API] Auth error when verifying session:', authErr);
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }
    // If no user_id, continue with unauthenticated client
    // Don't try to get current user here - it will throw errors for unauthenticated users
    // The session will be linked to user later when they sign up via /api/prospect/session/link

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    // Prepare upsert data
    const upsertData = {
      session_id: sessionId,
      user_id: userId || existingSession?.user_id || null, // Preserve existing user_id if set
      email: email || existingSession?.email || null, // Preserve existing email if set
      conversation: session.conversation || [],
      gathered_preferences: session.gatheredPreferences || {},
      viewed_legs: session.viewedLegs || [],
      last_active_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      // Only set created_at on insert, not update
      ...(existingSession ? {} : { created_at: new Date().toISOString() }),
    };

    console.log('[Session Data API] 💾 Upserting session:', {
      sessionId,
      hasUserId: !!upsertData.user_id,
      hasEmail: !!upsertData.email,
      messagesCount: upsertData.conversation.length,
      preferencesKeys: Object.keys(upsertData.gathered_preferences),
      viewedLegsCount: upsertData.viewed_legs.length,
      isUpdate: !!existingSession,
    });

    // Use INSERT or UPDATE instead of UPSERT to avoid RLS policy conflicts
    // UPSERT can cause issues with RLS because it evaluates both INSERT and UPDATE policies
    let saveError;
    if (existingSession) {
      // Update existing session
      const { error: updateError } = await supabase
        .from('prospect_sessions')
        .update({
          conversation: upsertData.conversation,
          gathered_preferences: upsertData.gathered_preferences,
          viewed_legs: upsertData.viewed_legs,
          last_active_at: upsertData.last_active_at,
          expires_at: upsertData.expires_at,
          // Preserve user_id and email if they exist
          user_id: upsertData.user_id,
          email: upsertData.email,
        })
        .eq('session_id', sessionId);
      
      saveError = updateError;
      if (saveError) {
        console.error('[Session Data API] ❌ Error updating session:', {
          error: saveError,
          message: saveError.message,
          details: saveError.details,
          hint: saveError.hint,
          code: saveError.code,
          sessionId,
        });
      } else {
        console.log('[Session Data API] ✅ Session updated successfully');
      }
    } else {
      // Insert new session
      const { error: insertError } = await supabase
        .from('prospect_sessions')
        .insert(upsertData);
      
      saveError = insertError;
      
      // If insert fails with duplicate key error, try update instead
      // This can happen if RLS prevented us from seeing the existing session
      if (saveError && saveError.code === '23505') {
        console.log('[Session Data API] ⚠️ Insert failed with duplicate key, trying update instead...');
        const { error: updateError } = await supabase
          .from('prospect_sessions')
          .update({
            conversation: upsertData.conversation,
            gathered_preferences: upsertData.gathered_preferences,
            viewed_legs: upsertData.viewed_legs,
            last_active_at: upsertData.last_active_at,
            expires_at: upsertData.expires_at,
            // Preserve user_id and email if they exist
            user_id: upsertData.user_id,
            email: upsertData.email,
          })
          .eq('session_id', sessionId);
        
        saveError = updateError;
        if (saveError) {
          console.error('[Session Data API] ❌ Error updating session (after duplicate key):', {
            error: saveError,
            message: saveError.message,
            details: saveError.details,
            hint: saveError.hint,
            code: saveError.code,
            sessionId,
          });
        } else {
          console.log('[Session Data API] ✅ Session updated successfully (after duplicate key)');
        }
      } else if (saveError) {
        console.error('[Session Data API] ❌ Error inserting session:', {
          error: saveError,
          message: saveError.message,
          details: saveError.details,
          hint: saveError.hint,
          code: saveError.code,
          sessionId,
          upsertData: {
            ...upsertData,
            conversation: `[${upsertData.conversation.length} messages]`,
            gathered_preferences: `[${Object.keys(upsertData.gathered_preferences).length} keys]`,
          },
        });
      } else {
        console.log('[Session Data API] ✅ Session inserted successfully');
      }
    }

    if (saveError) {
      return NextResponse.json(
        { 
          error: 'Failed to save session', 
          details: saveError.message,
          code: saveError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Session Data API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prospect/session/data
 * Deletes session data from database
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID found' },
        { status: 400 }
      );
    }

    // Use unauthenticated client first
    let supabase = getSupabaseUnauthenticatedClient();

    // Check if session exists and get user_id
    const { data: existingSession, error: selectError } = await supabase
      .from('prospect_sessions')
      .select('user_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    // If session doesn't exist, that's fine - return success
    if (selectError && selectError.code === 'PGRST116') {
      return NextResponse.json({ success: true });
    }

    if (selectError) {
      console.error('[Session Data API] Error checking session for deletion:', selectError);
      return NextResponse.json(
        { error: 'Failed to check session', details: selectError.message },
        { status: 500 }
      );
    }

    // If session has user_id, verify user owns it (if authenticated)
    // BUT: Allow unauthenticated deletion via cookie (cookie proves ownership)
    if (existingSession?.user_id) {
      try {
        // Try to get authenticated client and verify user
        const authClient = await getSupabaseServerClient();
        const { data: { user }, error: authError } = await authClient.auth.getUser();
        
        // If user is authenticated, verify they own the session
        if (user && !authError) {
          if (user.id !== existingSession.user_id) {
            return NextResponse.json(
              { error: 'Unauthorized' },
              { status: 403 }
            );
          }
          // User is authenticated and owns the session - use authenticated client
          supabase = authClient;
        } else {
          // User is not authenticated, but session has user_id
          // Allow deletion via cookie (cookie proves ownership)
          // Keep using unauthenticated client
          console.log('[Session Data API] ⚠️ Session has user_id but user is not authenticated - allowing cookie-based deletion');
        }
      } catch (authErr: any) {
        // Auth error means user is not authenticated
        // Allow deletion via cookie (cookie proves ownership)
        console.log('[Session Data API] ⚠️ Auth check failed, allowing cookie-based deletion:', authErr.message);
      }
    }

    // Delete session
    const { error } = await supabase
      .from('prospect_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.error('[Session Data API] Error deleting session:', error);
      return NextResponse.json(
        { error: 'Failed to delete session', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Session Data API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
