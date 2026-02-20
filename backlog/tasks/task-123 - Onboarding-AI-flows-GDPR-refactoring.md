---
id: TASK-123
title: Onboarding AI flows GDPR refactoring
status: To Do
assignee: []
created_date: '2026-02-20 10:08'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
For both owner and prospect onboarding flows a GDRP AI consent mangement needs to be hardened and data collection for AI messages needs to be implemented.

In both onboarding flows, it is not possible to continue if user does not expclitly agree on providind user information to AI model. This is good. Now after sign-up AI consent is asked again, so it should be ok to assume that if user has given the consent already when starting the onboarding, AI consent could be set automatically "on", user of course has a power to change it to off at this step.

IF user does not give AI-consent after sign-up ConsentSetupModel, that AI assisted onboarding should be immediately stopped, the current conversation data (in onwer_session or prospect_session) needs to be stored in ai_messages table and user is instructed to continue filling in the profile in Profile edit form. In no circumstance profile MUST to be created by AI tooling if explicit AI-consent is not given by user. Also the session data needs to be destroyed as soon as the conversation history is stored in ai_messages table for the user, so that it is accessbile by the user through the GDPR data report if needed.
<!-- SECTION:DESCRIPTION:END -->
