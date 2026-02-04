import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/ai/assistant/actions/[id]/complete - Mark redirected action as completed
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Get the action to verify it exists and belongs to user
    const { data: action, error: fetchError } = await supabase
      .from('ai_pending_actions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !action) {
      return NextResponse.json(
        { error: 'Action not found' },
        { status: 404 }
      );
    }


    // Mark action as completed (approved)
    const { error: updateError } = await supabase
      .from('ai_pending_actions')
      .update({
        status: 'approved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to complete action' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Action completed successfully',
      actionId: id
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  } catch (error: any) {
    console.error('Complete action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete action' },
      { status: 500 }
    );
  }
}