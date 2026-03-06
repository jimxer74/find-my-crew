---
id: TASK-151
title: Boat Management bugs and enhancements
status: To Do
assignee: []
created_date: '2026-03-05 08:48'
updated_date: '2026-03-06 06:42'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Generate equiment and maint. tasks**
- BUG: crosscheck the saving of tasks and equipment, it seems that tasks are not allways saved to database, for example when user fetches new tasks in equipment fetch flow

**General UI**:
BUG:  Badge dark colors do not work properly: update Badge dark colors to use glassmorphism style, so that they appear glass like, with clear color signals for both dark, and light themes
- Change Edit, Delete etc link buttons to similar icons with text as in /owner/journeys page (icon with text) update also /owner/journeys page to include both Icon and text
- Crosscheck to whole platform and update all similar kind of Card link buttons to use the same "Icon + text" appoach.

**Equipment view**
- Change the "Active" status display, remove the badge. Instead color the left border of card with status color (e.g. green with active). Make the left border a tad wider to better communicate the status

**Maitenance -view**
- BUG: the Recurring interval is not working properly, it displays a task to be recurring, but when opening edit mode it does not show recurring information. Also when completing a recurring task it should create another one with recurring interval, but it did not work allways.
- Remove critical, high etc. priority badge from the card, instead display the criticality in coloring the left side boder with approriate criticality color, make the left border wider
- Change task cards to narrow format similar as equipment cards, truncate content if neccessary
- Remove state badge from Task card
- Change tasks statuses to: Todo, Planned, In progress, Done
- Status logic: Todo = if it has not been started and no Due date has been set, Planned = Due date set, but not started, In Progress = task is started, Done = Task is marked as completed
- Change the card button actions to state sensitive e.g. Todo and Planned tasks = Start, In progress tasks = Complete  
- Remove the category dropdown

Desktop: 
- change the layout to 4 column Kanban style layout, by the state (Todo, Planned, In Progress, Done) and display the tasks in column based on the task status. Make state columns collapsible and by default minimize the "Done" column. 
- remove Status selection / drop down
- List tasks by equipment groups, similar as equipments are listed by categories.

Mobile:
- list task cards in single column, grouped by the equipment
- revmove state dropdown, instead display clickable state badges
<!-- SECTION:DESCRIPTION:END -->
