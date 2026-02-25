import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ownerChat } from '@shared/ai/owner/service';
import type { KnownUserProfile, OwnerMessage, OwnerPreferences } from '@shared/ai/owner/types';
import { getSupabaseServerClient } from '@shared/database/server';

const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[API trigger-profile-completion-owner] ${message}`, data !== undefined ? (data as Record<string, any>) : undefined);
  }
};

export const maxDuration = 60;

/** Build the SYSTEM message sent to the AI to start profile completion (server-side). */
function buildTriggerMessage(): string {
  return `[SYSTEM: User just completed signup and is now authenticated. Extract the skipper profile EXCLUSIVELY from [SKIPPER PROFILE] in the STORED CONTEXT — do NOT read [CREW REQUIREMENTS] for any profile field; that section describes what the skipper wants FROM crew and must be ignored here. Display a clear profile summary (name, bio, experience level, certifications, risk levels, skills) and ask the user to confirm before saving. Do NOT call update_user_profile until the user says "yes", "looks good", "save", or similar.]`;
}

export async function POST(request: NextRequest) {
  log('=== POST /api/ai/owner/trigger-profile-completion ===');

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
    const conversationHistory = (body.conversationHistory ?? []) as OwnerMessage[];
    const gatheredPreferences = (body.gatheredPreferences ?? {}) as OwnerPreferences;
    const userProfile = body.userProfile as KnownUserProfile | null | undefined;
    const skipperProfile = (body.skipperProfile ?? null) as string | null;
    const crewRequirements = (body.crewRequirements ?? null) as string | null;
    const journeyDetails = (body.journeyDetails ?? null) as string | null;
    const importedProfile = body.importedProfile as {
      url: string;
      source: string;
      content: string;
    } | null | undefined;

    const triggerMessage = buildTriggerMessage();
    log('Calling ownerChat with trigger message', { sessionId, historyLength: conversationHistory.length });

    const response = await ownerChat(supabase, {
      sessionId: sessionId ?? undefined,
      message: triggerMessage,
      conversationHistory,
      gatheredPreferences,
      profileCompletionMode: true,
      authenticatedUserId: user.id,
      userProfile: userProfile ?? {
        fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      },
      skipperProfile,
      crewRequirements,
      journeyDetails,
      importedProfile: importedProfile ?? null,
    });

    log('Trigger completed', { sessionId: response.sessionId, messageId: response.message?.id, profileCreated: response.profileCreated });

    // Mark session and update onboarding_state server-side
    const sid = response.sessionId ?? sessionId;
    if (sid) {
      const db = await getSupabaseServerClient();
      const sessionUpdate: Record<string, unknown> = {
        user_id: user.id,
        profile_completion_triggered_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };
      // If profile was created during this trigger, advance onboarding state
      if (response.profileCreated) {
        sessionUpdate.onboarding_state = 'boat_pending';
        log('Profile created during trigger — setting onboarding_state to boat_pending', { sessionId: sid });
      }
      await db
        .from('owner_sessions')
        .update(sessionUpdate)
        .eq('session_id', sid);
      log('Updated session after trigger', { sessionId: sid, onboarding_state: sessionUpdate.onboarding_state ?? 'unchanged' });
    }

    return NextResponse.json({
      sessionId: response.sessionId,
      message: response.message,
      triggerMessage,
      extractedPreferences: response.extractedPreferences,
      profileCreated: response.profileCreated ?? false,
      boatCreated: response.boatCreated ?? false,
    });
  } catch (error: any) {
    log('Error', error?.message);
    logger.error('[trigger-profile-completion-owner]', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      {
        error: error?.message ?? 'Failed to start profile completion',
        userMessage: 'Something went wrong. Please refresh and try again.',
      },
      { status: 500 }
    );
  }
}
