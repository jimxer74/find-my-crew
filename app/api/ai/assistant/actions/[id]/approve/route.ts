import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { executeAction } from '@/app/lib/ai/assistant';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[API Approve Action] ${message}`, data !== undefined ? data : '');
  }
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/ai/assistant/actions/[id]/approve - Approve and execute action
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    log('=== Approving action ===', { actionId: id });
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
              // Read-only
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the action
    const { data: action, error: fetchError } = await supabase
      .from('ai_pending_actions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !action) {
      log('Action not found:', id);
      return NextResponse.json(
        { error: 'Action not found' },
        { status: 404 }
      );
    }

    log('Found action:', { actionType: action.action_type, status: action.status });

    // Execute the action
    log('Executing action...');
    const result = await executeAction(action, {
      supabase,
      userId: user.id,
    });

    if (!result.success) {
      log('Action execution failed:', result.error);
      return NextResponse.json(
        { error: result.message, code: result.error },
        { status: 400 }
      );
    }

    log('=== Action approved and executed successfully ===');
    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error: any) {
    log('ERROR:', error.message);
    console.error('Approve action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve action' },
      { status: 500 }
    );
  }
}
