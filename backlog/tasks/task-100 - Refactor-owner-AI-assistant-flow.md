---
id: TASK-100
title: Refactor owner AI assistant flow
status: To Do
assignee: []
created_date: '2026-02-14 10:39'
updated_date: '2026-02-14 10:43'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor owner AI assistant prompting to follow strict flow: 1. sign-u2p 2. Create profile 3. Add boat 4 Post Journey

Restrict the only required tools for AI to use. e.g for 2. Create profile only create_profile tool is available. and e.g 4 Post Journey only generate__journey tool is available.

AI model is not using the profile, boat or journey status fetching tools at all, but the these are checked in code deterministically and the correct statuses are provided to AI to understand the current state of flow. 

Simplify if possible the prompting to AI only give instructions to fullfill and complete the currently active step, with main goal in step is to get if completed and move to next as efficiently as possible.
<!-- SECTION:DESCRIPTION:END -->
