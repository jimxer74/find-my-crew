---
id: TASK-039
title: Resizable bottom sheet in mobile version to list legs visible in map viewport
status: To Do
assignee: []
created_date: '2026-01-28 06:42'
updated_date: '2026-02-07 13:10'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mobile version:
Similar to Airbnb mobile version, a bottom sheet that user can expand and make smaller. Bottom sheet lists the legs found in the users current viewport, organized in order of the best match. Information displayed:
- Journey images if exist and boat images for the journey (large in top) in single carousel, swiping left and right displays a next image (see existing ImageCarousel)
- Match badge on top left, shows the match percentage
- Under the boat image: Leg Name, Journey name, start and end places, dates, duration
- Clicking  the image and opens the leg detail view
- Sort legs in best match first order

Desktop version:
- In desktop list the Legs in left side pane, clicking the single leg in the list, opens the detail view of the leg in the same pane.
- All other logic sorting etc. same as in mobile version

Important Implementation concepts:
- Create reusable Leg list component that can be used so that the legs to be displayed are provieded as parameters to the component
- This same component will be used in other contexts as well in future
- Make the component configurable by parent caller, so that it can be defined what data to show on the list from the legs
<!-- SECTION:DESCRIPTION:END -->
