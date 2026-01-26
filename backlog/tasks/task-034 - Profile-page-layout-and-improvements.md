---
id: TASK-034
title: Profile page layout and improvements
status: To Do
assignee: []
created_date: '2026-01-26 19:22'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Layout improvements:
- Change the layout similar as in Boat data Editing page. Make that a standard template that can be used in other detail or form pages as well.
- Update page layout into sections, similar as in Onwer / registrations / summary page with CollapsibleSection components
- Allways show the Profile Completion on the top if the percentage is below 100%, if it is 100% do not show the Profile completion at all
- Divide the profile page in folowing collapsible sections (numbered)

1. <Name of the user> Personal information
- User role selection
- User image
- Full name
- Username
- Email (if email in profiles table is empty, fetch it from Auth.users)
- Phone Number

2. Sailing Preferences
- Risk level prefenreces (selector)
- Motivation and Sailing Preferences (textbox)

3. Sailing experience and skills
- Sailing Experience Level selector
- Skills selector component
- Certifications and Qualifications

4. Notifications and Consensts
- Consent preferences: AI-Powered Matching, Profile Sharing, Marketing Communications
- Email Notifications: Registration updates, Journey Updates, Profile Reminders
<!-- SECTION:DESCRIPTION:END -->
