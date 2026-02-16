-- Migration: 037_create_document_vault.sql
-- Purpose: Create secure document vault for sensitive user documents (passports, licenses, etc.)
-- Date: 2026-02-16
-- Tables: document_vault, document_access_grants, document_access_log
-- Storage: secure-documents (private bucket)

-- ============================================================================
-- STORAGE BUCKET: secure-documents (PRIVATE)
-- ============================================================================
-- NOTE: Create this bucket in Supabase Dashboard > Storage > New bucket
-- Name: secure-documents, Public: false
-- The bucket must be created manually; the SQL below sets up RLS policies only.

-- ============================================================================
-- TABLE: document_vault
-- ============================================================================

create table if not exists public.document_vault (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references auth.users(id) on delete cascade,
  file_path                 text not null,
  file_name                 text not null,
  file_type                 text not null,
  file_size                 integer not null,
  category                  text,
  subcategory               text,
  classification_confidence real,
  metadata                  jsonb default '{}'::jsonb,
  description               text,
  file_hash                 text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint document_vault_file_size_positive check (file_size > 0),
  constraint document_vault_file_size_max check (file_size <= 10485760),
  constraint document_vault_category_valid check (
    category is null or category in (
      'passport', 'drivers_license', 'national_id',
      'sailing_license', 'certification', 'insurance',
      'boat_registration', 'medical', 'other'
    )
  ),
  constraint document_vault_confidence_range check (
    classification_confidence is null
    or (classification_confidence >= 0.0 and classification_confidence <= 1.0)
  )
);

-- Indexes
create index if not exists idx_document_vault_owner_id on public.document_vault(owner_id);
create index if not exists idx_document_vault_category on public.document_vault(category) where category is not null;
create index if not exists idx_document_vault_created_at on public.document_vault(created_at desc);

-- Comments
comment on table public.document_vault is 'Secure document vault for sensitive user documents (passports, licenses, certifications, etc.)';
comment on column public.document_vault.file_path is 'Storage path in secure-documents bucket: {user_id}/{doc_id}/{filename}';
comment on column public.document_vault.category is 'AI-classified or user-selected document category';
comment on column public.document_vault.metadata is 'AI-extracted metadata: document_number, expiry_date, issuing_authority, holder_name, etc.';
comment on column public.document_vault.file_hash is 'SHA-256 hash of uploaded file for integrity verification';

-- Enable Row Level Security
alter table document_vault enable row level security;

-- Policies: owner-only access
create policy "Users can view own documents"
on document_vault for select
using (auth.uid() = owner_id);

create policy "Users can upload own documents"
on document_vault for insert
with check (auth.uid() = owner_id);

create policy "Users can update own documents"
on document_vault for update
using (auth.uid() = owner_id);

create policy "Users can delete own documents"
on document_vault for delete
using (auth.uid() = owner_id);

-- Trigger for updated_at
create or replace function update_document_vault_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_document_vault_updated_at
  before update on public.document_vault
  for each row
  execute function update_document_vault_updated_at();


-- ============================================================================
-- TABLE: document_access_grants
-- ============================================================================

create table if not exists public.document_access_grants (
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid not null references public.document_vault(id) on delete cascade,
  grantor_id            uuid not null references auth.users(id) on delete cascade,
  grantee_id            uuid not null references auth.users(id) on delete cascade,
  purpose               text not null,
  purpose_reference_id  uuid,
  access_level          text not null default 'view_only',
  expires_at            timestamptz not null,
  max_views             integer,
  view_count            integer not null default 0,
  is_revoked            boolean not null default false,
  revoked_at            timestamptz,
  created_at            timestamptz not null default now(),

  constraint document_access_grants_no_self_grant check (grantor_id != grantee_id),
  constraint document_access_grants_expires_future check (expires_at > created_at),
  constraint document_access_grants_max_duration check (expires_at <= created_at + interval '30 days'),
  constraint document_access_grants_purpose_valid check (
    purpose in (
      'journey_registration', 'identity_verification',
      'insurance_proof', 'certification_check', 'other'
    )
  ),
  constraint document_access_grants_access_level_valid check (
    access_level in ('view_only')
  ),
  constraint document_access_grants_view_count_positive check (view_count >= 0),
  constraint document_access_grants_max_views_positive check (max_views is null or max_views > 0)
);

