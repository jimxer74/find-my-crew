---
id: TASK-103
title: Registration requirements refactoring
status: In Progress
assignee: []
created_date: '2026-02-16 18:40'
updated_date: '2026-02-17 10:59'
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

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Owner can add a Risk Level requirement type - when selected, auto-checks crew profile risk_level against the journey's required risk level
- [x] #2 Owner can add an Experience Level requirement type - when selected, auto-checks crew profile sailing_experience against the journey's min_experience_level
- [x] #3 Owner can add Skill requirement types - each skill from the journey's skills list is shown, owner provides free-text qualification criteria per skill and weight (0-10). A passing_score threshold is configurable on the journey level
- [x] #4 Owner can add a Passport requirement type - verifies user has valid passport in document vault. Optional 'require photo validation' toggle with configurable confidence score (0-10)
- [x] #5 Owner can add Question requirement types - free-text question with qualification criteria for AI assessment
- [x] #6 Registration flow performs sequential checks: (1) Risk Level auto-check, (2) Experience Level auto-check, (3) Passport AI verification, (4) Skill AI assessment with weighted scoring, (5) Question AI assessment
- [x] #7 Non-AI checks (risk level, experience level) fail fast with user notification before reaching AI steps
- [x] #8 Skill assessment returns per-skill scores based on weights; combined score must meet or exceed the journey's passing_score threshold
- [ ] #9 Passport verification uses document vault integration and optionally requires photo-ID validation with configurable confidence
- [x] #10 All new requirement types are properly handled in the RequirementsManager (owner UI) and registration flow (crew UI)
- [x] #11 Database schema (specs/tables.sql) is updated as single source of truth including journey_requirements, registration_answers, and journey auto-approval fields
- [x] #12 Migration files created for all schema changes
- [x] #13 GDPR account deletion logic updated to handle new tables/columns
- [x] #14 AI assessment prompt updated to handle the new structured requirement types instead of generic Q&A
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan for TASK-103: Registration Requirements Refactoring

### Overview
Refactor the registration requirements from generic question types (text/yes_no/multiple_choice/rating) to domain-specific requirement types (risk_level, experience_level, skill, passport, question) with a sequential auto-approval flow.

**Note:** No backward compatibility needed. Existing data in journey_requirements, registration_answers, and related fields is test data and will be dropped/recreated cleanly.

---

### Phase 1: Database Schema Changes

#### 1.1 Update `specs/tables.sql` (Source of Truth)
Document and define the complete schema for all requirement-related tables and columns:

**Add to `journeys` table:**
- `auto_approval_enabled` BOOLEAN DEFAULT false
- `auto_approval_threshold` INTEGER CHECK (0-100) DEFAULT 80
- `skill_passing_score` INTEGER CHECK (0-10) DEFAULT 7 — threshold for combined AI skill assessment

**Add to `registrations` table:**
- `ai_match_score` INTEGER CHECK (0-100)
- `ai_match_reasoning` TEXT
- `auto_approved` BOOLEAN DEFAULT false

**Create `journey_requirements` table (fresh):**
```sql
CREATE TABLE journey_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  requirement_type VARCHAR(50) NOT NULL, -- 'risk_level', 'experience_level', 'skill', 'passport', 'question'
  -- For 'question' type:
  question_text TEXT,
  -- For 'skill' type:
  skill_name TEXT, -- canonical skill name from skills-config.json
  -- For 'skill' and 'question' types:
  qualification_criteria TEXT, -- free-text criteria for AI assessment
  weight INTEGER DEFAULT 5 CHECK (weight >= 0 AND weight <= 10),
  -- For 'passport' type:
  require_photo_validation BOOLEAN DEFAULT false,
  pass_confidence_score INTEGER DEFAULT 7 CHECK (pass_confidence_score >= 0 AND pass_confidence_score <= 10),
  -- Common fields:
  is_required BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- Indexes on journey_id, (journey_id, order)
- RLS: owners can CRUD their own journey's requirements, published journey requirements viewable by all

**Create `registration_answers` table (fresh):**
```sql
CREATE TABLE registration_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES journey_requirements(id) ON DELETE CASCADE,
  -- For 'question' type:
  answer_text TEXT,
  answer_json JSONB,
  -- For AI-assessed types (skill, question, passport):
  ai_score INTEGER, -- 0-10 per-requirement AI score
  ai_reasoning TEXT,
  -- For passport type:
  passport_document_id UUID REFERENCES document_vault(id),
  photo_verification_passed BOOLEAN,
  photo_confidence_score NUMERIC(3,2), -- 0.00-1.00
  -- Common:
  passed BOOLEAN, -- whether this individual requirement was met
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(registration_id, requirement_id)
);
```
- Indexes on registration_id, requirement_id
- RLS: crew can view own answers, owners can view answers for their journeys

#### 1.2 Create Migration File
- File: `migrations/038_refactor_requirements_system.sql`
- **Clean slate approach** (no backward compat):
  1. DROP `registration_answers` table if exists (cascade)
  2. DROP `journey_requirements` table if exists (cascade)
  3. Add `skill_passing_score` to `journeys` (if not exists)
  4. Add `ai_match_score`, `ai_match_reasoning`, `auto_approved` to `registrations` (if not exists)
  5. CREATE `journey_requirements` with new schema
  6. CREATE `registration_answers` with new schema
  7. Add RLS policies and indexes
  8. Clean up any orphaned registration data referencing old requirements

#### 1.3 Update GDPR Deletion
- File: `app/api/user/delete-account/route.ts`
- Add `registration_answers` deletion (by joining through registrations.user_id)
- Add to `checkForConstraintViolations()` and `verifyUserDeletion()`
- `journey_requirements` cascades from journeys→boats→owner, so covered by boat deletion

---

### Phase 2: Backend API Refactoring

#### 2.1 Requirements API (`app/api/journeys/[journeyId]/requirements/route.ts`)
- Replace old question_type validation with new requirement_type validation
- Validate type-specific fields:
  - `risk_level`: no extra fields needed (uses journey's risk_level)
  - `experience_level`: no extra fields needed (uses journey's min_experience_level)
  - `skill`: requires `skill_name` + `qualification_criteria` + `weight`
  - `passport`: optional `require_photo_validation` + `pass_confidence_score`
  - `question`: requires `question_text` + `qualification_criteria` + `weight`
- Enforce at most ONE `risk_level` and ONE `experience_level` requirement per journey
- For `skill` type: validate `skill_name` against skills-config.json

#### 2.2 Registration Flow (`app/api/registrations/route.ts`)
Refactor the registration creation to implement the sequential check flow:

```
Step 1: Risk Level Check (instant)
  → Load risk_level requirement if exists
  → Compare crew profile.risk_level array with journey risk_level
  → If crew doesn't have the required risk level → FAIL, return 400

