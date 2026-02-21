---
id: TASK-125
title: New onboarding wizard
status: To Do
assignee: []
created_date: '2026-02-21 16:20'
updated_date: '2026-02-21 16:36'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Additional onboarding wizard

**Important** 
- This is additional onboarding flow to existing /welcome/owner AI assisted owner onboarding
- This is combined wizard for both Crew and Owner roles with role specific different flows

UI / UX concept
- Use the current frontpage ui concept with the bacground image and role based color scheme, use full page views for main content, both dektop and mobile. Dialogs are separately defined if used. All pages MUST use the same approach.

Flow:
1. Profile input page (commom functionality for both CREW and OWNER, but role specific color scheme to be used depending on the role)
- A page with textarea and instructions to fill in profile information
- Next button (action starts AI assesment)

Action: Profile input is send to AI for assessment, AI needs to assess the given profile and return a proposed Comfort Level and Experience Level (as in /config) and also return any identified skills with skills defitions as provided by the user in profile input or that have been resolved or reasoned by the AI. Also to return user description - AI should return the contents to fill profiles table as completely as possible. This information needs to be stored in session table (onwer or prospect). AI also needs to return a reasoning.

2. Comfort level (Crew & Owner)
- Page displays AI reasoning text and  a Comfort level selection cards (similar as in Profile edit page) where levels are selected as AI has proposed in assessment. User can change the selections. Multiselect
- Next button (action: 
-
<!-- SECTION:DESCRIPTION:END -->
