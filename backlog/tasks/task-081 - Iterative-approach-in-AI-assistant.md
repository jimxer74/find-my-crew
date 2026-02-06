---
id: TASK-081
title: Iterative approach in AI assistant
status: Done
assignee: []
created_date: '2026-02-05 10:26'
updated_date: '2026-02-06 11:48'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Break down the current AI assistant into more manageable smaller iterations. Challenge in current setup is that the prompt to AI is too big and consists of all possible scenarios, even if user is not asking those aspects and thus makes it hader to underlaying LLM model to give speicific and relevant answers.

Break down AI assistant in smaller iterative steps e.g. 1, 2, 3

**1. Understand users main use case and users main goal
- UC1: search_sailing_trips: Users wants to find relevant sailing trips, either journeys or legs with given search criteria and matching profile details
- UC2: improve_profile: User wants to or AI resolvels that it would make sense for user to improve or make the profile to stand out more to get better matching results or improve the chances of automated approval
- UC3: register: Register to specific leg or whole journey at once
- UC4: post_demand_or_alert: User did not found good matching leg but wants to propose and create a demand or notification alert for certain leg (FUTURE CAPABILITY)

**2. Understand the relevant tool or tools to use for specific use case
- Select the most relevant tool or tools from use case specific list
- Run the tool and get results

**3. Analyze results and propose solution to user
- Analyze tool results
- Propose solution to user, generate suggested actions if relevant
-
<!-- SECTION:DESCRIPTION:END -->
