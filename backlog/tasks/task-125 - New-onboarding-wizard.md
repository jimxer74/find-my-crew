---
id: TASK-125
title: New onboarding wizard
status: To Do
assignee: []
created_date: '2026-02-21 16:20'
updated_date: '2026-02-22 10:32'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Additional onboarding wizard for owners

**Important** 
- This is additional onboarding flow to existing /welcome/owner AI assisted owner onboarding

UI / UX concept
- Use the current frontpage ui concept with the bacground image and role based color scheme, use full page views for main content, both dektop and mobile. Dialogs are separately defined if used. All pages MUST use the same approach.

Flow:
1. Skipper profile
- A page with textarea and instructions to fill in skipper / onwer profile information,  as much information as possible to fill the skipper profile
- Next button (action: AI assessment of user profile)

Action: AI assessment: User input is passed to AI for profile assessment. AI should evaluate and deep reson the users input and assess if anything is missing or should require clarification or improvement. Main goal is the help skipper to create a trustworthy profile to capture interest of the possible crew members looking for sailing opportunities.

2. Skipper profile review
Based on AI assessment user proposed profile is displayed on the page. Page has following components:
- AI reasoning of the skippers profile shown as text to skipper
- User description / bio: textarea - Contains the user provided bio / desrciption augmented with proposals from AI assessment e.g. AI can propose to include or add certain text or propose to modify or remove some of the user provided descriptions if so reasoned in AI assessment
- Next: Skills (button to continue)

3. Skipper Sailing experience and skills
<!-- SECTION:DESCRIPTION:END -->
