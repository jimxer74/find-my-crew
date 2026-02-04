---
id: TASK-080
title: AI profile update suggestions and actions
status: To Do
assignee: []
created_date: '2026-02-04 07:52'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently the AI can suggest profile update and create an action to update the full profile. This approach does not work well and poses risks of losing important and relevant information in users profile. Instead the AI suggested profile update and profile update action needs to be further dividided into smaller scope suggestions and respective actions:

** AI should identify a specific field in profile that could be updated to increase chance of finding matching sailing trips --> all the content of the updates MUST BE asked and provided by the user, AI assistant MUST NOT assume any values or create content by itself without specific approval by user.

 (e.g. if AI identifies for example that sailing_preferences is not desriptive enough, AI assistant could suggest to update the sailing preferences and if user agrees, it needs to prompt the user to provide a description of to be updated sailing_preferences and iteratively suggest improvements on it if needed and finally user can either approve the update or cancel)
  
**For skills specifically, there needs to be a suggestion to update or add a single skill with the user provided description, e.g:
(if AI assistant identifies that user may have a missing skill for example night_sailing, AI coud suggest user to add night_sailing skill, if user agrees, AI asks clarifying questions to user to provide a description of the skill and can iteratively ask to improve it and then user can either approve the update or cancel.

**Each of the fields that are allowed to be updated by AI in profile should have it's own suggestion / action pair defined.
<!-- SECTION:DESCRIPTION:END -->
