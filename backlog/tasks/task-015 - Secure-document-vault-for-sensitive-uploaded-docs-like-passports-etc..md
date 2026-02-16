---
id: TASK-015
title: 'Secure document vault for sensitive uploaded docs like passports, etc.'
status: In Progress
assignee: []
created_date: '2026-01-23 17:14'
updated_date: '2026-02-16 17:31'
labels:
  - security
  - storage
  - ai
  - gdpr
  - feature
dependencies: []
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Secure document vault for storing sensitive user documents (passports, licenses, certifications, insurance papers, boat registry certificates, etc.) with:

- **Private encrypted storage** (Supabase private bucket with signed URL access)
- **AI-powered auto-classification** on upload (document type, metadata extraction)
- **Granular access grants** (time-limited configurable, view-count-limited, purpose-bound sharing to other user or AI model)
- **Comprehensive audit logging** (immutable log of all access events)
- **Security hardening** (no downloads for grantees, short-lived signed URLs, watermarking)
- **GDPR compliance** (full deletion on account removal)

**User Roles in Context:**
- **Crew members**: Upload personal documents (passport, licenses, certifications)
- **Skippers/Owners**: Upload boat-related documents (insurance, registration, certificates) AND may request access to crew documents for journey compliance
- **Access flow**: Document owner explicitly grants time-limited view access to specific users or AI for specific purposes / use cases --> These would need to extendable, so that new use cases can be introduced later.

**Security Requirements:**
- Documents are NEVER publicly accessible
- Only the owner can see their documents by default
- Sharing is explicit, time-limited, purpose-bound, and revocable
- All access is audit-logged
- No download capability for grantees (view-only)
- Short-lived signed URLs (configurable time) for viewing
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can upload documents (PDF, JPG, PNG, WEBP) up to 10MB to a private secure storage bucket
- [ ] #2 AI automatically classifies uploaded documents by type and extracts metadata (document number, expiry date, issuing authority, etc.)
- [ ] #3 Users can view, manage, and delete their own documents from the vault
- [ ] #4 Document owners can grant time-limited view-only access to specific users for a specific purpose (max 30 days)
- [ ] #5 Grantees can view shared documents via short-lived signed URLs (5 min) in a secure viewer with no download capability
- [ ] #6 Document owners can revoke access grants at any time
- [ ] #7 All document access events are recorded in an immutable audit log viewable by the document owner
- [ ] #8 No user can access another user's documents without an explicit active grant
- [ ] #9 RLS policies enforce ownership on all document tables and storage bucket
- [ ] #10 GDPR account deletion removes all documents, grants, and storage files for the user
- [ ] #11 Rate limiting prevents abuse (max 10 uploads/hour)
- [ ] #12 File validation rejects invalid file types and oversized files at both client and server level
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Database Schema & Storage Infrastructure

#### Migration: `037_create_document_vault.sql`

**1. Private Storage Bucket**
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('secure-documents', 'secure-documents', false);
```
- Private bucket (NOT public like boat-images/journey-images)
- Folder structure: `{user_id}/{document_id}/{filename}`
- RLS policies: owner-only upload, read, delete
- No public read policy

**2. `document_vault` Table**
```
id              uuid PK default gen_random_uuid()
owner_id        uuid FK → auth.users(id) ON DELETE CASCADE
file_path       text NOT NULL (storage path in secure-documents bucket)
file_name       text NOT NULL (original filename)
file_type       text NOT NULL (mime type)
file_size       integer NOT NULL
category        text (passport | drivers_license | national_id | 
                      sailing_license | certification | insurance | 
                      boat_registration | medical | other)
subcategory     text (nullable, more specific classification)
classification_confidence  real (AI confidence 0.0-1.0)
metadata        jsonb DEFAULT '{}' (AI-extracted: document_number, 
                      expiry_date, issuing_authority, holder_name, etc.)
description     text (user-provided)
file_hash       text (SHA-256 for integrity verification)
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

**RLS Policies:**
- SELECT: `auth.uid() = owner_id`
- INSERT: `auth.uid() = owner_id` (enforced via WITH CHECK)
- UPDATE: `auth.uid() = owner_id` (metadata/description only)
- DELETE: `auth.uid() = owner_id`

**3. `document_access_grants` Table**
```
id                  uuid PK default gen_random_uuid()
document_id         uuid FK → document_vault(id) ON DELETE CASCADE
grantor_id          uuid FK → auth.users(id) ON DELETE CASCADE
grantee_id          uuid FK → auth.users(id) ON DELETE CASCADE
purpose             text NOT NULL (journey_registration | identity_verification | 
                          insurance_proof | certification_check | other)
purpose_reference_id uuid (nullable - e.g., journey_id for context)
access_level        text DEFAULT 'view_only' (view_only for now, extensible)
expires_at          timestamptz NOT NULL
max_views           integer (nullable = unlimited within expiry)
view_count          integer DEFAULT 0
is_revoked          boolean DEFAULT false
revoked_at          timestamptz
created_at          timestamptz DEFAULT now()
```