-- Partial unique index: one active grant per document+grantee+purpose combo
create unique index if not exists idx_document_access_grants_unique_active
  on public.document_access_grants (document_id, grantee_id, purpose)
  where is_revoked = false;

-- Indexes
create index if not exists idx_document_access_grants_document_id on public.document_access_grants(document_id);
create index if not exists idx_document_access_grants_grantor_id on public.document_access_grants(grantor_id);
create index if not exists idx_document_access_grants_grantee_id on public.document_access_grants(grantee_id);
create index if not exists idx_document_access_grants_active on public.document_access_grants(grantee_id, is_revoked, expires_at)
  where is_revoked = false;

-- Comments
comment on table public.document_access_grants is 'Time-limited, purpose-bound access grants for shared document viewing';
comment on column public.document_access_grants.purpose_reference_id is 'Optional reference to related entity (e.g., journey_id)';
comment on column public.document_access_grants.max_views is 'Maximum number of views allowed. NULL = unlimited within expiry window';

-- Enable Row Level Security
alter table document_access_grants enable row level security;

-- Policies: grantor and grantee can see grants
create policy "Grantors can view their grants"
on document_access_grants for select
using (auth.uid() = grantor_id);

create policy "Grantees can view grants shared with them"
on document_access_grants for select
using (auth.uid() = grantee_id);

-- Only document owner (grantor) can create grants
create policy "Document owners can create grants"
on document_access_grants for insert
with check (
  auth.uid() = grantor_id
  and exists (
    select 1 from document_vault
    where document_vault.id = document_id
    and document_vault.owner_id = auth.uid()
  )
);

-- Only grantor can update (revoke) grants
create policy "Grantors can update their grants"
on document_access_grants for update
using (auth.uid() = grantor_id);

-- Only grantor can delete grants
create policy "Grantors can delete their grants"
on document_access_grants for delete
using (auth.uid() = grantor_id);


-- ============================================================================
-- TABLE: document_access_log (Immutable Audit Trail)
-- ============================================================================

create table if not exists public.document_access_log (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid references public.document_vault(id) on delete set null,
  document_owner_id uuid references auth.users(id) on delete set null,
  accessed_by       uuid references auth.users(id) on delete set null,
  access_type       text not null,
  access_granted    boolean not null,
  denial_reason     text,
  ip_address        text,
  user_agent        text,
  details           jsonb default '{}'::jsonb,
  created_at        timestamptz not null default now(),

  constraint document_access_log_type_valid check (
    access_type in (
      'upload', 'view', 'delete', 'grant_create',
      'grant_revoke', 'classify', 'metadata_update'
    )
  )
);

-- Indexes
create index if not exists idx_document_access_log_document_id on public.document_access_log(document_id);
create index if not exists idx_document_access_log_owner_id on public.document_access_log(document_owner_id);
create index if not exists idx_document_access_log_accessed_by on public.document_access_log(accessed_by);
create index if not exists idx_document_access_log_created_at on public.document_access_log(created_at desc);

-- Comments
comment on table public.document_access_log is 'Immutable audit trail for all document vault access events';
comment on column public.document_access_log.access_type is 'Event type: upload, view, delete, grant_create, grant_revoke, classify, metadata_update';
comment on column public.document_access_log.denial_reason is 'Reason for denied access (when access_granted = false)';

-- Enable Row Level Security
alter table document_access_log enable row level security;

-- Policies: document owner can view logs, authenticated users can insert
create policy "Document owners can view access logs"
on document_access_log for select
using (auth.uid() = document_owner_id);

create policy "Authenticated users can create access logs"
on document_access_log for insert
to authenticated
with check (true);

-- NO UPDATE or DELETE policies - audit logs are immutable


-- ============================================================================
-- STORAGE POLICIES: secure-documents bucket (PRIVATE)
-- ============================================================================
-- NOTE: Bucket must be created first in Supabase Dashboard with public = false

-- Owner can upload to their folder
create policy "Owners can upload secure documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner can read their own files
create policy "Owners can read own secure documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner can update their own files
create policy "Owners can update own secure documents"
on storage.objects for update
to authenticated
using (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner can delete their own files
create policy "Owners can delete own secure documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
