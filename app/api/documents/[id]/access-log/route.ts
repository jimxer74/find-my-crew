import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/[id]/access-log
 *
 * View the immutable access audit log for a document (owner only).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify document ownership via RLS
    const { data: document } = await supabase
      .from('document_vault')
      .select('id')
      .eq('id', documentId)
      .single();

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // RLS enforces document_owner_id = auth.uid()
    const { data: logs, count, error } = await supabase
      .from('document_access_log')
      .select(`
        *,
        accessor:profiles!document_access_log_accessed_by_fkey (
          id,
          full_name,
          username
        )
      `, { count: 'exact' })
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[AccessLog] Query failed:', { error });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Request failed'),
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs: logs || [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error('[AccessLog] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
