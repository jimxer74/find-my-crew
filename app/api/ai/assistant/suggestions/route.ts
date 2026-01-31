import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/ai/assistant/suggestions - List user's suggestions
export async function GET(request: NextRequest) {
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
          setAll() {},
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

    const searchParams = request.nextUrl.searchParams;
    const includeDismissed = searchParams.get('includeDismissed') === 'true';
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let query = supabase
      .from('ai_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!includeDismissed) {
      query = query.eq('dismissed', false);
    }

    if (type) {
      query = query.eq('suggestion_type', type);
    }

    const { data: suggestions, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      suggestions: suggestions || [],
      count: suggestions?.length || 0,
    });
  } catch (error: any) {
    console.error('List suggestions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list suggestions' },
      { status: 500 }
    );
  }
}
