---
id: TASK-106
title: 'TASK-103.2: Hide register button when pending or approved registration exists'
status: To Do
assignee: []
created_date: '2026-02-17 11:01'
labels:
  - registration
  - ui
  - validation
  - TASK-103-remaining
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prevent crew members from registering multiple times for the same leg by hiding the register button when they already have an active registration.

Currently:
- Button is always shown if user has profile
- No check for existing pending/approved registration

Required Changes:
- LegDetailsPanel should load registration status when leg changes
- Hide "Register for leg" button if status is:
  - "Pending approval"
  - "Approved"
- Show status badge instead
- Still allow "Cancel Registration" if status is pending
- Status is already loaded in component state `registrationStatus`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Register button hidden when pending registration exists
- [ ] #2 Register button hidden when approved registration exists
- [ ] #3 Register button still shows for cancelled registrations
- [ ] #4 Status badge displayed when registration exists
- [ ] #5 Cancel button available for pending registrations
<!-- AC:END -->
