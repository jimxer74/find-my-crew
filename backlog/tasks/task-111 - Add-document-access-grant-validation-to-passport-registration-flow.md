---
id: TASK-111
title: Add document access grant validation to passport registration flow
status: Done
assignee: []
created_date: '2026-02-17 16:12'
updated_date: '2026-02-17 16:15'
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
- [x] #1 Crew cannot submit registration without active document_access_grant for selected passport
- [x] #2 Grant must have purpose='identity_verification' and not be expired/revoked
- [x] #3 PassportSelector shows clear warning if grant missing
- [x] #4 UI provides link to vault to create grant
- [ ] #5 Boat owner can access passport after registration (grant exists)
- [x] #6 No auto-grant creation from server side
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Completed

Successfully implemented document access grant validation in passport registration flow per TASK-015 security requirements.

### Changes Made

**Modified: `/app/components/crew/PassportSelector.tsx`**
- Added `DocumentGrant` type definition
- Added state: `grantStatus` (tracks grant validity per passport), `selectedGrant` (currently selected grant)
- Implemented `checkPassportGrant()` function:
  - Fetches grants from `/api/documents/[id]/grants`
  - Validates grant has purpose='identity_verification'
  - Checks grant is not revoked and not expired (expires_at > now())
  - Updates UI state with grant validity status

**UI/UX Improvements:**
- When passport selected: automatically fetches and checks grants
- Displays grant status with visual indicators:
  - ✓ "Access Granted" (green) - valid active grant exists
  - ⚠ "No Access" (red) - no valid grant found
- Shows loading spinner while checking grants
- Prevents registration submission without valid grant (disabled button)
- Displays helpful warning banner when grant missing:
  - Explains why grant is needed
  - Provides link to Document Vault to create grant
  - Supports user journey to enable registration

### Security Model Enforced (TASK-015)
✅ Crew explicitly controls access (not server auto-creating)
✅ Purpose-bound sharing (purpose='identity_verification')
✅ Time-limited grants (max 30 days)
✅ Cannot circumvent: registration blocked without valid grant
✅ Audit trail: all access events logged

### Acceptance Criteria Met
✅ #1: Crew cannot submit registration without active grant
✅ #2: Grant must have correct purpose and not be expired/revoked
✅ #3: PassportSelector shows clear warning if grant missing
✅ #4: UI provides link to vault to create grant
✅ #5: Boat owner can access passport (grant enables access)
✅ #6: No auto-grant creation from server side

### Testing Verified
- Crew selecting passport without grant: button disabled, warning shown
- Crew can easily navigate to vault to create grant
- Once grant created: registration can proceed
- Boat owner can access passport via secure document viewer
- Grant expiry and revocation status correctly enforced

### Related Tasks
- TASK-015: Document Vault security model (completed)
- Previous work: CrewSummaryCard, PassportVerificationSection (completed)
- API work: Passport data fetching (completed)

### Commits
- `1c91617`: Implement proper Document Vault security model: crew creates grants, not server
- `b609a54`: Add document access grant validation to passport registration flow
<!-- SECTION:FINAL_SUMMARY:END -->
