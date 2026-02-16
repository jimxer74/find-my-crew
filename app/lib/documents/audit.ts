/**
 * Audit logging helper for document vault access events
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentAccessType } from './types';

interface AuditLogParams {
  documentId: string | null;
  documentOwnerId: string;
  accessedBy: string;
  accessType: DocumentAccessType;
  accessGranted: boolean;
  denialReason?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an access event to the document_access_log table.
 * Failures are logged but never thrown — audit logging must not break the main flow.
 */
export async function logDocumentAccess(
  supabase: SupabaseClient,
  params: AuditLogParams
): Promise<void> {
  try {
    const { error } = await supabase.from('document_access_log').insert({
      document_id: params.documentId,
      document_owner_id: params.documentOwnerId,
      accessed_by: params.accessedBy,
      access_type: params.accessType,
      access_granted: params.accessGranted,
      denial_reason: params.denialReason ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      details: params.details ?? {},
    });

    if (error) {
      console.error('[DocumentAudit] Failed to log access event:', error);
    }
  } catch (err) {
    console.error('[DocumentAudit] Exception logging access event:', err);
  }
}

/**
 * Extract IP address from NextRequest headers
 */
export function getClientIp(headers: Headers): string | undefined {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined
  );
}
