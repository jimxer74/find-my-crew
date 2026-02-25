import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from '@/app/lib/supabaseServer';
import { logDocumentAccess, getClientIp } from '@/app/lib/documents/audit';
import { SIGNED_URL_EXPIRY_SECONDS } from '@/app/lib/documents/types';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/[id]/view
 *
 * Generate a short-lived signed URL for viewing a document.
 * - Owner: always allowed
 * - Grantee: allowed if active grant exists (not expired, not revoked, view count ok)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;
    const supabase = await getSupabaseServerClient();
    const serviceClient = getSupabaseServiceRoleClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('[DocumentView] Access attempt:', { documentId, userId: user.id });

    // Try to fetch as owner first (RLS will return null if not owner)
    const { data: ownedDoc } = await supabase
      .from('document_vault')
      .select('id, file_path, file_name, file_type, owner_id')
      .eq('id', documentId)
      .single();

    const isOwner = !!ownedDoc;
    let filePath: string;
    let fileName: string = 'Document';
    let fileType: string = 'application/pdf';
    let documentOwnerId: string;

    if (isOwner) {
      logger.info('[DocumentView] Access granted - user is owner');
      filePath = ownedDoc.file_path;
      fileName = ownedDoc.file_name || 'Document';
      fileType = ownedDoc.file_type || 'application/pdf';
      documentOwnerId = ownedDoc.owner_id;
    } else {
      // Check for active grant — fetch grant first without joins
      const now = new Date().toISOString();
      const { data: grant, error: grantError } = await supabase
        .from('document_access_grants')
        .select('id, document_id, grantor_id, max_views, view_count, expires_at, is_revoked')
        .eq('document_id', documentId)
        .eq('grantee_id', user.id)
        .eq('is_revoked', false)
        .gte('expires_at', now)
        .limit(1)
        .single();

      logger.info('[DocumentView] Grant query result:', {
        hasGrant: !!grant,
        error: grantError?.message,
        documentId,
        userId: user.id,
      });

      if (grantError || !grant) {
        logger.info('[DocumentView] Access denied - no active grant found');
        await logDocumentAccess(supabase, {
          documentId,
          documentOwnerId: user.id, // best effort
          accessedBy: user.id,
          accessType: 'view',
          accessGranted: false,
          denialReason: 'No active grant found',
          ipAddress: getClientIp(request.headers),
          userAgent: request.headers.get('user-agent') || undefined,
        });
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Check view count limit
      if (grant.max_views !== null && grant.view_count >= grant.max_views) {
        logger.info('[DocumentView] Access denied - view limit exceeded');
        await logDocumentAccess(supabase, {
          documentId,
          documentOwnerId: grant.grantor_id,
          accessedBy: user.id,
          accessType: 'view',
          accessGranted: false,
          denialReason: 'View count limit exceeded',
          ipAddress: getClientIp(request.headers),
          userAgent: request.headers.get('user-agent') || undefined,
        });
        return NextResponse.json(
          { error: 'View limit reached for this document' },
          { status: 403 }
        );
      }

      // Now fetch the document using service role (bypasses RLS)
      const { data: doc, error: docError } = await serviceClient
        .from('document_vault')
        .select('id, file_path, file_name, file_type, owner_id')
        .eq('id', documentId)
        .single();

      if (docError || !doc) {
        logger.error('[DocumentView] Failed to fetch document via service role:', { error: docError });
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      filePath = doc.file_path;
      fileName = doc.file_name || 'Document';
      fileType = doc.file_type || 'application/pdf';
      documentOwnerId = doc.owner_id;
      
      logger.info('[DocumentView] Access granted via grant:', {
        grantId: grant.id,
        documentOwnerId,
      });

      // Increment view count
      await supabase
        .from('document_access_grants')
        .update({ view_count: grant.view_count + 1 })
        .eq('id', grant.id);
    }

    // Generate signed URL using service role client (bypasses storage RLS)
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from('secure-documents')
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      if (signedUrlError) {
        logger.error('[DocumentView] Failed to create signed URL:', { error: signedUrlError.message });
      }
      return NextResponse.json(
        { error: 'Failed to generate viewing URL' },
        { status: 500 }
      );
    }

    // Audit log
    await logDocumentAccess(supabase, {
      documentId,
      documentOwnerId,
      accessedBy: user.id,
      accessType: 'view',
      accessGranted: true,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
      details: { is_owner: isOwner },
    });

    logger.info('[DocumentView] Signed URL generated successfully');

    return NextResponse.json({
      signedUrl: signedUrlData.signedUrl,
      expiresIn: SIGNED_URL_EXPIRY_SECONDS,
      fileName,
      fileType,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error: unknown) {
    logger.error('[DocumentView] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
