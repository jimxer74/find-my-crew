import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { chat, ChatRequest } from '@/app/lib/ai/assistant';
import { canSendAIMessage } from '@/app/lib/limits';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[API Chat Route] ${message}`, data !== undefined ? data : '');
  }
};

export const maxDuration = 60; // Allow up to 60 seconds for AI responses

export async function POST(request: NextRequest) {
  log('=== POST /api/ai/assistant/chat ===');
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
              // Read-only in route handlers
            }
          },
        },
      }
    );

    // Verify authentication
    log('Verifying authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      log('Authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    log('User authenticated:', { userId: user.id, email: user.email });

    // Check AI message limit
    const limitCheck = await canSendAIMessage(supabase, user.id);
    if (!limitCheck.allowed) {
      log('AI message limit reached:', { current: limitCheck.current, limit: limitCheck.limit });
      return NextResponse.json(
        {
          error: 'Daily message limit reached',
          errorType: 'daily_limit_reached',
          userMessage: limitCheck.message,
          current: limitCheck.current,
          limit: limitCheck.limit,
        },
        { status: 429 }
      );
    }
    log('AI message limit check passed:', { current: limitCheck.current, limit: limitCheck.limit });

    // Parse request body
    const body: ChatRequest = await request.json();
    log('Request body parsed:', { messageLength: body.message?.length, conversationId: body.conversationId });

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

    if (message.length > 10000) {
      return NextResponse.json(
        { error: 'Message is too long (max 10000 characters)' },
        { status: 400 }
      );
    }

    // Process chat
    log('Calling chat service...');
    const response = await chat(
      supabase,
      { message, conversationId: body.conversationId },
      { userId: user.id, conversationId: body.conversationId }
    );

    log('Chat response received:', {
      conversationId: response.conversationId,
      messageId: response.message?.id,
      pendingActionsCount: response.pendingActions?.length
    });
    log('=== Chat completed successfully ===');
    return NextResponse.json(response);
  } catch (error: any) {
    log('ERROR in chat route:', error.message);
    logger.error('AI Assistant chat error:', error);

    // Classify and handle specific errors with user-friendly messages
    const errorMessage = error.message || '';
    const errorName = error.name || '';

    // Consent errors
    if (errorMessage.includes('consent')) {
      return NextResponse.json(
        {
          error: error.message,
          errorType: 'consent_required',
          userMessage: 'AI processing consent is required. Please update your privacy settings to use the assistant.'
        },
        { status: 403 }
      );
    }

    // Rate limit errors
    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('rate_limit') ||
        errorMessage.includes('429') ||
        errorMessage.includes('too many requests')) {
      return NextResponse.json(
        {
          error: 'AI service rate limit exceeded',
          errorType: 'rate_limit',
          userMessage: 'The AI service is currently busy. Please wait a moment and try again.',
          retryAfter: 30
        },
        { status: 429 }
      );
    }

    // Timeout errors
    if (errorMessage.includes('timeout') ||
        errorName === 'AbortError' ||
        errorName === 'TimeoutError') {
      return NextResponse.json(
        {
          error: 'AI service timeout',
          errorType: 'timeout',
          userMessage: 'The AI service took too long to respond. Please try again.'
        },
        { status: 504 }
      );
    }

    // Network errors
    if (errorMessage.includes('fetch failed') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') ||
        errorName === 'TypeError') {
      return NextResponse.json(
        {
          error: 'AI service connection failed',
          errorType: 'network_error',
          userMessage: 'Unable to connect to the AI service. Please check your internet connection and try again.'
        },
        { status: 503 }
      );
    }

    // API key / configuration errors
    if (errorMessage.includes('API key') ||
        errorMessage.includes('not configured') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401')) {
      return NextResponse.json(
        {
          error: 'AI service configuration error',
          errorType: 'config_error',
          userMessage: 'The AI service is temporarily unavailable. Our team has been notified.'
        },
        { status: 503 }
      );
    }

    // All providers failed
    if (errorMessage.includes('All AI providers failed')) {
      return NextResponse.json(
        {
          error: 'All AI services unavailable',
          errorType: 'service_unavailable',
          userMessage: 'All AI services are currently unavailable. Please try again in a few minutes.'
        },
        { status: 503 }
      );
    }

    // Quota / billing errors
    if (errorMessage.includes('quota') ||
        errorMessage.includes('billing') ||
        errorMessage.includes('insufficient')) {
      return NextResponse.json(
        {
          error: 'AI service quota exceeded',
          errorType: 'quota_exceeded',
          userMessage: 'The AI service limit has been reached. Please try again later.'
        },
        { status: 503 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        error: errorMessage || 'Failed to process message',
        errorType: 'unknown_error',
        userMessage: 'Something went wrong with the AI assistant. Please try again.'
      },
      { status: 500 }
    );
  }
}
