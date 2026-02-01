---
id: TASK-072
title: 'AI-assistant enhancement: Location based matching for crew'
status: To Do
assignee: []
created_date: '2026-02-01 20:49'
updated_date: '2026-02-01 20:50'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Logic explained:

1. AI needs to detect if user is asking to find sailing opportunities e.g. legs by a certain location or area. This can include both the area or location to start the sailing journey or leg and also the ending or arrival location of the leg or journey
2. When ai detects the location based search and match scenario, it would need to geocode the starting location and ending location or area, so that it would resolve a rectangular area in map in which the user defined start and/or end location or area fits with wide enough margin to make sure all possible legs are found.
3. There is an existing procedure in /specs/functions.sql get_legs_per_viewport that uses the geocoding approach to find legs, please review it, similar kind could be user here as a tool for ai to find matching legs or journeys
<!-- SECTION:DESCRIPTION:END -->
