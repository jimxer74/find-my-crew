---
id: TASK-105
title: 'TASK-103.1: Display acknowledgement message after successful registration'
status: To Do
assignee: []
created_date: '2026-02-17 11:01'
labels:
  - registration
  - ui
  - crew-facing
  - TASK-103-remaining
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a crew member successfully registers for a leg, display a clear acknowledgement/thank you message informing them:
- Confirmation that registration was submitted
- Whether it was auto-approved or is pending manual review
- What to expect next

Currently:
- Simple `alert()` shown on auto-approval
- No structured feedback for pending registrations
- Dialog closes without confirmation message

Required Changes:
- Replace `alert()` with a proper UI component
- Show different messages for auto-approved vs pending status
- Display in LegRegistrationDialog or a new success modal
- Link back to dashboard or allow closing cleanly
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Acknowledgement message displays after successful registration
- [ ] #2 Message distinguishes between auto-approved and pending status
- [ ] #3 User can close message and return to dashboard
- [ ] #4 Message is styled consistently with app theme
<!-- AC:END -->
