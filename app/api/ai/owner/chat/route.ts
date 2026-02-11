import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ownerChat } from '@/app/lib/ai/owner/service';
import { OwnerChatRequest } from '@/app/lib/ai/owner/types';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[API Owner Chat Route] ${message}`, data !== undefined ? data : '');
  }
};

export const maxDuration = 60; // Allow up to 60 seconds for AI responses

export async function POST(request: NextRequest) {
  log('=== POST /api/ai/owner/chat ===');

  try {
    // Parse request body
    const body: OwnerChatRequest = await request.json();
    log('Request body parsed:', {
      messageLength: body.message?.length,
      sessionId: body.sessionId,
      historyLength: body.conversationHistory?.length || 0,
      profileCompletionMode: body.profileCompletionMode,
      userId: body.userId,
    });

    // Create Supabase client (supports both authenticated and unauthenticated)
    const cookieStore = await cookies();
    let supabase = createServerClient(
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
              // Server component - cookies handled by middleware
            }
          },
        },
      }
    );

    // Check if user is authenticated (optional for owner chat)
    let authenticatedUserId: string | null = null;
    let userProfile: OwnerChatRequest['userProfile'] = null;

    if (body.userId) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (user && !authError && user.id === body.userId) {
          authenticatedUserId = user.id;
          userProfile = body.userProfile || {
            fullName: user.user_metadata?.full_name || user.user_metadata?.name || null,
            email: user.email || null,
            phone: user.phone || null,
            avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          };
          log('Authenticated user', { userId: authenticatedUserId, profileCompletionMode: body.profileCompletionMode });
        } else {
          log('User authentication failed or user ID mismatch');
        }
      } catch (authErr) {
        log('Auth check error (user may not be authenticated):', authErr);
        // Continue without authentication - user can chat but can't perform actions
      }
    } else {
      log('No userId provided - proceeding as unauthenticated user');
    }

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Trim and validate message length
    const message = body.message.trim();
    if (message.length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Process chat
    log('Calling owner chat service...');
    const response = await ownerChat(supabase, {
      sessionId: body.sessionId,
      message,
      conversationHistory: body.conversationHistory,
      gatheredPreferences: body.gatheredPreferences,
      profileCompletionMode: body.profileCompletionMode,
      authenticatedUserId,
      userProfile,
      approvedAction: body.approvedAction,
    });

    log('Owner chat response received:', {
      sessionId: response.sessionId,
      messageId: response.message?.id,
      profileCreated: response.profileCreated,
      boatCreated: response.boatCreated,
      journeyCreated: response.journeyCreated,
    });

    log('=== Owner chat completed successfully ===');
    return NextResponse.json(response);
  } catch (error: any) {
    log('ERROR in owner chat route:', error.message);
    console.error('Owner chat error:', error);

    const errorMessage = error.message || '';

    // Rate limit errors
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429') ||
      errorMessage.includes('too many requests')
    ) {
      return NextResponse.json(
        {
          error: 'AI service rate limit exceeded',
          errorType: 'rate_limit',
          userMessage: 'The AI service is currently busy. Please wait a moment and try again.',
          retryAfter: 30,
        },
        { status: 429 }
      );
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || error.name === 'AbortError') {
      return NextResponse.json(
        {
          error: 'AI service timeout',
          errorType: 'timeout',
          userMessage: 'The AI service took too long to respond. Please try again.',
        },
        { status: 504 }
      );
    }

    // Network errors
    if (
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('network') ||
      errorMessage.includes('ECONNREFUSED')
    ) {
      return NextResponse.json(
        {
          error: 'AI service connection failed',
          errorType: 'network_error',
          userMessage: 'Unable to connect to the AI service. Please check your internet connection.',
        },
        { status: 503 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        error: errorMessage || 'Failed to process message',
        errorType: 'unknown_error',
        userMessage: 'Something went wrong. Please try again.',
      },
      { status: 500 }
    );
  }
}
