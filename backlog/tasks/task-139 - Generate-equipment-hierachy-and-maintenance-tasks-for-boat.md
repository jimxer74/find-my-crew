---
id: TASK-139
title: Generate equipment hierachy and maintenance tasks for boat
status: In Progress
assignee: []
created_date: '2026-02-27 14:14'
updated_date: '2026-02-27 14:36'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AI functionality to populate the boat_management equipments from the standard list of equipments for the parcticular boat.

In add new boat wizard add a 3. step in the wizard flow "3. Equipment". 
After the 2. step when boat is saved to database. Display the 3. step page

Page content: 
- user can select whether to create standard equipments and maintenance tasks (tobe implemented in future, not now) for the boat
- Display main Categories of equipments as cheboxes where user can select of which to include in generating the equipment hiearchy (add one checkbox select /deselect all)
- buttons to cancel and generate

When user clicks create, an async AI job to fetch standard equipment list and subequipments  using AI search in background, show progress indicator to user. when ready show a summary of the fetched equipment
- user can select / delsect equipments from the summary
- user can create the equipment list to boat_management equipments. or cancel
- when saved, save also equipments in local product registry, check for duplicates, do not create duplicate entries in product registry table
<!-- SECTION:DESCRIPTION:END -->
