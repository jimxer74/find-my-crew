---
id: TASK-103
title: Registration requirements refactoring
status: To Do
assignee: []
created_date: '2026-02-16 18:40'
updated_date: '2026-02-16 20:58'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactoring of the registration requirements management and auto-approval functionality

When user clicks the "+ Add Requirement" a new requirement is added to a list below. A first field is a drop down that user can choose the requirement type, Requirement types are:

-Risk Level - <as defined in for Journey> e.g. Offshore sailing --> means that user must have defined this sailing comfort level in user profile to be eligible registration

-Sailing exeperience level <as defined for Journey> e.g Competent crew --> this means that user must have at least the same experience level as is for journey to be eligible for the registration

-Skill <as defined for Journey> e.g. Sailing experience: List all the skills that are defined for the journey --> when skill type is selected a textarea is displayed for skipper to define the qualification criteria in free text that is matched against the users profile same skill description in autoapproval AI assessment.  e.g. skipper can type in for sailing_experince qualification criteria as "user must provide clear and evidence of prior sailing exeprience in user's skill description". Each skill type requirement has a weigh that can be adjusted 0 - 10. Skipper defines the passing score setting for the journey, e.g. 0 - 10, so that combined AI assessment score of the skills analysis must be same of above to pass

-Passport --> this means that user must have a valid passport in the document vault and user needs to grant access permission to it for AI assessment (and for skipper if manual registration is enabled). Skipper can further add more stricter validity check e.g "Require photo-validation" to be to enfoced where when registering user must take or provide a facial photo so that AI can verify the validity of the user against the provided passport. Skipper can define a pass confidence score 0-10

-Question --> it this selected a two texteareas are displayed, where first is the question text and second one is the qualification criteria that is used to assess the users answer against by AI in autoapproval

Autoapproval functionality:

Requirements are retrieved for Journey when user wants to register a leg. Simple verification steps are done first that do not require AI yet:
1. IF there is Risk level requirment, check if user has the defined risk ( comfort ) level defined in profile, if not, registration is NOT possible and registration flow ends (notification to user that risk level does not match)

2. IF there is Experience level requirement set, check if users profile experience level is same or above the journeys experience level. If below, flow ends and user is notified

3. IF there is a Passport requirement, a user's passport is passed to AI for analysis of validity and if a photo identification is required, user is prompted to provide a facial photo and upload it ,AI then validates the passport and verifies the photo against the passport if AI assessment confidence score is below the defined score level flow ends.

4. Retrieve all the skill requirements and their qualification criteria and pass them to AI for assessment, AI should return a assessment score based on the weights and reasoning the for the score. If score is at or above the skipper defined threshold, it is considered passed. below the flow ends and user is notified
<!-- SECTION:DESCRIPTION:END -->
