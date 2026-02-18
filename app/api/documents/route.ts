import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * GET /api/documents
 *
 * List all documents owned by the authenticated user.
 * Supports optional filtering by category and search by name.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('document_vault')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`file_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: documents, count, error } = await query;

    if (error) {
      logger.error('[Documents] List query failed:', { error });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Request failed'),
        { status: 500 }
      );
    }

    return NextResponse.json({
      documents: documents || [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error('[Documents] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
