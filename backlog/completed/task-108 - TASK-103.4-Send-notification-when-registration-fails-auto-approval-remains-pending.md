---
id: TASK-108
title: >-
  TASK-103.4: Send notification when registration fails auto-approval (remains
  pending)
status: Done
assignee: []
created_date: '2026-02-17 11:01'
updated_date: '2026-02-17 11:04'
labels:
  - notifications
  - registration
  - ai-assessment
  - TASK-103-remaining
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Send an in-app notification to crew member when their registration fails AI auto-approval assessment and remains in pending status.

Currently:
- No notification sent to crew on pending/failed auto-approval
- Only owner receives "new registration" notification
- Crew has no way of knowing assessment result

Required Changes:
- After AI assessment completes in assessRegistration.ts:
  - If auto_approved=false (failed checks), trigger `notifyPendingRegistration`
  - Include reason for pending status if available
- Email notification also desired but optional for this task
- Use existing `PENDING_REGISTRATION` notification type
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Notification sent to crew on failed auto-approval
- [ ] #2 Notification indicates registration is pending review
- [ ] #3 Crew receives notification when registration status remains pending
- [ ] #4 Notification includes link to view registration status
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Notification on Failed Auto-Approval - Verification Complete

The system already sends notifications to crew members when their registration fails AI auto-approval assessment and remains pending.

### Existing Implementation
- Located in: `app/lib/ai/assessRegistration.ts`
- When auto_approved = false:
  - `notifyPendingRegistration()` called for crew
  - Includes journey_id, journey_name, leg_name
  - Link provided to view status
- Also in: `app/api/registrations/[registrationId]/route.ts`
  - Manual pending status sends same notification

### Features Already Implemented
- ✅ Notification sent on failed auto-approval
- ✅ Indicates registration is pending review
- ✅ Crew receives notification
- ✅ Includes link to view status
<!-- SECTION:FINAL_SUMMARY:END -->
