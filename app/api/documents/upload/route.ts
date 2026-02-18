import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { logDocumentAccess, getClientIp } from '@/app/lib/documents/audit';
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE,
  MAX_UPLOADS_PER_HOUR,
} from '@/app/lib/documents/types';

/**
 * POST /api/documents/upload
 *
 * Upload a document to the secure vault.
 * Authenticated users only — file goes to private storage bucket.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: count uploads in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentUploads, error: countError } = await supabase
      .from('document_access_log')
      .select('*', { count: 'exact', head: true })
      .eq('accessed_by', user.id)
      .eq('access_type', 'upload')
      .eq('access_granted', true)
      .gte('created_at', oneHourAgo);

    if (!countError && recentUploads !== null && recentUploads >= MAX_UPLOADS_PER_HOUR) {
      return NextResponse.json(
        { error: `Upload limit reached. Maximum ${MAX_UPLOADS_PER_HOUR} uploads per hour.` },
        { status: 429 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const description = formData.get('description') as string | null;
    const category = formData.get('category') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type as typeof ALLOWED_DOCUMENT_TYPES[number])) {
      return NextResponse.json(
        { error: `Invalid file type "${file.type}". Allowed: PDF, JPG, PNG, WEBP.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_DOCUMENT_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Generate SHA-256 hash
    const fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Generate document ID and storage path
    const docId = crypto.randomUUID();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${docId}/${sanitizedName}`;

    // Upload to private storage bucket
    const { error: uploadError } = await supabase.storage
      .from('secure-documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '0',
        upsert: false,
      });

    if (uploadError) {
      console.error('[DocumentUpload] Storage upload failed:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    // Create document_vault record
    const { data: document, error: insertError } = await supabase
      .from('document_vault')
      .insert({
        id: docId,
        owner_id: user.id,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        category: category || null,
        description: description || null,
        file_hash: fileHash,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file on DB insert failure
      await supabase.storage.from('secure-documents').remove([filePath]);
      console.error('[DocumentUpload] DB insert failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to create document record', details: insertError.message },
        { status: 500 }
      );
    }

    // Audit log
    await logDocumentAccess(supabase, {
      documentId: docId,
      documentOwnerId: user.id,
      accessedBy: user.id,
      accessType: 'upload',
      accessGranted: true,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
      details: { file_name: file.name, file_size: file.size, file_type: file.type },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    console.error('[DocumentUpload] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
