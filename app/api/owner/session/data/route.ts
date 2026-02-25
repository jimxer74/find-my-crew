import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient, getSupabaseUnauthenticatedClient, getSupabaseServiceRoleClient } from '@/app/lib/supabaseServer';
import { OwnerSession } from '@/app/lib/ai/owner/types';

const SESSION_COOKIE_NAME = 'owner_session_id';
const SESSION_EXPIRY_DAYS = 7;

/**
 * GET /api/owner/session/data
 * Loads session data from database using session_id from cookie
 * Supports both authenticated and unauthenticated users
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

    // Fetch session - use service role because anon can't SELECT rows with user_id (RLS)
    // Cookie proves ownership; we only return session data to the cookie holder
    const supabase = getSupabaseServiceRoleClient();
    const { data: session, error } = await supabase
      .from('owner_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      // Session doesn't exist - return null (not an error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ session: null });
      }
      logger.error('Error fetching session', { code: error.code, message: error.message });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Request failed'),
        { status: 500 }
      );
    }

    // Check if session is expired
    if (session && new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabase
        .from('owner_sessions')
        .delete()
        .eq('session_id', sessionId);
      
      return NextResponse.json({ session: null });
    }

    // If session has user_id, verify user owns it (if authenticated)
    // If user is logged out, cookie proves ownership - we already fetched via service role
    if (session.user_id) {
      try {
        const authClient = await getSupabaseServerClient();
        const { data: { user }, error: authError } = await authClient.auth.getUser();
        if (user && !authError && user.id !== session.user_id) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 403 }
          );
        }
        // User owns session or is logged out - cookie proves ownership
      } catch {
        // Auth error - user logged out, cookie proves ownership
      }
    }

    // Transform database row to OwnerSession format
    const ownerSession: OwnerSession = {
      sessionId: session.session_id,
      createdAt: session.created_at,
      lastActiveAt: session.last_active_at,
      conversation: session.conversation || [],
      gatheredPreferences: session.gathered_preferences || {},
      sessionEmail: session.email ?? null,
      hasSessionEmail: !!session.email,
      profileCompletionTriggeredAt: session.profile_completion_triggered_at ?? null,
      onboardingState: session.onboarding_state || 'signup_pending',
      skipperProfile: session.skipper_profile ?? null,
      crewRequirements: session.crew_requirements ?? null,
      journeyDetails: session.journey_details ?? null,
    };

    return NextResponse.json({ session: ownerSession });
  } catch (error: any) {
    logger.error('Unexpected error in GET', { message: error?.message || String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/session/data
 * Saves/updates session data in database
 * Supports both authenticated and unauthenticated users
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
    const { session } = body as { session: OwnerSession };

    if (!session) {
      return NextResponse.json(
        { error: 'Session data is required' },
        { status: 400 }
      );
    }

    // CRITICAL: Validate session_id from cookie matches session data
    if (session.sessionId !== sessionId) {
      logger.error('Session ID mismatch', {
        cookieSessionId: sessionId,
        sessionSessionId: session.sessionId,
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
    let email = (session.gatheredPreferences as any)?.email || null;
    
    // Clean email from preferences after extracting (don't store it in preferences)
    if (email && session.gatheredPreferences) {
      const { email: _, ...prefsWithoutEmail } = session.gatheredPreferences as any;
      session.gatheredPreferences = prefsWithoutEmail;
    }

    // Check if session exists - use service role because anon can't SELECT rows with user_id (RLS)
    // Cookie proves ownership; we only read user_id/email to pick the right client
    const serviceClient = getSupabaseServiceRoleClient();
    const { data: existingSession, error: selectError } = await serviceClient
      .from('owner_sessions')
      .select('user_id, email')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (selectError && selectError.code !== 'PGRST116') {
      logger.warn('Error checking existing session', { code: selectError.code, message: selectError.message });
    }

    // If session has user_id, verify user owns it OR use service role when logged out
    if (existingSession?.user_id) {
      try {
        const authClient = await getSupabaseServerClient();
        const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
        if (authUser && !authError && authUser.id === existingSession.user_id) {
          supabase = authClient;
          userId = authUser.id;
        } else {
          // User logged out but session has user_id - cookie proves ownership
          // Use service role to bypass RLS (anon can't update rows with user_id set)
          supabase = getSupabaseServiceRoleClient();
          userId = existingSession.user_id;
          logger.debug('Session has user_id but user logged out - using service role', {}, true);
        }
      } catch (authErr: any) {
        supabase = getSupabaseServiceRoleClient();
        userId = existingSession.user_id;
        logger.debug('Auth check failed, using service role', { message: authErr.message }, true);
      }
    }
    // If no user_id, continue with unauthenticated client
    // Don't try to get current user here - it will throw errors for unauthenticated users
    // The session will be linked to user later when they sign up via /api/owner/session/link

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
      last_active_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      skipper_profile: session.skipperProfile ?? null,
      crew_requirements: session.crewRequirements ?? null,
      journey_details: session.journeyDetails ?? null,
      // Only set created_at on insert, not update
      ...(existingSession ? {} : { created_at: new Date().toISOString() }),
    };

    logger.debug('Upserting session', {
      hasUserId: !!upsertData.user_id,
      hasEmail: !!upsertData.email,
      messagesCount: upsertData.conversation.length,
      isUpdate: !!existingSession,
    }, true);

    // Use INSERT or UPDATE instead of UPSERT to avoid RLS policy conflicts
    let saveError;
    if (existingSession) {
      // Update existing session
      const { error: updateError } = await supabase
        .from('owner_sessions')
        .update({
          conversation: upsertData.conversation,
          gathered_preferences: upsertData.gathered_preferences,
          last_active_at: upsertData.last_active_at,
          expires_at: upsertData.expires_at,
          // Preserve user_id and email if they exist
          user_id: upsertData.user_id,
          email: upsertData.email,
          skipper_profile: upsertData.skipper_profile,
          crew_requirements: upsertData.crew_requirements,
          journey_details: upsertData.journey_details,
        })
        .eq('session_id', sessionId);

      saveError = updateError;
      if (saveError) {
        logger.error('Error updating session', {
          message: saveError.message,
          code: saveError.code,
          details: saveError.details,
        });
      } else {
        logger.debug('Session updated successfully', {}, true);
      }
    } else {
      // Insert new session
      const { error: insertError } = await supabase
        .from('owner_sessions')
        .insert(upsertData);
      
      saveError = insertError;
      
      // If insert fails with duplicate key error, try update instead
      // This can happen if RLS prevented us from seeing the existing session
      if (saveError && saveError.code === '23505') {
        logger.debug('Insert failed with duplicate key, trying update', {}, true);
        const { error: updateError } = await supabase
          .from('owner_sessions')
          .update({
            conversation: upsertData.conversation,
            gathered_preferences: upsertData.gathered_preferences,
            last_active_at: upsertData.last_active_at,
            expires_at: upsertData.expires_at,
            // Preserve user_id and email if they exist
            user_id: upsertData.user_id,
            email: upsertData.email,
            skipper_profile: upsertData.skipper_profile,
            crew_requirements: upsertData.crew_requirements,
            journey_details: upsertData.journey_details,
          })
          .eq('session_id', sessionId);
        
        saveError = updateError;
        if (saveError) {
          logger.error('Error updating session (after duplicate key)', {
            message: saveError.message,
            code: saveError.code,
            details: saveError.details,
          });
        } else {
          logger.debug('Session updated successfully (after duplicate key)', {}, true);
        }
      } else if (saveError) {
        logger.error('Error inserting session', {
          message: saveError.message,
          code: saveError.code,
          details: saveError.details,
        });
      } else {
        logger.debug('Session inserted successfully', {}, true);
      }
    }

    if (saveError) {
      // Check if this is a NOT NULL violation - likely means migration 027 hasn't been run
      let errorMessage = 'Failed to save session';
      let errorHint = saveError.hint;
      
      if (saveError.code === '23502') {
        // PostgreSQL error 23502: not_null_violation
        errorMessage = 'Database schema error: user_id column is not nullable. Please run migration 027_make_owner_sessions_user_id_nullable.sql';
        errorHint = 'Migration 027 needs to be applied to allow unauthenticated owner sessions. The user_id column must be made nullable.';
      }
      
      const errorResponse = {
        error: errorMessage,
        details: saveError.message || 'Unknown error',
        code: saveError.code,
        hint: errorHint || saveError.hint,
        // Include additional context for debugging
        sessionId,
        hasUserId: !!userId,
        hasEmail: !!email,
        isUpdate: !!existingSession,
        migrationRequired: saveError.code === '23502' ? '027_make_owner_sessions_user_id_nullable.sql' : undefined,
      };
      
      logger.error('Returning error response', { code: errorResponse.code, error: errorResponse.error });
      
      return NextResponse.json(
        errorResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Unexpected error in POST', { message: error?.message || String(error) });
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error?.message || 'Unknown error',
        type: error?.name || 'Error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/owner/session/data
 * Updates session data (specifically onboarding_state) in database
 */
