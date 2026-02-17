---
id: TASK-112
title: Data archiving system
status: To Do
assignee: []
created_date: '2026-02-17 18:27'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There is potentially lot of data created and stored in different tables and for ensuring a cost effective overall solution and performance - stale and old data needs to be archived out from the active database tables to something more affordable solution for long term storage and access if needed. 

A solution architecture for data archiving must be defined with approriate levels of archiving for different data sets and usage scenarios. 

** Considerations:
- Legs and Journeys become potentially stale quite fast, since assumption is that Journeys are created quite late and close to the actual Journey taking place. So this means that Journey data archiving need to be done frequently. However journey data is important for analysis point of view to understand for exmple where demands are highest, understanding patterns, opportuinites. etc. 
- Registrations and related data are similar to journeys, they become stale also fast, but are important to retain, for potential auditing purposes or disputes etc. 
- Profiles and boats are probably more longer lived data and does not need to be archived so often. GDPR needs to be considered in archiving the profile data
<!-- SECTION:DESCRIPTION:END -->
