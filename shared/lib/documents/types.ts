/**
 * TypeScript types for the Secure Document Vault
 */

// Valid document categories
export type DocumentCategory =
  | 'passport'
  | 'drivers_license'
  | 'national_id'
  | 'sailing_license'
  | 'certification'
  | 'insurance'
  | 'boat_registration'
  | 'medical'
  | 'other';

// Valid grant purposes
export type GrantPurpose =
  | 'journey_registration'
  | 'identity_verification'
  | 'insurance_proof'
  | 'certification_check'
  | 'other';

// Valid access types for audit log
export type DocumentAccessType =
  | 'upload'
  | 'view'
  | 'delete'
  | 'grant_create'
  | 'grant_revoke'
  | 'classify'
  | 'metadata_update';

// AI-extracted metadata stored in document_vault.metadata JSONB
export interface DocumentMetadata {
  document_number?: string;
  holder_name?: string;
  expiry_date?: string;       // ISO date string YYYY-MM-DD
  issue_date?: string;        // ISO date string YYYY-MM-DD
  issuing_authority?: string;
  issuing_country?: string;   // ISO 3166-1 alpha-2
  [key: string]: unknown;     // Allow additional AI-extracted fields
}

// document_vault table row
export interface DocumentVault {
  id: string;
  owner_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: DocumentCategory | null;
  subcategory: string | null;
  classification_confidence: number | null;
  metadata: DocumentMetadata;
  description: string | null;
  file_hash: string | null;
  created_at: string;
  updated_at: string;
}

// document_access_grants table row
export interface DocumentAccessGrant {
  id: string;
  document_id: string;
  grantor_id: string;
  grantee_id: string;
  purpose: GrantPurpose;
  purpose_reference_id: string | null;
  access_level: 'view_only';
  expires_at: string;
  max_views: number | null;
  view_count: number;
  is_revoked: boolean;
  revoked_at: string | null;
  created_at: string;
}

// document_access_log table row
export interface DocumentAccessLog {
  id: string;
  document_id: string | null;
  document_owner_id: string | null;
  accessed_by: string | null;
  access_type: DocumentAccessType;
  access_granted: boolean;
  denial_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

// AI classification result
export interface DocumentClassificationResult {
  category: DocumentCategory;
  subcategory: string | null;
  confidence: number;
  extracted_metadata: DocumentMetadata;
}

// Allowed MIME types for upload
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

// Max file size: 10MB
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

// Max uploads per hour
export const MAX_UPLOADS_PER_HOUR = 10;

// Signed URL expiry in seconds (5 minutes)
export const SIGNED_URL_EXPIRY_SECONDS = 300;

// Max grant duration in days
export const MAX_GRANT_DURATION_DAYS = 30;
