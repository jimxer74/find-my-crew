import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from '@/app/lib/supabaseServer';
import { classifyDocument } from '@/app/lib/ai/documents/classification-service';
import { logDocumentAccess, getClientIp } from '@/app/lib/documents/audit';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/documents/[id]/classify
 *
 * Classify a document using AI vision.
 * Requires AI processing consent. Owner only.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check AI processing consent
    const { data: consents } = await supabase
      .from('user_consents')
      .select('ai_processing_consent')
      .eq('user_id', user.id)
      .single();

    if (!consents?.ai_processing_consent) {
      return NextResponse.json(
        { error: 'AI processing consent is required for document classification' },
        { status: 403 }
      );
    }

    // Fetch document (RLS enforces ownership)
    const { data: document, error: fetchError } = await supabase
      .from('document_vault')
      .select('id, file_path, file_type, owner_id')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Download the file using service role (to get the actual file bytes)
    const serviceClient = getSupabaseServiceRoleClient();
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from('secure-documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      logger.error('[Classify] File download failed:', { error: downloadError });
      return NextResponse.json(
        { error: 'Failed to access document file' },
        { status: 500 }
      );
    }

    // Convert to base64 for AI vision
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Call AI classification
    const classification = await classifyDocument(base64, document.file_type);

    // Update document with classification results
    const { data: updatedDoc, error: updateError } = await supabase
      .from('document_vault')
      .update({
        category: classification.category,
        subcategory: classification.subcategory,
        classification_confidence: classification.confidence,
        metadata: classification.extracted_metadata,
      })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      logger.error('[Classify] Update failed:', { error: updateError });
      return NextResponse.json(
        { error: 'Classification succeeded but failed to save results' },
        { status: 500 }
      );
    }

    // Audit log
    await logDocumentAccess(supabase, {
      documentId,
      documentOwnerId: user.id,
      accessedBy: user.id,
      accessType: 'classify',
      accessGranted: true,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
      details: {
        category: classification.category,
        confidence: classification.confidence,
      },
    });

    return NextResponse.json({
      classification,
      document: updatedDoc,
    });
  } catch (error: unknown) {
    logger.error('[Classify] Unexpected error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Classification failed', details: message },
      { status: 500 }
    );
  }
}
