---
id: TASK-111
title: Add document access grant validation to passport registration flow
status: To Do
assignee: []
created_date: '2026-02-17 16:12'
labels:
  - security
  - document-vault
  - crew-registration
  - task-015
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement validation in crew registration flow to ensure crew members have created document_access_grants for their selected passports before allowing registration submission.

**Current Issue:**
- Crew can select any passport from vault without checking if they granted access to boat owner
- Boat owner cannot view passport if crew never explicitly granted access
- Violates TASK-015 security model (purpose-bound, crew-controlled sharing)

**Implementation:**
1. Add grant checking logic to PassportVerificationStep component
   - After passport selected, verify active grant exists with purpose='identity_verification'
   - Check grant is not revoked and not expired (expires_at > now())
   
2. Update PassportSelector UI
   - Show warning if selected passport lacks valid grant
   - Provide guidance: "Grant access in Document Vault first"
   - Disable submit button until grant created
   - Link to vault grant management

3. Testing
   - Verify crew without grant cannot submit registration
   - Verify crew can submit after creating grant
   - Confirm boat owner can access passport after registration

**Why This Matters:**
- Security: Ensures crew explicitly controls document access
- Privacy: No auto-grant creation from server
- GDPR: Audit trail of who granted access when
- Transaction Model: Ensures contact info exchange happens within platform (future pricing)

**Related:**
- TASK-015: Document Vault security model
- Memory: /TASK-015-grant-validation.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Crew cannot submit registration without active document_access_grant for selected passport
- [ ] #2 Grant must have purpose='identity_verification' and not be expired/revoked
- [ ] #3 PassportSelector shows clear warning if grant missing
- [ ] #4 UI provides link to vault to create grant
- [ ] #5 Boat owner can access passport after registration (grant exists)
- [ ] #6 No auto-grant creation from server side
<!-- AC:END -->
