---
id: TASK-089
title: New homepage for Crew role users
status: To Do
assignee: []
created_date: '2026-02-07 21:30'
updated_date: '2026-02-07 21:32'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Completely new Front Page for crew users. Concept is to display best matching sailing legs from the popular cruising areas that are defined in /lib/gecoding/locations.ts

- first users current location is retrieved by it's user agent for example
- display a list of cruising locations starting from the closes one to users current location
- Per each cruising location display the name of the cruising location as header, and make it also a link that opens up the map page filtering the legs with that cruising area bounding box as departure box
- Per each cruising location, render found legs in best matching order, use the LegListItem and render list the legs from left to right, display as many as fits in screen width. Use prev / next buttons in desktop adn swipe gesture in mobile to load more legs

--> Leave the old homepage still as a backup, do not delete it, this is added as new. Default crew user after login to new page.
<!-- SECTION:DESCRIPTION:END -->
