import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    // Create Supabase client with service role for reading public data
    // No auth required for prospect chat
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Parse request body
    const body: ProspectChatRequest = await request.json();
    log('Request body parsed:', {
      messageLength: body.message?.length,
      sessionId: body.sessionId,
      historyLength: body.conversationHistory?.length || 0,
    });

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
    });

    log('Prospect chat response received:', {
      sessionId: response.sessionId,
      messageId: response.message?.id,
    });

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
