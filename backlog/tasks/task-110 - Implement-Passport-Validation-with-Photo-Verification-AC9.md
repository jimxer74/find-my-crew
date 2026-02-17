---
id: TASK-110
title: Implement Passport Validation with Photo-Verification (AC#9)
status: To Do
assignee: []
created_date: '2026-02-17 11:45'
labels:
  - registration
  - passport
  - ai-assessment
  - photo-verification
  - feature
dependencies: []
references:
  - app/components/crew/LegRegistrationDialog.tsx
  - app/components/crew/RegistrationRequirementsForm.tsx
  - app/hooks/useLegRegistration.ts
  - app/lib/ai/assessRegistration.ts
  - app/api/registrations/route.ts
  - app/components/vault/DocumentUploadModal.tsx
  - app/components/vault/DocumentCard.tsx
  - specs/tables.sql
documentation:
  - >-
    TASK-103 - Registration requirements refactoring (parent task, already
    completed)
  - Implementation plan provided in project instructions
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete implementation of TASK-103 AC#9: Passport verification using document vault integration with optional photo-ID validation and configurable AI confidence scoring.

## Current State
- Database schema already exists with required tables and columns (journey_requirements, registration_answers)
- Owner UI allows creating passport requirements with require_photo_validation toggle and pass_confidence_score config
- Crew-side registration has NO UI for passport verification flow

## Requested Feature
Implement full passport verification flow in crew registration:
1. Allow crew to select passport from document vault during registration
2. Allow crew to upload facial photo (if require_photo_validation = true)
3. Trigger AI-based passport validation (expiry, holder name matching)
4. Trigger AI-based facial photo matching (if photo provided)
5. Score result against pass_confidence_score threshold

## Implementation Phases

### Phase 1: UI Components
- PhotoUploadStep: Drag-drop file upload, camera capture, compression, preview
- PassportSelector: Display user's passports from vault, filter expired, select one
- PassportVerificationStep: Multi-step orchestration (passport selection + optional photo upload)

### Phase 2: Component Integration
- Update LegRegistrationDialog to render PassportVerificationStep conditionally
- Update useLegRegistration hook to support FormData with passport data
- Update RegistrationRequirementsForm to filter out passport requirements

### Phase 3: Server-Side Assessment
- Add assessPassportRequirement() function to AI assessment service
- Modify POST /api/registrations to accept multipart FormData
- Integrate passport validation into async assessment flow

### Phase 4: Testing & Refinement
- Unit and integration tests
- E2E workflow tests
- Error scenarios and edge cases

## Design Constraints
- Reuse existing patterns: portal modals, conditional rendering, waitUntil() async
- Photo data temporary only (base64 to AI, not persisted)
- Use Gemini 2.0 Flash for vision AI
- Mobile-friendly with camera support
- GDPR-compliant (photos not stored, cascade deletes work)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Passport requirement displays in registration dialog when owner has configured it for journey
- [ ] #2 Crew can select passport from document vault - shows metadata, filters expired passports
- [ ] #3 If require_photo_validation = false: Passport selection skips photo upload step automatically
- [ ] #4 If require_photo_validation = true: After passport selection, photo upload UI displays with drag-drop and camera capture options
- [ ] #5 Photo upload accepts JPEG/PNG/WebP, max 5MB, with client-side compression target <200KB
- [ ] #6 Form submission includes passport_document_id and optional photo_file in multipart FormData
- [ ] #7 Server creates registration_answers entry with passport_document_id field
- [ ] #8 AI validates passport document: expiry check, holder name matching against crew profile
- [ ] #9 AI calculates passport confidence score (0.0-1.0)
- [ ] #10 If photo provided: AI performs facial photo-to-passport matching with confidence score
- [ ] #11 Final score compared against pass_confidence_score threshold (0-10 scale)
- [ ] #12 Assessment result (passed/failed) recorded in registration_answers with reasoning
- [ ] #13 Registration assessment includes passport validation in sequential check flow
- [ ] #14 Crew receives email notification with registration result (approved/pending/denied)
- [ ] #15 Owner dashboard displays passport assessment results with AI reasoning
- [ ] #16 Existing registrations without passport requirements continue working unchanged
- [ ] #17 Question-only requirements display correctly when no passport requirement exists
- [ ] #18 Risk level and experience level pre-checks still work correctly
- [ ] #19 No new GDPR or security vulnerabilities introduced
- [ ] #20 Component tests verify UI rendering and state management
- [ ] #21 Integration tests verify API FormData parsing and database record creation
- [ ] #22 E2E test covers full flow: passport selection → photo upload → submission → AI assessment
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All new components tested with unit tests covering happy path and error scenarios
- [ ] #2 Integration tests verify API endpoint accepts multipart FormData correctly
- [ ] #3 E2E tests verify complete registration workflow with passport verification
- [ ] #4 Manual testing on desktop and mobile browsers
- [ ] #5 AI assessment function returns structured results with confidence scores and reasoning
- [ ] #6 Documentation/comments added to complex logic (photo compression, AI prompt construction)
- [ ] #7 No console errors or warnings when feature is used
- [ ] #8 GDPR deletion logic verified - photos not stored, cascade deletes work correctly
<!-- DOD:END -->
