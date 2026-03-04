---
id: TASK-134
title: Bugs and Enhancements
status: In Progress
assignee: []
created_date: '2026-02-25 15:02'
updated_date: '2026-03-04 07:19'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
** /welcome/crew-v2 and owner-v2 flows**
- no consent modal displayd after signup
- OAuth signup redirects to /crew, should retain in ai flow
- Add link to profile completion banner to continue with ai onboarding
- When profile is saved after signup, role is not stored, it should be stored based on the onboarding flow. e.g. /welcome/crew-v2 should get crew role
- Make sure all the buttons in both crew and owner flows uses loading button in long running operations
- Fix "Send" button to match the input textbox size
- Add a disclaimer text before user click create account to indicate that by creating account user is confirming the usage of AI to access the profile data

** Privacy policy **
- Add loading button to DELETE BY ACCOUNT

** Frontpage **
- Update for Skippers and for Crew sections: remove AI consent toggle and add text below the textarea to indicate that by submitting users confirm the usage of AI to access the profile date. Remove consent validation logic from Post button
- Change top right Sign up button to "Log in"

** /crew/dashboard**
- In mobile view the botton sheet is not minimizable when user has scrolled the list downwards, the bottom sheet must be allways resizable
- Mobile view bottom sheet when fully maximized gets overfilled in the Header and cannot be resized anymore as it is renderec under the header.

** /welcome/crew and /welcome/owner**
- consent modal is not displayed after signup
- Update the UI use the same concept as in /welcome/crew-v2 and owner-v2 with same color schemes and glassmorphism look and feel
<!-- SECTION:DESCRIPTION:END -->