Step 2: Experience Level Check (instant)
  → Load experience_level requirement if exists
  → Compare crew profile.sailing_experience with journey min_experience_level
  → If crew level < required level → FAIL, return 400

Step 3: Create registration record (status: 'Pending approval')
  → Save crew answers for question types
  → Save passport document reference for passport type

Step 4: Passport Verification (async AI - if requirement exists)
  → Retrieve crew's passport from document_vault via access grant
  → Call AI for passport validity assessment
  → If photo validation required: prompt for photo, AI verifies identity
  → Score against pass_confidence_score threshold
  → Record result in registration_answers

Step 5: Skill Assessment (async AI - if skill requirements exist)
  → For each skill requirement:
    - Get crew profile skill description for this skill
    - Pass to AI with qualification_criteria
    - AI returns score (0-10) per skill, weighted
  → Calculate combined weighted score
  → Compare against journey.skill_passing_score
  → Record per-skill results in registration_answers

Step 6: Question Assessment (async AI - if question requirements exist)
  → For each question requirement:
    - Pass crew's answer + qualification_criteria to AI
    - AI returns score (0-10)
  → Record results in registration_answers

Step 7: Auto-approval Decision
  → If ALL requirements passed → auto-approve
  → If any failed → keep as 'Pending approval', notify owner
