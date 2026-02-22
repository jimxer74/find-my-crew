---
id: TASK-125
title: New onboarding wizard
status: To Do
assignee: []
created_date: '2026-02-21 16:20'
updated_date: '2026-02-22 18:51'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Additional onboarding wizard for owners

**Important** 
- This is additional onboarding flow to existing /welcome/owner AI assisted owner onboarding

UI / UX concept
- Use the current frontpage ui concept with the background image and role based color scheme, render controls and contents so that background image is visible, use same look and feel in controls as in frontpage ComboBox

Flow:
1. Sign-up and auth flow
- User is signed-up using the selected authentication method: email, google, facebook

2. Skipper profile
- A page with textarea and instructions to fill in skipper / onwer profile information.
- Next: Review profile (action: AI assessment of user profile)

Action: AI assessment: User input is passed to AI for profile assessment. AI should evaluate and deep reson the users input and assess if anything is missing or should require clarification or improvement. Main goal is the help skipper to create a trustworthy profile to capture interest of the possible crew members looking for sailing opportunities.

3. Skipper profile review
Based on AI assessment user proposed profile is displayed on the page. Page has following components:
- AI reasoning of the skippers profile shown as collapislbe text to skipper
- User name: text box, prefilled with name retrieved from the auth flow if available
- User emal: text box prefilled with email from auth flow if available
- User description / bio: textarea - Contains the user provided bio / desrciption augmented with proposals from AI assessment e.g. AI can propose to include or add certain text or propose to modify or remove some of the user provided descriptions if so reasoned in AI assessment
- Photo upload to add skipper photos (prefilled with user photo from auth flow if available)
- Next: Add skills (button to continue)
- Back button

4. Skipper sailing preferences
Page has following components:
- AI assessment reasoning in collapislbe text displayed to user
- Sailing preferences selection (Coastal sailing, Offshore sailing, Extreme sailing, same as in Profile edit page), preselected option based on the AI assessment
- Motivation and Sailing preferances: textarea, prefilled with AI assesment proposal

4. Skipper Sailing experience and skills
Page to display the AI assessed Experience level, skills and any certifications if provided by the user input in 2. step. Page has following components:
- AI assesment reasoning of skills and experience level as collapsible text displayed to user
- Experience level: (Beginner, Competent crew, Coastal skipper, Offshore Skipper), preselected by AI assessment of user input
- List of skills and skills details as proposed by the AI assessment. Skills must conform predefined skills in /config - User must be able to update / add in skills content / defintions and also remove proposed skills or add new skills --> similar as in Profile edit
- Certificates: textarea, prefilled with user provided certificates if any
- Next: Add boat (action: save profile into database)
- Back button

5. Boat
Page to add boat details. Page content:
- Similar contents as in Add New Boat
- Next: Journey (action: save boat into database)

6. Journey
Page to add a first Journey
- Similar page as Propose Journey
- Next: Journey details (action: use generate_journey tool to create journey)

Action: AI generates the journey and asses the journey's requirements  and proposes  risk level, crew requirements including experience level and needed skills and skills details.  

7. Journey details
Display the generated journey waypoints (similar as in Propese Journey flow)
Page has following components:
- AI assessment reasoning in collapsible text
- Journey Risk level - preselected by the AI assessment 
- Journey experience level - preselected by AI assesment
-
<!-- SECTION:DESCRIPTION:END -->
