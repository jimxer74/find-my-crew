import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';

/**
 * GET /api/documents/shared
 *
 * List documents shared with the authenticated user via active grants.
 * Returns only active, non-expired, non-revoked grants with basic document info.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // RLS allows grantee to see grants shared with them
    const { data: grants, error } = await supabase
      .from('document_access_grants')
      .select(`
        id,
        purpose,
        purpose_reference_id,
        expires_at,
        max_views,
        view_count,
        created_at,
        grantor:profiles!document_access_grants_grantor_id_fkey (
          id,
          full_name,
          username,
          profile_image_url
        ),
        document_vault!inner (
          id,
          file_name,
          file_type,
          category,
          description
        )
      `)
      .eq('grantee_id', user.id)
      .eq('is_revoked', false)
      .gte('expires_at', now)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[SharedDocuments] Query failed:', { error });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Request failed'),
        { status: 500 }
      );
    }

    // Filter out grants that have exceeded their view limit
    const activeGrants = (grants || []).filter(g =>
      g.max_views === null || g.view_count < g.max_views
    );

    return NextResponse.json({ shared_documents: activeGrants });
  } catch (error: unknown) {
    logger.error('[SharedDocuments] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
