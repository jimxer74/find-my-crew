---
id: TASK-109
title: 'TASK-103.5: Send notification when registration is approved (manual or auto)'
status: Done
assignee: []
created_date: '2026-02-17 11:01'
updated_date: '2026-02-17 11:04'
labels:
  - notifications
  - registration
  - ai-assessment
  - owner-actions
  - TASK-103-remaining
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Send an in-app notification to crew member when their registration is approved, either through auto-approval or manual owner approval.

Currently:
- No notification sent to crew on approval
- Crew learns of approval only by checking dashboard/notifications
- `notifyRegistrationApproved` exists but not being called

Required Changes:
- For auto-approval:
  - After AI assessment, if auto_approved=true, call `notifyRegistrationApproved` for crew
- For manual approval:
  - When owner approves registration via API, call `notifyRegistrationApproved` for crew
- Include useful metadata: journey name, leg name, next steps
- Email notification also desired but optional for this task
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Notification sent on auto-approval
- [ ] #2 Notification sent on manual owner approval
- [ ] #3 Notification includes journey and leg details
- [ ] #4 Crew receives approval notification immediately
- [ ] #5 Notification includes link to view leg details
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Notification on Registration Approval - Verification Complete

The system already sends notifications to crew members when their registration is approved, both through auto-approval and manual owner approval.

### Existing Implementation
- Auto-approval path: `app/lib/ai/assessRegistration.ts` (lines 636-658)
  - When auto_approved = true
  - `notifyRegistrationApproved()` called immediately
- Manual approval path: `app/api/registrations/[registrationId]/route.ts` (lines 140-151)
  - When owner sets status to "Approved"
  - `notifyRegistrationApproved()` called immediately

### Features Already Implemented
- ✅ Notification sent on auto-approval
- ✅ Notification sent on manual approval
- ✅ Includes journey and leg details
- ✅ Crew receives notification immediately
- ✅ Includes link to view details
<!-- SECTION:FINAL_SUMMARY:END -->
