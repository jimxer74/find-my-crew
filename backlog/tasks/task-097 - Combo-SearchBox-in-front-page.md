---
id: TASK-097
title: Combo SearchBox in front page
status: To Do
assignee: []
created_date: '2026-02-11 09:44'
updated_date: '2026-02-11 09:55'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Combo search box for front page that looks like a single search input field divided in 4 segments (Where from | Where to | Availability | Profile) and "search" icon button within it. Button should be disabled if no inputs are provided and active if any of the inputs are given.

Functionality:
Where from: Click and Focus active the field and user can start typing location, uses LocationAutocomplete 

Where to: Click and Focus active the field and user can start typing location, uses LocationAutocomplete. 

Availability: Click and Focus active the field and user can type in free text e.g. "next summer", "June to August" , "asap". This is just free text that is provided to AI model to reason the user intent. It also opens the DateRange picker, so user can use that if so wants to define a more stricter availability limits. 

Profile: Click and Focus open a dialog with textarea where user can copy-paste existing profile for example from Facebook post, etc. or fill in the profile information. Free text

All fields in SearchCombo should have a clean "x" functionality to clear the input from the ComboBox. ComboBox should clearly display the value user has inputted in each. Truncated if necessary to fit.

Search: When user clicks the search button the input are passed to /welcome/chat for AI to use in forming the response to use
 
IMPORTANT: In locations there can be predefined cruising areas where geocoded bounding boxes are defined, those should be used and passed forward to AI in next step to facilitate the search of legs.

IMPORTANT: check and verify if prospect chat AI promting requires some changes due this
<!-- SECTION:DESCRIPTION:END -->
