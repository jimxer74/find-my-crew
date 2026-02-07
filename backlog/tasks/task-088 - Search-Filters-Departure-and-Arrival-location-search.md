---
id: TASK-088
title: Search / Filters Departure and Arrival location search
status: To Do
assignee: []
created_date: '2026-02-07 16:27'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Departure and Arrival location search capability in the search / filters functionality when user wants to search sailing trips using specific locations.

The search must work so, that if Departure location is given, it must search starting legs in that location so that it is changed to a bigger bounding box with enough margins that possible legs are found. Same thing with the Arrival location. 

If Arrival or Departure location is not given then that is of course not used in searching legs. 

There is existing functions to get bounding boxes in /lib/geocoding, check that and use it if it is suitable. Propose changes if needed, check any depedendencies to existing code that might use those functions of course.
<!-- SECTION:DESCRIPTION:END -->