export async function PATCH(request: NextRequest) {
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
    const { onboarding_state } = body as { onboarding_state?: string };

    if (!onboarding_state) {
      return NextResponse.json(
        { error: 'Onboarding state is required' },
        { status: 400 }
      );
    }

    // Use appropriate client based on session state
    let supabase = getSupabaseUnauthenticatedClient();
    let userId: string | null = null;

    // Check if session exists - use service role because anon can't SELECT rows with user_id (RLS)
    const serviceClient = getSupabaseServiceRoleClient();
    const { data: existingSession, error: selectError } = await serviceClient
      .from('owner_sessions')
      .select('user_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      logger.warn('Error checking existing session', { code: selectError.code, message: selectError.message });
    }

    // If session has user_id, verify user owns it OR use service role when logged out
    if (existingSession?.user_id) {
      try {
        const authClient = await getSupabaseServerClient();
        const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
        if (authUser && !authError && authUser.id === existingSession.user_id) {
          supabase = authClient;
          userId = authUser.id;
        } else {
          supabase = getSupabaseServiceRoleClient();
          userId = existingSession.user_id;
        }
      } catch (authErr: any) {
        supabase = getSupabaseServiceRoleClient();
        userId = existingSession.user_id;
      }
    }

    // Update onboarding state
    const { error: updateError } = await supabase
      .from('owner_sessions')
      .update({
        onboarding_state: onboarding_state,
        last_active_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    if (updateError) {
      logger.error('Error updating onboarding state', { message: updateError.message, code: updateError.code });
      return NextResponse.json(
        {
          error: 'Failed to update onboarding state',
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Unexpected error in PATCH', { message: error?.message || String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owner/session/data
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

    // Check if session exists - use service role (anon can't SELECT rows with user_id)
    let supabase = getSupabaseServiceRoleClient();
    const { data: existingSession, error: selectError } = await supabase
      .from('owner_sessions')
      .select('user_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    // If session doesn't exist, that's fine - return success
    if (selectError && selectError.code === 'PGRST116') {
      return NextResponse.json({ success: true });
    }

    if (selectError) {
      logger.error('Error checking session for deletion', { message: selectError.message, code: selectError.code });
      return NextResponse.json(
        { error: 'Failed to check session', details: selectError.message },
        { status: 500 }
      );
    }

    // If session has user_id, verify user owns it before allowing delete
    // When user is logged out, service role is already used (cookie proves ownership)
    if (existingSession?.user_id) {
      try {
        const authClient = await getSupabaseServerClient();
        const { data: { user }, error: authError } = await authClient.auth.getUser();
        if (user && !authError && user.id === existingSession.user_id) {
          supabase = authClient;
        }
        // Else: keep service role (user logged out, cookie proves ownership)
      } catch {
        // Auth error - keep service role for cookie-based deletion
      }
    }

    // Delete session
    const { error } = await supabase
      .from('owner_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      logger.error('Error deleting session', { message: error.message, code: error.code });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Request failed'),
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Unexpected error in GET', { message: error?.message || String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}
