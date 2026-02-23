---
id: TASK-126
title: Refactor owner onboarding AI assistant
status: To Do
assignee: []
created_date: '2026-02-22 12:12'
updated_date: '2026-02-23 08:02'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Main principle is that user is not given a free chat capabality, but instead a context specific action or input control is displayed to user based on AI assessment and proposed step.

AI should allways respond in either of the options:
A) Ask clarification to fill or correct missing information --> This is implemented in context specific UI control to user, e.g. if AI asks user to specify Experiece level (Beginner, Comptentent crew, Coastal Skipper, Offshore Skipper)  this is displayd to user as Radiobutton selection, where user selects the approriate radiobutton and clicks Confirm
or if AI ask user to provide the boat makemodel, an input textbox is displayed where user can type in the boat makemodel

B) Ask to confirm that the gathered data is relevant and ok. e.g. display user profile, boat or journey data. User can either "Confirm" or "Cancel" and if confirmed the action is executed

C) Sign-up or Logi-in function to nudge user to sign-in if not already done so

Remove the current SUGGESTION functionality
Add exit onboarding assistant button to header after user has signed-in
<!-- SECTION:DESCRIPTION:END -->