**Constraints:**
- CHECK: `expires_at > created_at`
- CHECK: `expires_at <= created_at + interval '30 days'` (max 30-day grants)
- CHECK: `grantor_id != grantee_id`
- UNIQUE: `(document_id, grantee_id, purpose, purpose_reference_id)` WHERE `is_revoked = false`

**RLS Policies:**
- SELECT: `auth.uid() = grantor_id OR auth.uid() = grantee_id`
- INSERT: `auth.uid() = grantor_id AND EXISTS(doc owned by grantor)`
- UPDATE: `auth.uid() = grantor_id` (only for revoking)
- DELETE: `auth.uid() = grantor_id`

**4. `document_access_log` Table** (Immutable Audit Trail)
```
id              uuid PK default gen_random_uuid()
document_id     uuid FK → document_vault(id) ON DELETE SET NULL
document_owner_id uuid FK → auth.users(id) ON DELETE SET NULL
accessed_by     uuid FK → auth.users(id) ON DELETE SET NULL
access_type     text NOT NULL (upload | view | delete | grant_create | 
                      grant_revoke | classify | metadata_update)
access_granted  boolean NOT NULL
denial_reason   text (if access_granted = false)
ip_address      text
user_agent      text
details         jsonb DEFAULT '{}' (additional context)
created_at      timestamptz DEFAULT now()
```

**RLS Policies:**
- INSERT: authenticated users (system logs via service role when needed)
- SELECT: `auth.uid() = document_owner_id` (owner sees all logs for their docs)
- NO UPDATE, NO DELETE (immutable)

