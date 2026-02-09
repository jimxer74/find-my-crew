---
id: TASK-093
title: 'Prospect landing page: Context sensitive search suggestion badges'
status: To Do
assignee: []
created_date: '2026-02-09 07:26'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In new /welcome homepage, for AI-driven onboarding there should be a context sensitive exmaple search badges presented to user to help guide the onboarding process. There could be maybe 3 up to 4 badges visible.

Logic for creating context sensitive badges: 
- there could be for example a scheduled run or based on polling interval e.g bi-weekly or event monthly should be enough. 
-  Idea is to fetch suggestested time sensitive sailing areas from AI. Suggestions should take into consideration the following factors:
** Time of the year (e.g do not suggest Caribbean, in hurricane season, or baltic sea voyages during winter when sea is coverd in ice)
** Suggestions should be realistic in terms of upcoming months from 1 - 8 months forward
** Suggested areas should be return on basis of the static configured cruising areas in /lib/geocoding/locations.ts and use the predefined bounding search boxes for subsequal search of legs
** Suggestions should also be such that that there are published journeys / legs in database for the particular suggestion and take also the journey / leg level dates into consideration --> see below.
** Suggestions could include also time / date range if it is relevant, e.g. AI could return badge like "Early spring in the Med", or "Autum sailing in Greek Islands" or "Med 2026 summer" or "Explore Norway's fjods"
** These badges should produce valid search queries for AI for journeys / legs with clear area definitions with bounding boxes and date limits, and be based on the fact that there are published journeys for the aformentioned factors in database.
** There could be some randomness in presenting these badges to users, since we dont know yet the users aspirations --> however users location should be used to prioritize the badges that results in closer location gets prioritized

implementation considerations:
** This could be part of scheduled job that is run periodically to create list of possible sailing locations given the factors above and stored somewhere. 
** Then when homepage is loaded, the badges ares presented to user based on the prioritization above
** AI suggestions MUST NOT be queried online from frontpage, it is too slow and will incur too much cost
<!-- SECTION:DESCRIPTION:END -->
