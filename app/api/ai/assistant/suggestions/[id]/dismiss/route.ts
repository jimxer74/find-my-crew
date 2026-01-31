import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/ai/assistant/suggestions/[id]/dismiss - Dismiss a suggestion
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

    // Update suggestion to dismissed
    const { error } = await supabase
      .from('ai_suggestions')
      .update({ dismissed: true })
      .eq('id', id)
      .eq('user_id', user.id); // Ensure user owns the suggestion

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Dismiss suggestion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to dismiss suggestion' },
      { status: 500 }
    );
  }
}
