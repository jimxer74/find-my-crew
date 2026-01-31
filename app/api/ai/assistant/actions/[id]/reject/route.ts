import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { rejectAction } from '@/app/lib/ai/assistant';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[API Reject Action] ${message}`, data !== undefined ? data : '');
  }
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/ai/assistant/actions/[id]/reject - Reject action
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    log('=== Rejecting action ===', { actionId: id });
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

    log('Calling rejectAction...');
    const result = await rejectAction(id, {
      supabase,
      userId: user.id,
    });

    if (!result.success) {
      log('Reject failed:', result.error);
      return NextResponse.json(
        { error: result.message, code: result.error },
        { status: 400 }
      );
    }

    log('=== Action rejected successfully ===');
    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    log('ERROR:', error.message);
    console.error('Reject action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reject action' },
      { status: 500 }
    );
  }
}
