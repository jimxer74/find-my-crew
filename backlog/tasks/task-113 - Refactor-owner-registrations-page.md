---
id: TASK-113
title: Refactor /owner/registrations page
status: To Do
assignee: []
created_date: '2026-02-17 19:21'
updated_date: '2026-02-17 19:29'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Desktop: Refactor the layout, use table layout with rows of registrations instead of cards.

Columns are from left to right: 
- Registration date
- Registration status
- Full name (Link to Registratio Details page)
- Journey (link to Journey edit page)
- Leg (link to leg edit page)
- Leg start date
- Leg end date

Each column is sortable by clicking the header and also per each column there is a filter that can be used to select "all" or a specific value per column. By default display Pending Approval order by Registration date first.

Mobile: Refactor the layout, use small cards with following information:
- Full name
- Registration date
- Registration status (as small round badge "A" green means approved, "P" yellow, means pending, "C" Grey means cancelled  "N" Red means not approved
Clicking the card opens the Registration Details page
- Leg and Leg start date

Display on top of the page badge links to filter / display registrations by status
By default display Pending Approval order by Registration date first.
<!-- SECTION:DESCRIPTION:END -->
