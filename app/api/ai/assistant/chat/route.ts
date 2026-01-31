import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { chat, ChatRequest } from '@/app/lib/ai/assistant';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[API Chat Route] ${message}`, data !== undefined ? data : '');
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
    console.error('AI Assistant chat error:', error);

    // Handle specific errors
    if (error.message?.includes('consent')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to process message' },
      { status: 500 }
    );
  }
}
