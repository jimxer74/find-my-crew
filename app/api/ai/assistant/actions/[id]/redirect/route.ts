import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/ai/assistant/actions/[id]/redirect - Mark action as redirected
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

    // Get the action
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

    // Mark action as immediately completed
    const { error: updateError } = await supabase
      .from('ai_pending_actions')
      .update({
        status: 'approved'
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error marking action as redirected:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark action as redirected' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Action marked as redirected successfully',
      actionId: id
    });
  } catch (error: any) {
    console.error('Redirect action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to redirect action' },
      { status: 500 }
    );
  }
}