```

#### 2.3 AI Assessment Service (`app/lib/ai/assessRegistration.ts`)
Major refactoring to support new assessment types:

- `assessSkillRequirements()` - Per-skill AI assessment with qualification criteria matching
- `assessPassportRequirement()` - Passport validity + optional photo verification
- `assessQuestionRequirements()` - Free-text Q&A assessment against criteria
- `calculateCombinedSkillScore()` - Weighted score calculation
- Rewrite `buildAssessmentPrompt()` for new structured format
- Each assessment function returns individual scores + reasoning

---

### Phase 3: Frontend - Owner UI (RequirementsManager)

#### 3.1 Refactor RequirementsManager.tsx
**New UX flow:**
1. Owner clicks "+ Add Requirement"
2. First field is a dropdown to select requirement type
3. Based on type, different fields appear:
   - **Risk Level**: No extra config needed (auto-derived from journey settings). Shows info text explaining the check.
   - **Experience Level**: No extra config needed. Shows info text.
   - **Skill**: Dropdown of skills from journey's skills list → textarea for qualification criteria → weight slider (0-10)
   - **Passport**: Toggle for "Require photo validation" → confidence score slider (0-10)
   - **Question**: Textarea for question text → textarea for qualification criteria → weight slider (0-10)

4. Add `skill_passing_score` slider to journey settings (alongside auto_approval_threshold)

**Key files to modify:**
- `app/components/manage/RequirementsManager.tsx` - Main refactoring
- Possibly extract `RequirementTypeForm.tsx` as a sub-component

---

### Phase 4: Frontend - Crew Registration Flow

#### 4.1 Refactor RegistrationRequirementsForm.tsx
**New registration flow for crew:**
1. **Pre-check phase** (before showing form):
   - Auto-check risk level against profile → if fail, show "Your comfort level doesn't match" and block registration
   - Auto-check experience level against profile → if fail, show "Your experience level is below requirements" and block registration

2. **Passport phase** (if passport requirement exists):
   - Check if user has a passport in document vault
   - If not → prompt to upload one first
   - If yes → request access grant for this journey's owner
   - If photo validation required → prompt to upload/take photo

3. **Skills display** (informational):
   - Show which skills will be AI-assessed and their weights
   - Skills are assessed from profile data, not from manual input during registration

4. **Questions phase** (if question requirements exist):
   - Show free-text questions for crew to answer
   - These answers are submitted and AI-assessed

5. **Submit** → show loading state → show result (approved/pending)

**Key files to modify:**
- `app/components/crew/RegistrationRequirementsForm.tsx`
- `app/components/crew/LegRegistrationDialog.tsx`
- `app/hooks/useLegRegistration.ts`

---

### Phase 5: Testing & Validation

- Test each requirement type individually
- Test the full sequential flow
- Test fail-fast behavior for risk/experience checks
- Test passport verification with document vault
- Test GDPR deletion with new tables

---

### Files to Create
1. `migrations/038_refactor_requirements_system.sql`

### Files to Modify (Major)
1. `specs/tables.sql` - Add all missing tables and new columns
2. `app/api/journeys/[journeyId]/requirements/route.ts` - New requirement types
3. `app/api/registrations/route.ts` - Sequential check flow
4. `app/lib/ai/assessRegistration.ts` - New assessment types
5. `app/components/manage/RequirementsManager.tsx` - New owner UI
6. `app/components/crew/RegistrationRequirementsForm.tsx` - New crew flow
7. `app/components/crew/LegRegistrationDialog.tsx` - Updated dialog
8. `app/hooks/useLegRegistration.ts` - Updated hook
9. `app/api/user/delete-account/route.ts` - GDPR updates

### Files to Modify (Minor)
1. `app/api/journeys/[journeyId]/auto-approval/route.ts` - Add skill_passing_score
2. `app/api/registrations/[registrationId]/answers/route.ts` - New answer fields

### Risks & Considerations
- **Passport flow complexity**: Document vault access grants, photo upload, and AI verification add significant UX complexity. Consider implementing passport as a later sub-phase.
- **AI cost**: Each skill is assessed individually. For journeys with many skills, this means multiple AI calls. Consider batching skills into a single prompt.
- **Photo verification**: Requires new photo upload UI during registration. This is a new capability not currently in the registration flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Remaining Work (as of 2026-02-17):

1. Display acknowledgement/Thank you message after successful registration
2. Hide Registration/Join button when user already has pending or approved registration for the leg
3. Verify /crew/dashboard map displays pending and approved registration status correctly
4. Send notification to crew when auto-approval fails (registration remains pending)
5. Send notification to crew when registration is approved (either manual or AI assessment)

These items should be implemented as part of the registration flow completion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Registration Requirements Refactoring - Implementation Complete

### Summary
Refactored the entire registration requirements system from generic question types (`text`, `multiple_choice`, `yes_no`, `rating`) to domain-specific requirement types (`risk_level`, `experience_level`, `skill`, `passport`, `question`) with a sequential auto-approval flow.

### Changes Made

**Database & Schema:**
- `specs/tables.sql` - Updated as source of truth with new `journey_requirements` and `registration_answers` tables, added `auto_approval_enabled`, `auto_approval_threshold`, `skill_passing_score` to journeys, added `ai_match_score`, `ai_match_reasoning`, `auto_approved` to registrations
- `migrations/038_refactor_requirements_system.sql` - Clean slate migration (DROP + CREATE)

**Backend APIs:**
- `app/api/journeys/[journeyId]/requirements/route.ts` - Full rewrite for new requirement types with singleton enforcement, type-specific validation
- `app/api/journeys/[journeyId]/requirements/[requirementId]/route.ts` - Updated PUT/DELETE for new requirement types
- `app/api/journeys/[journeyId]/auto-approval/route.ts` - Added `skill_passing_score` support
- `app/api/registrations/route.ts` - Added pre-check flow (risk_level → experience_level), updated answer handling for question-type only, fixed AI trigger conditions
- `app/lib/ai/assessRegistration.ts` - Full rewrite with `performPreChecks()`, `assessSkillRequirements()`, `assessQuestionRequirements()`, `calculateCombinedSkillScore()`, weighted scoring, sequential assessment flow

**Owner UI:**
- `app/components/manage/RequirementsManager.tsx` - Full rewrite with type-specific forms, singleton type management, skill passing score slider, skill dropdown from journey skills config

**Crew Registration Flow:**
- `app/components/crew/RegistrationRequirementsForm.tsx` - Rewritten to show only question-type requirements, added auto-check info banner
- `app/components/crew/LegRegistrationDialog.tsx` - Updated to use `hasQuestionRequirements` for form display logic
- `app/hooks/useLegRegistration.ts` - Added `hasQuestionRequirements` state for distinguishing question-type from non-question requirements

**GDPR:**
- `app/api/user/delete-account/route.ts` - Added `registration_answers` deletion cascade

### Note
AC #9 (Passport document vault integration with photo-ID validation) requires additional photo upload UI during registration that was deferred as noted in the plan. The passport requirement type is fully supported in schema, API, and owner UI, but the full photo verification UX flow needs a separate task.
<!-- SECTION:FINAL_SUMMARY:END -->
