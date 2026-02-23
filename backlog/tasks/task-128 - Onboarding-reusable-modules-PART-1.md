---
id: TASK-128
title: Onboarding reusable modules - PART 1
status: To Do
assignee: []
created_date: '2026-02-23 06:33'
updated_date: '2026-02-23 07:23'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Description
Additional onboarding wizard for owners

**Important**
* This is additional onboarding flow to existing /welcome/owne AI assisted  onboarding UI / UX concept
* Main UI principle is to keep UI very simple and only display users a small set of information at the time. 
* Use the current frontpage ui concept with the background image and role based color scheme, render controls and contents so that background image is visible, use same look and feel in controls as in frontpage ComboBox
* Onboarding flow needs to be composed of REUSABLE modules, the order of the modules needs to be configurable and changeable. It is very IMPORTANT that modules can be reused later in other areas of the app as well. not just in onboarding.
* Onboarding starts allways with sign-up flow, email, google or facebook, otherwise exact sequence of the Journey modules can be changed.
* Results of the each module needs to be stored in structured format in database in order to use them later in the process to create user profile, add a boat, add a journey including all the possible data fields for the entities.
* AI reasoning and raw output is not rendered directly to users as in chat, instead it needs to be available to users but in subtle way so that UI remains very simple.

**Modules**
- Each module has UI, and default functions: Skip (user can skip the module), Next (user saves the data), Back (user can go back in the flow to correct or change something)
- Each module has an ACTION that is performed with the Next button

Onboarding modules (not in exact order, order needs to be changeable)

**Journey Module**
- Journey module enables user to define the journey information.
- It has inputs to define Departure and Arrival location, eihter using autocomplete search box or map where user can point and click the preferred location
- I has input to define the journey date range
- ACTION: Information is passed to AI for assessment, AI needs to reason and understand the characteristics of the planned journey and return structured data: rough lat/lng of the used inputted waypoints, risk level, required experience level and proposed crew skills and journey feasibility information, taking into consideration the dates and time, prevailing weather conditions of the defined time, (e.g. to avoid for example long offshore routes with prevailing headwinds, and indicate if the planned journey and timing does not make sense, e.g. atlantic crossing in hurrican season), the route considerations, potential hazards, etc. it needs to provide user a comprehensive assessment of the journey planned so that user can decided if it is a good idea. AI could propose changes to the plan, e.g. to adjust the departure or arrival locations, dates or timing etc. to better suit the known weather patterns.  
- RESULT: If AI proposes changes or identifies issues with the planned journey, these need to be displayed to user in informative way to enable user to adjust the journey if needed. A matching crew is displayed ot user to show the value of the platform. Since user is already signed, all the information about the crew can be displayed,
<!-- SECTION:DESCRIPTION:END -->