**5. Storage Bucket RLS Policies**
```sql
-- Only owner can upload to their folder
CREATE POLICY "Owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'secure-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only owner can read their files (signed URLs generated server-side)
CREATE POLICY "Owner read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'secure-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only owner can delete
CREATE POLICY "Owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'secure-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

> **Note:** Grantees NEVER access storage directly. Server generates signed URLs using service role client for authorized grantee access.

---

### Phase 2: API Routes

#### Document Management APIs

**`POST /api/documents/upload`**
1. Auth check
2. Rate limit check (max 10 uploads/hour)
3. File validation (type whitelist: PDF, JPG, PNG, WEBP; max 10MB)
4. Generate SHA-256 hash of file
5. Upload to `secure-documents/{user_id}/{doc_id}/{sanitized_filename}`
6. Create `document_vault` record
7. Log upload in `document_access_log`
8. Trigger async AI classification (or classify inline)
9. Return document record

**`GET /api/documents`**
1. Auth check
2. Query `document_vault` WHERE `owner_id = user.id`
3. Support filtering by category, search by name/description
4. Return paginated list (RLS auto-enforces ownership)

**`GET /api/documents/[id]`**
1. Auth check
2. Fetch document record (RLS enforces ownership)
3. Return full document details with metadata

**`GET /api/documents/[id]/view`**
1. Auth check
2. Check if user is owner OR has valid active grant
3. If grant: check not expired, not revoked, view_count < max_views
4. Generate signed URL (5 min expiry) using **service role client**
5. Increment view_count if accessing via grant
6. Log view in `document_access_log`
7. Return `{ signedUrl, expiresIn: 300 }`

**`PATCH /api/documents/[id]`**
1. Auth check + ownership
2. Allow updating: description, category, subcategory, metadata
3. Do NOT allow changing: file_path, owner_id, file_hash
4. Log metadata_update in audit log

**`DELETE /api/documents/[id]`**
1. Auth check + ownership
2. Delete file from storage bucket
3. Delete document record (cascades to grants)
4. Log deletion in audit log

#### Access Grant APIs

**`POST /api/documents/[id]/grants`**
1. Auth check + document ownership
2. Validate: grantee exists, not self, purpose valid
3. Validate: expires_at ≤ 30 days from now
4. Check no duplicate active grant for same grantee+purpose
5. Create grant record
6. Log grant_create in audit log
7. Create notification for grantee (via existing notification system)

**`GET /api/documents/[id]/grants`**
1. Auth check + document ownership
2. Return all grants for document (active and revoked)

**`DELETE /api/documents/[id]/grants/[grantId]`**
1. Auth check + must be grantor
2. Set `is_revoked = true`, `revoked_at = now()`
3. Log grant_revoke in audit log

#### Classification API

**`POST /api/documents/[id]/classify`**
1. Auth check + document ownership
2. Check AI processing consent
3. Generate signed URL for AI to access the file
4. Call AI service with document image/PDF content
5. AI returns: category, subcategory, confidence, extracted metadata
6. Update document_vault record
7. Log classify in audit log
8. Return classification results for user review

#### Shared Document Access (for grantees)

**`GET /api/documents/shared`**
1. Auth check
2. Query active, non-expired, non-revoked grants where grantee = user.id
3. Join with document_vault for basic info (name, category)
4. Return list of accessible shared documents

---

### Phase 3: AI Classification Service

**`app/lib/ai/documents/classification-service.ts`**

**Classification Prompt Design:**
- Input: Document image/PDF (via Anthropic vision API)
- System prompt: "Classify this document and extract metadata"
- Output schema:
  ```json
  {
    "category": "passport | drivers_license | ...",
    "subcategory": "string | null",
    "confidence": 0.95,
    "extracted_metadata": {
      "document_number": "...",
      "holder_name": "...",
      "expiry_date": "YYYY-MM-DD",
      "issuing_authority": "...",
      "issuing_country": "..."
    }
  }
  ```

**Privacy Safeguards:**
- Document content is NOT stored in AI conversation tables
- Classification is a one-shot API call, not a conversation
- Only extracted metadata (category, expiry, etc.) is stored
- Consent check before AI processing
- Original document content discarded after classification

---

### Phase 4: UI Components

**Pages/Routes:**
- `/vault` - Document vault main page (list view)
- Document upload integrated into vault page (modal/wizard)
- Document detail as expandable panel or modal

**Components:**

1. **DocumentVault** (main page)
   - Category filter tabs/chips
   - Document grid with cards
   - Upload button → triggers upload flow
   - Empty state with guidance

2. **DocumentUploadWizard** (modal or inline)
   - Step 1: File drop zone (drag & drop + click to browse)
   - Step 2: AI classification in progress (spinner)
   - Step 3: Review classification results, edit if needed
   - Step 4: Add optional description → Save

3. **DocumentCard** (grid item)
   - Thumbnail (for images) or file type icon (for PDFs)
   - Document name, category badge, upload date
   - Expiry warning if metadata has expiry_date approaching
   - Actions: View, Manage Grants, Delete

4. **SecureDocumentViewer** (modal)
   - Displays document via signed URL in sandboxed iframe
   - No right-click context menu (CSS: `pointer-events` control)
   - Watermark overlay with viewer's user ID + timestamp
   - Auto-closes when signed URL expires (Expire time needs to be configurable)
   - No download button

5. **GrantManagement** (panel within document detail)
   - List active grants with: grantee name, purpose, expires, views used
   - "Grant Access" button → form (select user, purpose, expiry, max views)
   - Revoke button per grant

6. **SharedDocuments** (separate section or tab)
   - Documents shared WITH the current user
   - Shows: document name, owner name, purpose, expiry countdown
   - "View" button → SecureDocumentViewer

---

### Phase 5: GDPR & Account Deletion

**Update `app/api/user/delete-account/route.ts`:**

Add to deletion sequence (before boats deletion):
1. Delete all `document_access_log` entries where `document_owner_id = user.id` (using service role)
2. Delete all `document_access_grants` where `grantor_id = user.id` (cascades from vault anyway)
3. Delete all `document_vault` records (cascades grants)
4. Delete all files from `secure-documents/{user_id}/` storage bucket

**Also handle:**
- Grants where user is grantee (auto-handled by FK CASCADE on `grantee_id`)
- Access logs where user is `accessed_by` (SET NULL preserves audit trail)

---

### Phase 6: Security Hardening & Testing

**Security Measures:**
- [ ] Rate limiting on upload endpoint (10/hour)
- [ ] File type whitelist validation (server-side, not just client)
- [ ] File size limit (10MB)
- [ ] SHA-256 hash verification on upload
- [ ] MIME type verification (magic bytes, not just extension)
- [ ] Signed URL expiry (5 minutes max)
- [ ] Grant expiry enforcement (30 days max)
- [ ] No-cache headers on signed URL responses
- [ ] CSP headers for document viewer iframe
- [ ] Watermarking for viewed documents
- [ ] Audit log immutability (no UPDATE/DELETE RLS policies)

**Testing Priorities:**
- [ ] RLS policy verification (can't access others' documents)
- [ ] Grant expiry and revocation enforcement
- [ ] Signed URL generation and expiry
- [ ] AI classification accuracy
- [ ] GDPR deletion completeness
- [ ] Rate limiting behavior
- [ ] File validation (reject invalid types, oversized files)

---

### Implementation Order (Recommended)

1. **Migration + Schema** (Phase 1) — Foundation
2. **Core APIs** (Phase 2: upload, list, view, delete) — Backend first
3. **AI Classification** (Phase 3) — Enhance upload flow
4. **Grant APIs** (Phase 2: grants, shared access) — Sharing mechanism  
5. **UI - Vault + Upload** (Phase 4) — Core user experience
6. **UI - Viewer + Grants** (Phase 4) — Sharing UI
7. **GDPR Updates** (Phase 5) — Compliance
8. **Security Hardening** (Phase 6) — Final sweep

### Dependencies / External Requirements
- Supabase Storage private bucket creation (may need Supabase dashboard)
- Anthropic Vision API access for document classification
- Consider future: virus scanning integration, OCR for non-image PDFs
<!-- SECTION:PLAN:END -->
