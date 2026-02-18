import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prospectChat } from '@/app/lib/ai/prospect/service';
import type { KnownUserProfile, ProspectMessage, ProspectPreferences } from '@/app/lib/ai/prospect/types';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[API trigger-profile-completion] ${message}`, data !== undefined ? data : '');
  }
};

export const maxDuration = 60;

/** Build the SYSTEM message sent to the AI to start profile completion (server-side). */
function buildTriggerMessage(): string {
  return `[SYSTEM: User just completed signup and is now authenticated. Review the ENTIRE conversation history above and extract ALL profile information the user has shared. Create a comprehensive profile summary including: bio/description, experience level, skills, certifications, comfort zones, sailing preferences, and any other relevant details. Do NOT ask for information that was already provided in the conversation. Your goal is to get the user to confirm and then SAVE their profile using update_user_profile so it is stored.]`;
}

export async function POST(request: NextRequest) {
  log('=== POST /api/ai/prospect/trigger-profile-completion ===');

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // ignore
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', userMessage: 'Please sign in to continue.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body.sessionId ?? null;
    const conversationHistory = (body.conversationHistory ?? []) as ProspectMessage[];
    const gatheredPreferences = (body.gatheredPreferences ?? {}) as ProspectPreferences;
    const userProfile = body.userProfile as KnownUserProfile | null | undefined;

    const triggerMessage = buildTriggerMessage();
    log('Calling prospectChat with trigger message', { sessionId, historyLength: conversationHistory.length });

    const response = await prospectChat(supabase, {
      sessionId: sessionId ?? undefined,
      message: triggerMessage,
      conversationHistory,
      gatheredPreferences,
      profileCompletionMode: true,
      userId: user.id,
      userProfile: userProfile ?? {
        fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      },
      authenticatedUserId: user.id, // Required so service enables profile completion mode and update_user_profile
    });

    log('Trigger completed', { sessionId: response.sessionId, messageId: response.message?.id });

    // Mark session so returning users don't get duplicate triggers
    const sid = response.sessionId ?? sessionId;
    if (sid) {
      const db = await getSupabaseServerClient();
      await db
        .from('prospect_sessions')
        .update({ profile_completion_triggered_at: new Date().toISOString() })
        .eq('session_id', sid)
        .eq('user_id', user.id);
      log('Marked profile_completion_triggered_at', { sessionId: sid });
    }

    return NextResponse.json({
      sessionId: response.sessionId,
      message: response.message,
      triggerMessage,
      extractedPreferences: response.extractedPreferences,
    });
  } catch (error: any) {
    log('Error', error?.message);
    logger.error('[trigger-profile-completion]', error);
    return NextResponse.json(
      {
        error: error?.message ?? 'Failed to start profile completion',
        userMessage: 'Something went wrong. Please refresh and try again.',
      },
      { status: 500 }
    );
  }
}
