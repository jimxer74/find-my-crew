---
id: TASK-024
title: Owner Registration Summary Page
status: To Do
assignee: []
created_date: '2026-01-24 20:19'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A registration summary page for owner to see all the details of single registration by a crew. Page should contain the following information:

Status of the registration
Crew Avatar and name and registration date
Journey name and start and end dates
Leg start and end places and start and end dates
Leg distance and duration (calculated from distance with the boat avg speed)

Risk level
Minimum experience level
Required skills and skills matching

AI provided assessment if exists
Registration requirements questions and answers
Additional notes from crew

Functionality to Approve and Deny to registration

This registration summary page should open from the related notification, in My Crew registrations list by clicking the status tag, and from Journey map left pane by clicking the status tag.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Check LegDetailsPanel.tsx for UI implementation details, use the similar approach
Check the /specs/functions.sql of how the leg and journey skills, risk level and Experience levels retrieval logic is implemented, similar logic should be used here
<!-- SECTION:PLAN:END -->
