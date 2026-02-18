import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET /api/ai/assistant/actions - List pending actions
export async function GET(request: NextRequest) {
  logger.debug('[API] GET /api/ai/assistant/actions called');
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
      logger.info('[API] ❌ Unauthorized - no user');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    logger.info('[API] User authenticated', { userId: user.id });

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    logger.debug('[API] Query params', { status, limit });

    let query = supabase
      .from('ai_pending_actions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') {
      logger.debug('[API] Applying status filter', { status });
      query = query.eq('status', status);
    }

    const { data: actions, error } = await query;

    if (error) throw error;

    logger.debug('[API] Database query result', { count: actions?.length || 0 });

    return NextResponse.json({
      actions: actions || [],
      count: actions?.length || 0,
    });
  } catch (error: any) {
    logger.error('[API] Exception in GET /api/ai/assistant/actions', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error.message || 'Failed to list actions' },
      { status: 500 }
    );
  }
}
