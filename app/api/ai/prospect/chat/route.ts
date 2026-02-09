import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prospectChat } from '@/app/lib/ai/prospect/service';
import { ProspectChatRequest } from '@/app/lib/ai/prospect/types';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[API Prospect Chat Route] ${message}`, data !== undefined ? data : '');
  }
};

export const maxDuration = 60; // Allow up to 60 seconds for AI responses

export async function POST(request: NextRequest) {
  log('=== POST /api/ai/prospect/chat ===');

  try {
    // Parse request body first to check for profile completion mode
    const body: ProspectChatRequest = await request.json();
    log('Request body parsed:', {
      messageLength: body.message?.length,
      sessionId: body.sessionId,
      historyLength: body.conversationHistory?.length || 0,
      profileCompletionMode: body.profileCompletionMode,
      userId: body.userId,
    });

    let supabase;
    let authenticatedUserId: string | null = null;

    // Check if profile completion mode with authenticated user
    if (body.profileCompletionMode && body.userId) {
      // Create authenticated Supabase client
      const cookieStore = await cookies();
      supabase = createServerClient(
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

      // Verify the user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === body.userId) {
        authenticatedUserId = user.id;
        log('Authenticated user for profile completion:', authenticatedUserId);
      } else {
        log('User authentication failed for profile completion mode');
      }
    } else {
      // Create Supabase client with service role for reading public data
      // No auth required for regular prospect chat
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
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
    log('Calling prospect chat service...');
    const response = await prospectChat(supabase, {
      sessionId: body.sessionId,
      message,
      conversationHistory: body.conversationHistory,
      gatheredPreferences: body.gatheredPreferences,
      // Include profile completion context if authenticated
      profileCompletionMode: body.profileCompletionMode,
      authenticatedUserId,
      userProfile: body.userProfile,
      // Approved action from user confirmation
      approvedAction: body.approvedAction,
    });

    log('Prospect chat response received:', {
      sessionId: response.sessionId,
      messageId: response.message?.id,
      hasLegReferences: !!response.message?.metadata?.legReferences,
      legReferencesCount: response.message?.metadata?.legReferences?.length || 0,
    });

    // Debug: Log leg references if present
    if (response.message?.metadata?.legReferences?.length) {
      log('Leg references:', response.message.metadata.legReferences.map(leg => ({
        id: leg.id,
        name: leg.name,
        hasJourneyImages: !!leg.journeyImages?.length,
        hasBoatImages: !!leg.boatImages?.length,
      })));
    }

    log('=== Prospect chat completed successfully ===');
    return NextResponse.json(response);
  } catch (error: any) {
    log('ERROR in prospect chat route:', error.message);
    console.error('Prospect chat error:', error);

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
