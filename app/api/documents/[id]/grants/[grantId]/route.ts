import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { logDocumentAccess, getClientIp } from '@/app/lib/documents/audit';

type RouteParams = { params: Promise<{ id: string; grantId: string }> };

/**
 * DELETE /api/documents/[id]/grants/[grantId]
 *
 * Revoke an access grant (sets is_revoked = true).
 * Only the grantor (document owner) can revoke.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId, grantId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS enforces grantor_id = auth.uid()
    const { data: grant, error: fetchError } = await supabase
      .from('document_access_grants')
      .select('id, document_id, grantor_id, grantee_id, is_revoked')
      .eq('id', grantId)
      .eq('document_id', documentId)
      .eq('grantor_id', user.id)
      .single();

    if (fetchError || !grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    if (grant.is_revoked) {
      return NextResponse.json({ error: 'Grant is already revoked' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('document_access_grants')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', grantId);

    if (updateError) {
      logger.error('[GrantRevoke] Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to revoke grant', details: updateError.message },
        { status: 500 }
      );
    }

    await logDocumentAccess(supabase, {
      documentId,
      documentOwnerId: user.id,
      accessedBy: user.id,
      accessType: 'grant_revoke',
      accessGranted: true,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
      details: { grant_id: grantId, grantee_id: grant.grantee_id },
    });

    return NextResponse.json({ message: 'Grant revoked successfully' });
  } catch (error: unknown) {
    logger.error('[GrantRevoke] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
