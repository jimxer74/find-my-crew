---
id: TASK-032
title: New boat wizard
status: To Do
assignee: []
created_date: '2026-01-26 07:11'
updated_date: '2026-01-26 07:31'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wizard for adding new boats, do not change the existing edit / new boat form

Pages in wizard

1. Boat make and model

- Input for Boat name and Port, use mapbox autocomplete to search correct city / town and add a Country Flag selection that automatically selects the correct country flag based on selected the Port city information
- Input for Boat make and model, which uses the existing sailboatdata/search api to search the exact sailboat. Search is started by clicking the search button after the input box
- Display the matched sailboats as list with selection capability.
- Display a option for manually filling in the sailboat make and model data if exact match is not found
- Next and cancel buttons, next initiates the data fetch using the sailboatdata/fetch-details api for selected sailboat and displays the data in the boat edit form. Add error handling if not found or able to parse etc.

2. Boat edit form
- User can verify if the data is correct and save new boat
<!-- SECTION:DESCRIPTION:END -->
