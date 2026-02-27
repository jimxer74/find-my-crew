---
id: TASK-139
title: Generate equipment hierachy and maintenance tasks for boat
status: In Progress
assignee: []
created_date: '2026-02-27 14:14'
updated_date: '2026-02-27 14:43'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AI functionality to populate the boat_management equipments from the standard list of equipments for the parcticular boat and maintenance tasks for standard maint activites for selected equiment.

In add new boat wizard add a 3. step in the wizard flow "3. Equipment and maintenance". 
After the 2. step when boat is saved to database. Display the 3. step page
- User can select from main equipment categories of which equipments will be created
-  User can select for which categories the maintenance task are created

When user clicks create, an async AI job is started to fetch standard equipment list and subequipments  and maintenance tasks using AI search in background, show progress indicator to user. when ready show a summary of the fetched equipment and maint. tasks
- user can delete equipment and maint. tasks that user does not wish to create
- user can save the equipment and task list to boat_management equipments and maintenance or cancel
- when saved, save also equipments in local product registry, check for duplicates, do not create duplicate entries in product registry table
<!-- SECTION:DESCRIPTION:END -->
