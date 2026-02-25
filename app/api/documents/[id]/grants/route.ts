import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { logDocumentAccess, getClientIp } from '@shared/lib/documents/audit';
import { MAX_GRANT_DURATION_DAYS } from '@shared/lib/documents/types';
import type { GrantPurpose } from '@shared/lib/documents/types';

type RouteParams = { params: Promise<{ id: string }> };

const VALID_PURPOSES: GrantPurpose[] = [
  'journey_registration',
  'identity_verification',
  'insurance_proof',
  'certification_check',
  'other',
];

/**
 * GET /api/documents/[id]/grants
 *
 * List all access grants for a document (owner only).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership via RLS
    const { data: document } = await supabase
      .from('document_vault')
      .select('id')
      .eq('id', documentId)
      .single();

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Fetch all grants for this document
    const { data: grants, error } = await supabase
      .from('document_access_grants')
      .select('*')
      .eq('document_id', documentId)
      .eq('grantor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[DocumentGrants] List query failed:', {
        error: error.message,
        code: error.code,
        documentId,
        userId: user.id,
      });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Request failed'),
        { status: 500 }
      );
    }

    logger.info('[DocumentGrants] GET successful:', {
      documentId,
      grantsCount: grants?.length || 0,
      userId: user.id,
    });

    return NextResponse.json({ grants: grants || [] });
  } catch (error: unknown) {
    logger.error('[DocumentGrants] GET error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/documents/[id]/grants
 *
 * Create a new access grant for a document (owner only).
 *
 * Body: { grantee_id, purpose, purpose_reference_id?, expires_at, max_views? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: document } = await supabase
      .from('document_vault')
      .select('id, owner_id')
      .eq('id', documentId)
      .single();

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = await request.json();
    const { grantee_id, purpose, purpose_reference_id, expires_at, max_views } = body;

    // Validate required fields
    if (!grantee_id || !purpose || !expires_at) {
      return NextResponse.json(
        { error: 'Missing required fields: grantee_id, purpose, expires_at' },
        { status: 400 }
      );
    }

    // Validate purpose
    if (!VALID_PURPOSES.includes(purpose)) {
      return NextResponse.json(
        { error: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate no self-grant
    if (grantee_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot grant access to yourself' },
        { status: 400 }
      );
    }

    // Validate expiry
    const expiresDate = new Date(expires_at);
    const now = new Date();
    const maxExpiry = new Date(now.getTime() + MAX_GRANT_DURATION_DAYS * 24 * 60 * 60 * 1000);

    if (expiresDate <= now) {
      return NextResponse.json(
        { error: 'Expiry date must be in the future' },
        { status: 400 }
      );
    }

    if (expiresDate > maxExpiry) {
      return NextResponse.json(
        { error: `Maximum grant duration is ${MAX_GRANT_DURATION_DAYS} days` },
        { status: 400 }
      );
    }

    // Validate grantee exists
    const { data: granteeProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', grantee_id)
      .single();

    if (!granteeProfile) {
      return NextResponse.json({ error: 'Grantee user not found' }, { status: 404 });
    }

    // Validate max_views if provided
    if (max_views !== undefined && max_views !== null) {
      if (!Number.isInteger(max_views) || max_views <= 0) {
        return NextResponse.json(
          { error: 'max_views must be a positive integer' },
          { status: 400 }
        );
      }
    }

    // Create grant (RLS INSERT policy checks document ownership)
    const { data: grant, error: insertError } = await supabase
      .from('document_access_grants')
      .insert({
        document_id: documentId,
        grantor_id: user.id,
        grantee_id,
        purpose,
        purpose_reference_id: purpose_reference_id || null,
        expires_at: expiresDate.toISOString(),
        max_views: max_views ?? null,
      })
      .select()
      .single();

    if (insertError) {
      // Check for unique constraint violation (duplicate active grant)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'An active grant already exists for this user, document, and purpose' },
          { status: 409 }
        );
      }
      logger.error('[DocumentGrants] Insert failed:', { error: insertError });
      return NextResponse.json(
        { error: 'Failed to create grant', details: insertError.message },
        { status: 500 }
      );
    }

    // Audit log
    await logDocumentAccess(supabase, {
      documentId,
      documentOwnerId: user.id,
      accessedBy: user.id,
      accessType: 'grant_create',
      accessGranted: true,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
      details: { grant_id: grant.id, grantee_id, purpose, expires_at: grant.expires_at },
    });

    // Create notification for grantee
    try {
      await supabase.from('notifications').insert({
        user_id: grantee_id,
        type: 'document_shared',
        title: 'Document shared with you',
        message: `A document has been shared with you for ${purpose.replace(/_/g, ' ')}.`,
        metadata: { document_id: documentId, grant_id: grant.id, purpose },
      });
    } catch {
      // Non-critical — don't fail the grant creation
    }

    return NextResponse.json({ grant }, { status: 201 });
  } catch (error: unknown) {
    logger.error('[DocumentGrants] POST error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
