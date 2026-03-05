---
id: TASK-151
title: Boat Management bugs and enhancements
status: To Do
assignee: []
created_date: '2026-03-05 08:48'
updated_date: '2026-03-05 09:02'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Generate equiment and maint. tasks**
- BUG: crosscheck the saving of tasks and equipment, it seems that tasks are not allways saved to database, for example when user fetches new tasks in equipment fetch flow
- Equipment save does not work, results in error

**Maitenance -view**
- Change task cards to narrow format similar as equipment cards, truncate content if neccessary
- Remove status badge from Task card
- Change tasks statuses to: Todo, Planned, In progress, Done
- Status logic: Task is Todo, if it has not been started and no Due date has been set, 

Desktop: 
- change the layout to 4 column, by the Status (Todo, Planned. In Progress, Done) and display the tasks in column based on the task status
- remove Status selection / drop down
<!-- SECTION:DESCRIPTION:END -->
