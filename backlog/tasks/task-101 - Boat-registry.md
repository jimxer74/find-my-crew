---
id: TASK-101
title: Boat registry
status: To Do
assignee: []
created_date: '2026-02-16 14:49'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a new table to store boat registry data. The table should have all the same fields as boats table, execpt boat name, owner id, and home port. 

Functionality:

Add a row into new boat registry table each time boat data is fetched via screen scraping api either in ai assisted flow or in manual add new boat flow.

Update the the fetch boat details api to try to lookup the approriate boat data first from the boat registry table, before using the external source using screen scraping api.
<!-- SECTION:DESCRIPTION:END -->
