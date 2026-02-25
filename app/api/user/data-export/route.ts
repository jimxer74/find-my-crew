import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';

/**
 * GET /api/user/data-export
 *
 * Exports all user data as JSON (GDPR data portability requirement)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user data
    const [
      profileResult,
      consentsResult,
      boatsResult,
      registrationsResult,
      notificationsResult,
      emailPrefsResult,
      consentAuditResult,
      // AI data
      aiConversationsResult,
      aiMessagesResult,
      aiPendingActionsResult,
      // Feedback data
      feedbackResult,
      feedbackVotesResult,
      feedbackPromptDismissalsResult,
    ] = await Promise.all([
      // Profile data
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),

      // Consent data
      supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user.id)
        .single(),

      // Boats owned by user
      supabase
        .from('boats')
        .select(`
          *,
          journeys (
            *,
            legs (
              *,
              waypoints (*)
            )
          )
        `)
        .eq('owner_id', user.id),

      // Registrations made by user
      supabase
        .from('registrations')
        .select(`
          *,
          legs (
            name,
            journeys (
              name
            )
          )
        `)
        .eq('user_id', user.id),

      // Notifications
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Email preferences
      supabase
        .from('email_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single(),

      // Consent audit log
      supabase
        .from('consent_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // AI conversations
      supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // AI messages
      supabase
        .from('ai_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // AI pending actions
      supabase
        .from('ai_pending_actions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Feedback submissions
      supabase
        .from('feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Feedback votes
      supabase
        .from('feedback_votes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Feedback prompt dismissals
      supabase
        .from('feedback_prompt_dismissals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    // Compile all data
    const exportData = {
      exportedAt: new Date().toISOString(),
      userId: user.id,
      email: user.email,

      profile: profileResult.data || null,
      consents: consentsResult.data || null,
      emailPreferences: emailPrefsResult.data || null,

      boats: boatsResult.data || [],
      registrations: registrationsResult.data || [],
      notifications: notificationsResult.data || [],

      consentHistory: consentAuditResult.data || [],

      // AI assistant data
      ai_data: {
        conversations: aiConversationsResult.data || [],
        messages: aiMessagesResult.data || [],
        pending_actions: aiPendingActionsResult.data || [],
      },

      // Feedback system data
      feedback_data: {
        feedback: feedbackResult.data || [],
        votes: feedbackVotesResult.data || [],
        prompt_dismissals: feedbackPromptDismissalsResult.data || [],
      },

      // Account metadata
      accountCreatedAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
    };

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="SailSmart-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error: any) {
    logger.error('Error exporting user data:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}
