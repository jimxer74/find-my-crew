---
id: TASK-128
title: Owner onboarding wizard - PART 1
status: To Do
assignee: []
created_date: '2026-02-23 06:33'
updated_date: '2026-02-23 17:43'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Description
Additional onboarding wizard for owners

**Important**
* This is additional onboarding flow to existing /welcome/owner AI assisted  onboarding UI / UX concept
* Main UI principle is to keep UI very simple and only display users a small set of information at the time.
* Needs to graphically very pleasing and charm users to continue. 
* Use the current frontpage ui concept with the changing background image for different steps and role based color scheme, render controls and contents so that background image is visible, use same look and feel in controls as in frontpage OwneComboBox
* Onboarding  must be built as REUSABLE modules, the order of the modules needs to be configurable. It is very IMPORTANT that modules can be reused later in other areas of the app as well. not just in onboarding.
* Onboarding starts allways with sign-up + consent flow ( email, google or facebook), otherwise exact sequence of the Journey modules can be changed.
* Results of the each module needs to be stored in structured format in database in order to use them later in the process to create user profile, add a boat, add a journey including all the possible data fields for the entities.
* AI reasoning and raw output is not rendered directly to users as in chat, instead it needs to be available to users but in subtle way so that UI remains very simple and clean
* Centralized AI config management needs to be used

**Modules**
- Each module has UI, and default functions: Skip (user can skip the module), Next (user saves the data), Back (user can go back in the flow to correct or change something)
- Each module may have an ACTION that is performed with the Next button

Onboarding modules (not in exact order, order needs to be changeable)

**Journey Module**
- Journey module enables user to define the journey information.
- It has inputs to define Departure and Arrival location and intermediate waypoints, using autocomplete search box
- It has input to define the journey date range
- ACTION: Information is passed to AI for assessment, AI needs to reason and understand the characteristics of the planned journey and return structured data: rough lat/lng of the used inputted waypoints, risk level, required experience level and proposed crew skills and journey feasibility information, taking into consideration the dates and time, prevailing weather conditions of the defined time, (e.g. to avoid for example long offshore routes with prevailing headwinds, and indicate if the planned journey and timing does not make sense, e.g. atlantic crossing in hurrican season), the route considerations, potential hazards, etc. it needs to provide user a short assessment of the journey planned so that user can decided if it is a good idea. AI could propose changes to the plan, e.g. to propose adjust the departure or arrival locations, dates or timing etc. to better suit the known weather patterns.  
- RESULT: If AI proposes changes or identifies issues with the planned journey, these need to be displayed to user in informative way to enable user to adjust the journey if needed. A matching crew is displayed to user to show the value of the platform. Since user is already signed, all the information about the crew can be displayed,

** Profile Module**
Split into same sections as in Profile edit page each own page in wizard
- Personal info (Photo upload, user description) email and names are from auth flow and user description field
- Sailing preferences (Comfort level selector, same as in Profile page)
- Sailing experience and skills (Experience level selectors, and simple selectable badges for skills, no skills details, user can update them later in profile)

** Boat Module**
- Similar functionality as existing add new boat wizard, boat must be store also in boat_registry when fetched from external source

Data needs to be stored as it is gathered in database table. When user has filled the profile data, there must be a action available to user to finalize the onboarding at any time. When user selects to finalize the onboarding, the data that is captured so far is then updated into approariate tables in database, e.g. profiles, boats, and journeys and related tables.
**Important** for Journey data, the generate journey api must be called to generate the journey waypoints when finalizing the onboarding, if journey information exists and has been provided by user. 
 
There needs to be a way to manage the order of the modules, so that it can be changed.
<!-- SECTION:DESCRIPTION:END -->
