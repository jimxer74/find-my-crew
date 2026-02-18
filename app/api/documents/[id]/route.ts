import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { logDocumentAccess, getClientIp } from '@/app/lib/documents/audit';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/[id]
 *
 * Get full details for a single document owned by the user.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS enforces owner_id = auth.uid()
    const { data: document, error } = await supabase
      .from('document_vault')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error: unknown) {
    console.error('[Document] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/documents/[id]
 *
 * Update document metadata (description, category, subcategory, metadata).
 * Does NOT allow changing file_path, owner_id, or file_hash.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Whitelist allowed fields
    const allowedFields = ['description', 'category', 'subcategory', 'metadata'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // RLS enforces ownership
    const { data: document, error } = await supabase
      .from('document_vault')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found or update failed' }, { status: 404 });
    }

    await logDocumentAccess(supabase, {
      documentId: id,
      documentOwnerId: user.id,
      accessedBy: user.id,
      accessType: 'metadata_update',
      accessGranted: true,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
      details: { updated_fields: Object.keys(updateData) },
    });

    return NextResponse.json({ document });
  } catch (error: unknown) {
    console.error('[Document] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[id]
 *
 * Delete a document and its storage file. Cascades to grants.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch document first to get file_path (RLS enforces ownership)
    const { data: document, error: fetchError } = await supabase
      .from('document_vault')
      .select('id, file_path, owner_id')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('secure-documents')
      .remove([document.file_path]);

    if (storageError) {
      console.error('[Document] Storage delete failed:', storageError);
      // Continue with DB delete even if storage fails — don't leave orphaned records
    }

    // Delete record (cascades to grants)
    const { error: deleteError } = await supabase
      .from('document_vault')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Document] DB delete failed:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete document', details: deleteError.message },
        { status: 500 }
      );
    }

    // Audit log (document_id will be SET NULL since document is deleted)
    await logDocumentAccess(supabase, {
      documentId: null,
      documentOwnerId: user.id,
      accessedBy: user.id,
      accessType: 'delete',
      accessGranted: true,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
      details: { deleted_document_id: id, file_path: document.file_path },
    });

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error: unknown) {
    console.error('[Document] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
