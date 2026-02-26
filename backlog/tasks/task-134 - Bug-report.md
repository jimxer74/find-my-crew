---
id: TASK-134
title: Bug report
status: In Progress
assignee: []
created_date: '2026-02-25 15:02'
updated_date: '2026-02-26 08:13'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bugs:
- In leg registration where passport if obligated, if user clicks cancel in passport promt, user is displayed the normal registration form and user can register without valid passport > this should be prohibited  --> FIXED
- When user clicks register for leg, is some cases (maybe when autoassessment is set on) the registering form is still displayed to user after user has registered for a leg --> FIXED

- Onwere AI onboarding: Suggestion texts are way too long, instruct AI to provide short and concise suggested actions -->

- Owner AI onboarding,  the signup_pending state does not get allways updated after signuo. TriggerProfileCompletion API was changed, but verify the fix is correct 

- Once in a while a consent modal dialog is displayed to user even user has consents saved --> FIXED

- Google / Facebook auth flow does not work allways, results redirect to landing page /?code=<goog-e_code> but user is not authenticated, second time works and user gets authenticated and redirected to correct page --> FIXED
-
<!-- SECTION:DESCRIPTION:END -->
