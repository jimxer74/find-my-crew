---
id: TASK-138
title: AI product search and product registry update
status: To Do
assignee: []
created_date: '2026-02-26 12:46'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactory Boat Management Add Equipment functionality:

Remove the Find Product in Registry, instead the autocomplete search should be direclty implemented on the Name, field which searches the matching entries from Product Registry.

Above the Name field is link "Not found? Search it" with small magnifying glass icon, link opens the dialog with similar contents as for adding a product to registry.  Change the "Description" to "Additional search text" and buttons to "Cancel" and "Search".

Clicking Search triggers a AI driven search, where input parameters are provided to AI to search the particular product and all required metadata (links and all). AI search should return a list of matches, where user could click to see further details if so wishes and select the most approriate one.  

** Important ** 
- when AI search return a list of matches, max 5 found products should be stored in Product Registry for later use, this way we get it filled up and the contents are screened through the AI reasoning, not by individual user, which may create non-existing or bad quality products in registry.

- If AI search did not found the approriate product, user has allways to chance to add the equipment information manually, but these will not be part of the registry automatically.
<!-- SECTION:DESCRIPTION:END -->
