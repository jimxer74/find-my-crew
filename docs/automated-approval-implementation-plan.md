# Automated Approval Flow Implementation Plan

## Overview
This document outlines the step-by-step implementation plan for Phase 3: Automated Approval flow, where owners can define custom requirements/questions for journeys, crew members answer them during registration, and AI evaluates and auto-approves high matches.

---

## Phase 1: Database Schema Extensions

### Step 1.1: Create `journey_requirements` Table
**Purpose**: Store custom questions/requirements per journey

**Fields**:
- `id` (UUID, primary key)
- `journey_id` (UUID, foreign key to journeys)
- `question_text` (TEXT, required) - The question to ask crew members
- `question_type` (ENUM: 'text', 'multiple_choice', 'yes_no', 'rating') - Type of question
- `options` (JSONB, nullable) - For multiple_choice questions, stores available options
- `is_required` (BOOLEAN, default true) - Whether answer is mandatory
- `weight` (INTEGER, 1-10) - Importance weight for AI matching (1=low, 10=critical)
- `order` (INTEGER) - Display order for questions
- `created_at`, `updated_at` (TIMESTAMPS)

**Indexes**:
- Index on `journey_id` for fast lookups
- Index on `(journey_id, order)` for ordered retrieval

---

### Step 1.2: Create `registration_answers` Table
**Purpose**: Store crew member answers to journey requirements

**Fields**:
- `id` (UUID, primary key)
- `registration_id` (UUID, foreign key to registrations)
- `requirement_id` (UUID, foreign key to journey_requirements)
- `answer_text` (TEXT, nullable) - For text/yes_no answers
- `answer_json` (JSONB, nullable) - For multiple_choice/rating answers
- `created_at`, `updated_at` (TIMESTAMPS)

**Constraints**:
- Unique constraint on `(registration_id, requirement_id)` - One answer per requirement per registration
- Foreign key constraints with CASCADE delete

**Indexes**:
- Index on `registration_id` for fast lookups
- Index on `requirement_id` for analytics

---

### Step 1.3: Add Auto-Approval Fields to `journeys` Table
**Purpose**: Enable and configure automated approval per journey

**New Fields**:
- `auto_approval_enabled` (BOOLEAN, default false) - Toggle automated approval
- `auto_approval_threshold` (INTEGER, 0-100, default 80) - Minimum match score for auto-approval

**Migration Notes**:
- Add columns with default values
- Existing journeys will have `auto_approval_enabled = false` by default

---

### Step 1.4: Add AI Assessment Fields to `registrations` Table
**Purpose**: Store AI-calculated match scores and reasoning

**New Fields**:
- `ai_match_score` (INTEGER, 0-100, nullable) - AI-calculated match percentage
- `ai_match_reasoning` (TEXT, nullable) - AI explanation of the score
- `auto_approved` (BOOLEAN, default false) - True if AI auto-approved this registration

**Indexes**:
- Index on `ai_match_score` for filtering/sorting
- Index on `auto_approved` for analytics

---

## Phase 2: Backend API Development

### Step 2.1: Journey Requirements Management API

#### `POST /api/journeys/[journeyId]/requirements`
**Purpose**: Create a new requirement for a journey

**Request Body**:
```json
{
  "question_text": "Do you have experience with night sailing?",
  "question_type": "yes_no",
  "is_required": true,
  "weight": 8,
  "options": null
}
```

**Response**: Created requirement object

**Validation**:
- Verify user owns the journey
- Validate question_type enum
- Validate weight range (1-10)
- If multiple_choice, require options array

---

#### `GET /api/journeys/[journeyId]/requirements`
**Purpose**: List all requirements for a journey

**Response**: Array of requirements ordered by `order` field

**Authorization**: Journey owner or public (if journey is published)

---

#### `PUT /api/journeys/[journeyId]/requirements/[requirementId]`
**Purpose**: Update an existing requirement

**Request Body**: Same as POST, all fields optional

**Validation**: Same as POST

---

#### `DELETE /api/journeys/[journeyId]/requirements/[requirementId]`
**Purpose**: Delete a requirement

**Note**: Check if there are existing registrations with answers to this requirement
- Option 1: Soft delete (mark as deleted)
- Option 2: Hard delete with warning if answers exist

---

#### `PATCH /api/journeys/[journeyId]/auto-approval`
**Purpose**: Enable/disable auto-approval and set threshold

**Request Body**:
```json
{
  "auto_approval_enabled": true,
  "auto_approval_threshold": 85
}
```

**Validation**:
- Threshold must be 0-100
- If enabling, verify at least one requirement exists

---

### Step 2.2: Registration Answers API

#### `POST /api/registrations/[registrationId]/answers`
**Purpose**: Submit answers for a registration (called during registration creation)

**Request Body**:
```json
{
  "answers": [
    {
      "requirement_id": "uuid",
      "answer_text": "Yes",
      "answer_json": null
    },
    {
      "requirement_id": "uuid",
      "answer_text": null,
      "answer_json": ["Option 1", "Option 2"]
    }
  ]
}
```

**Validation**:
- Verify registration belongs to authenticated user
- Verify all required questions are answered
- Validate answer format matches question_type

---

#### `GET /api/registrations/[registrationId]/answers`
**Purpose**: Get answers for a registration

**Authorization**: 
- Crew member: Can view their own answers
- Owner: Can view answers for registrations to their journeys

**Response**: Array of answer objects with requirement details

---

#### `PUT /api/registrations/[registrationId]/answers/[answerId]`
**Purpose**: Update an answer (only if registration status is 'Pending approval')

**Validation**: Same as POST

---

### Step 2.3: Update Registration Creation Flow

**Modify**: `POST /api/registrations`

**New Flow**:
1. Validate leg_id and check journey is published (existing)
2. Check if journey has `auto_approval_enabled = true` and has requirements
3. If yes:
   - Require `answers` array in request body
   - Validate all required questions are answered
   - Create registration with status 'Pending approval'
   - Save answers to `registration_answers` table
   - Trigger AI assessment (see Step 2.4)
   - If AI score >= threshold:
     - Update `status = 'Approved'`
     - Set `auto_approved = true`
   - Return registration with AI score and status
4. If no requirements or auto-approval disabled:
   - Create registration as before (status 'Pending approval')
   - No AI assessment

---

### Step 2.4: AI Assessment Service/API

#### `POST /api/ai/assess-registration/[registrationId]`
**Purpose**: Trigger AI assessment for a registration

**Process**:
1. Load data:
   - Registration details
   - Crew profile (skills, experience, risk tolerance)
   - Journey/leg data (requirements, skills, experience level, risk level)
   - Custom requirements and answers
   - Journey context (dates, boat type, etc.)

2. Build AI prompt:
   - System context: Role as sailing crew matching assistant
   - Crew profile summary (structured)
   - Journey/leg requirements summary
   - Custom requirements and answers (Q&A format)
   - Matching criteria explanation

3. Call AI service:
   - Provider: OpenAI GPT-4 / Anthropic Claude / etc.
   - Request structured JSON response:
     ```json
     {
       "match_score": 85,
       "reasoning": "Strong match due to...",
       "recommendation": "approve"
     }
     ```

4. Update registration:
   - Set `ai_match_score`
   - Set `ai_match_reasoning`
   - If score >= threshold:
     - Set `status = 'Approved'`
     - Set `auto_approved = true`
   - Otherwise: Keep `status = 'Pending approval'`

5. Return assessment result

**Error Handling**:
- If AI service fails: Log error, keep registration as 'Pending approval'
- Retry mechanism for transient failures
- Fallback to manual approval if AI unavailable

---

## Phase 3: Frontend Development

### Step 3.1: Journey Requirements Management UI (Owner)

**Location**: Journey edit page (`/owner/journeys/[journeyId]/edit`)

**New Section**: "Automated Approval Requirements"

**Features**:
1. **Toggle Switch**: Enable/disable automated approval
   - When enabled, show threshold slider
   - Show warning if no requirements exist

2. **Threshold Slider**: Auto-approval threshold (0-100%)
   - Default: 80%
   - Show explanation: "Registrations with match score above this threshold will be auto-approved"

3. **Requirements List**:
   - Display all requirements in order
   - Show question text, type, required flag, weight
   - Actions: Edit, Delete, Reorder (drag & drop)

4. **Add Requirement Form**:
   - Question text (textarea)
   - Question type (dropdown: text, multiple_choice, yes_no, rating)
   - Options field (conditional, shown only for multiple_choice)
   - Required checkbox
   - Weight slider (1-10)
   - Save/Cancel buttons

5. **Edit Requirement Modal**:
   - Same form as Add, pre-filled with existing data
   - Update on save

**UI Components Needed**:
- `RequirementsManager.tsx` - Main component
- `RequirementForm.tsx` - Add/Edit form
- `RequirementList.tsx` - List with drag & drop
- `AutoApprovalToggle.tsx` - Toggle + threshold slider

---

### Step 3.2: Registration Form Enhancement (Crew)

**Location**: Leg details panel (`LegDetailsPanel.tsx`)

**Enhancement**: When registering for a leg

**Flow**:
1. User clicks "Register" button
2. Check if journey has requirements:
   - If no requirements: Proceed with existing registration flow
   - If requirements exist: Show requirements form modal

3. **Requirements Form Modal**:
   - Display journey name and leg name
   - List all requirements in order
   - Render questions based on `question_type`:
     - **Text**: Textarea input
     - **Multiple choice**: Radio buttons (single) or checkboxes (multiple)
     - **Yes/No**: Radio buttons (Yes/No)
     - **Rating**: Star rating or slider (1-5 or 1-10)
   - Mark required questions with asterisk
   - Show validation errors
   - Submit button: "Submit Registration"
   - Cancel button

4. **On Submit**:
   - Validate all required questions answered
   - Collect answers into array format
   - Call `POST /api/registrations` with `leg_id`, `notes`, and `answers`
   - Show loading state
   - On success:
     - Show success message
     - If auto-approved: Show "Congratulations! You've been approved!"
     - If pending: Show "Registration submitted. Waiting for owner approval."
     - Close modal, refresh registration status

**UI Components Needed**:
- `RegistrationRequirementsForm.tsx` - Requirements form modal
- `QuestionRenderer.tsx` - Renders different question types
- Update `LegDetailsPanel.tsx` - Integrate requirements form

---

### Step 3.3: Registration Status Display Updates

**Crew View** (`/crew/registrations`):
- Show `ai_match_score` if available (e.g., "Match Score: 85%")
- Show `ai_match_reasoning` in tooltip or expandable section
- Visual indicator for auto-approved registrations (badge/icon)
- Show "Auto-approved" vs "Pending owner review"

**Owner View** (`/owner/registrations`):
- Show AI match score prominently
- Show AI reasoning in expandable section
- Show AI recommendation badge (if available)
- Show "Auto-approved by AI" indicator
- Allow manual override (approve/deny even if AI recommended differently)

**Components to Update**:
- `app/crew/registrations/page.tsx`
- `app/owner/registrations/page.tsx`
- `app/components/crew/LegDetailsPanel.tsx`

---

## Phase 4: AI Integration

### Step 4.1: AI Service Setup

**Choose Provider**:
- OpenAI GPT-4 (recommended for structured outputs)
- Anthropic Claude (good alternative)
- Local model (if privacy/cost is concern)

**Setup**:
1. Add API key to environment variables:
   - `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
2. Create service wrapper: `app/lib/aiService.ts`
   - Abstract provider-specific code
   - Handle API calls, errors, retries
   - Parse responses

**Service Interface**:
```typescript
interface AIAssessmentRequest {
  crewProfile: CrewProfile;
  journeyData: JourneyData;
  requirements: Requirement[];
  answers: Answer[];
}

interface AIAssessmentResponse {
  match_score: number; // 0-100
  reasoning: string;
  recommendation: 'approve' | 'deny' | 'review';
}

async function assessRegistration(request: AIAssessmentRequest): Promise<AIAssessmentResponse>
```

---

### Step 4.2: Prompt Engineering

**System Prompt**:
```
You are an expert sailing crew matching assistant. Your role is to assess how well a crew member matches the requirements for a sailing journey leg based on their profile, experience, and answers to custom questions.

You will receive:
1. Crew member profile (skills, experience level, risk tolerance)
2. Journey/leg requirements (required skills, experience level, risk level)
3. Custom questions and the crew member's answers
4. Journey context (dates, boat type, etc.)

Evaluate the match and provide:
- A match score from 0-100
- Clear reasoning for the score
- A recommendation: approve, deny, or needs review

Be fair, thorough, and consider both technical skills and personal fit.
```

**User Prompt Template**:
```
Crew Member Profile:
- Name: {full_name}
- Experience Level: {sailing_experience}
- Skills: {skills}
- Risk Tolerance: {risk_level}
- Sailing Preferences: {sailing_preferences}

Journey Requirements:
- Journey: {journey_name}
- Leg: {leg_name}
- Required Skills: {required_skills}
- Required Experience Level: {min_experience_level}
- Risk Level: {risk_level}
- Dates: {start_date} to {end_date}
- Boat Type: {boat_type}

Custom Questions & Answers:
{For each requirement:
- Q: {question_text}
- A: {answer_text or answer_json}
- Weight: {weight}
}

Please assess this match and provide a JSON response with:
- match_score: integer 0-100
- reasoning: string explaining your assessment
- recommendation: "approve", "deny", or "review"
```

**Response Parsing**:
- Expect JSON response
- Validate score is 0-100
- Handle malformed responses gracefully
- Log for debugging

---

### Step 4.3: Error Handling & Fallbacks

**Error Scenarios**:
1. **API Key Missing**: Log error, skip AI assessment, manual approval only
2. **API Rate Limit**: Implement exponential backoff retry
3. **API Timeout**: Set timeout (30s), retry once, then fallback
4. **Invalid Response**: Log error, keep registration pending
5. **Network Error**: Retry with exponential backoff

**Fallback Strategy**:
- If AI assessment fails: Registration remains 'Pending approval'
- Owner can still manually approve/deny
- Log all failures for monitoring
- Consider queue system for async processing if sync becomes too slow

**Monitoring**:
- Track AI assessment success/failure rates
- Track average response time
- Track auto-approval rates
- Alert on high failure rates

---

## Phase 5: Testing & Refinement

### Step 5.1: Unit Tests

**Database Migrations**:
- Test table creation
- Test foreign key constraints
- Test indexes
- Test default values

**API Endpoints**:
- Test requirement CRUD operations
- Test answer submission and validation
- Test registration creation with requirements
- Test AI assessment triggering
- Test authorization (owner vs crew)

**AI Service**:
- Test prompt building
- Test response parsing
- Test error handling
- Mock AI responses for consistent testing

**Answer Validation**:
- Test required field validation
- Test answer format validation per question type
- Test weight validation

---

### Step 5.2: Integration Tests

**End-to-End Flows**:
1. **Owner creates requirements → Crew registers → AI assesses → Auto-approves**
2. **Owner creates requirements → Crew registers → AI assesses → Stays pending (low score)**
3. **Owner creates requirements → Crew registers → AI fails → Manual approval**
4. **Owner disables auto-approval → Crew registers → No AI assessment**

**Edge Cases**:
- No requirements defined
- Partial answers (some required questions unanswered)
- Invalid answer formats
- Journey with requirements but auto-approval disabled
- Multiple registrations for same leg
- Requirements deleted after registrations exist

---

### Step 5.3: User Acceptance Testing

**Owner Testing**:
- Create journey with requirements
- Enable auto-approval
- Verify registrations are auto-approved correctly
- Verify manual override works
- Test requirement management (add/edit/delete/reorder)

**Crew Testing**:
- Register for leg with requirements
- Answer all question types correctly
- Verify validation errors
- Verify success messages
- Verify registration status updates

**AI Accuracy Testing**:
- Test with various crew profiles
- Verify scores are reasonable
- Verify reasoning is clear and helpful
- Compare AI recommendations with manual assessments

---

## Phase 6: Documentation & Deployment

### Step 6.1: User Documentation

**Owner Guide**:
- How to enable automated approval
- How to create and manage requirements
- Understanding match scores and thresholds
- When to use manual vs automated approval

**Crew Guide**:
- How to answer requirements during registration
- Understanding match scores
- What happens after registration

**FAQ**:
- What is automated approval?
- How does AI matching work?
- Can I change my answers after submitting?
- What if I don't meet all requirements?

---

### Step 6.2: Technical Documentation

**API Documentation**:
- Document all new endpoints
- Request/response examples
- Error codes and handling
- Authentication requirements

**Database Schema**:
- ER diagram
- Table relationships
- Index strategy
- Migration guide

**AI Integration**:
- Prompt engineering notes
- Provider setup instructions
- Cost estimation
- Performance considerations

**Deployment Guide**:
- Environment variables needed
- Database migration steps
- Feature flag considerations
- Rollback plan

---

## Implementation Order Recommendation

### Priority 1: Foundation (Week 1-2)
1. ✅ Phase 1: Database Schema Extensions
2. ✅ Phase 2.1-2.3: Backend APIs (Requirements & Answers)
3. ✅ Phase 3.1: Owner UI for Requirements Management

### Priority 2: Core Functionality (Week 3-4)
4. ✅ Phase 3.2: Crew Registration Form Enhancement
5. ✅ Phase 2.4: AI Assessment API (Basic)
6. ✅ Phase 4.1: AI Service Setup

### Priority 3: AI Integration (Week 5-6)
7. ✅ Phase 4.2: Prompt Engineering
8. ✅ Phase 4.3: Error Handling & Fallbacks
9. ✅ Phase 3.3: Status Display Updates

### Priority 4: Polish & Quality (Week 7-8)
10. ✅ Phase 5: Testing & Refinement
11. ✅ Phase 6: Documentation & Deployment

---

## Open Questions to Resolve

### 1. AI Provider Selection
- **Question**: Which AI service provider should we use?
- **Options**: OpenAI GPT-4, Anthropic Claude, Local model
- **Considerations**: Cost, latency, quality, privacy
- **Recommendation**: Start with OpenAI GPT-4 for best results, consider Claude for cost optimization

### 2. Sync vs Async Processing
- **Question**: Should AI assessment be synchronous or asynchronous?
- **Options**: 
  - Sync: Wait for AI response before returning (better UX, slower)
  - Async: Queue job, return immediately, update later (faster, requires webhooks/background jobs)
- **Recommendation**: Start with sync for MVP, move to async if latency becomes issue

### 3. Cost Management
- **Question**: What's the budget for AI API calls?
- **Considerations**: 
  - Cost per assessment (~$0.01-0.05 per call)
  - Expected volume of registrations
  - Rate limiting strategy
- **Recommendation**: Implement rate limiting and cost tracking from start

### 4. Default Threshold
- **Question**: What should the default auto-approval threshold be?
- **Options**: 70%, 80%, 85%, 90%
- **Recommendation**: Start with 80%, allow owners to adjust

### 5. Question Types
- **Question**: Are the proposed question types sufficient?
- **Current**: text, multiple_choice, yes_no, rating
- **Considerations**: File uploads, date selection, location selection
- **Recommendation**: Start with basic types, add more as needed

### 6. Weight System
- **Question**: How should requirement weights affect scoring?
- **Options**: 
  - Linear weighting
  - Exponential weighting
  - Critical requirements (must-have vs nice-to-have)
- **Recommendation**: Linear weighting for simplicity, document clearly

### 7. Retry Logic
- **Question**: How many retries for failed AI assessments?
- **Options**: 0 (fail fast), 1, 2, 3
- **Recommendation**: 2 retries with exponential backoff

### 8. Monitoring & Analytics
- **Question**: What metrics should we track?
- **Options**: 
  - AI assessment success rate
  - Auto-approval rate
  - Average match scores
  - Owner override rate
- **Recommendation**: Track all of the above, create dashboard

---

## Success Criteria

### Functional Requirements
- ✅ Owners can create custom requirements for journeys
- ✅ Crew members can answer requirements during registration
- ✅ AI assesses registrations and provides match scores
- ✅ High-scoring registrations are auto-approved
- ✅ Low-scoring registrations remain pending for manual review
- ✅ Owners can manually override AI decisions

### Performance Requirements
- ✅ AI assessment completes within 10 seconds (sync) or 2 minutes (async)
- ✅ Registration creation with requirements completes within 15 seconds
- ✅ Requirements form loads within 2 seconds

### Quality Requirements
- ✅ AI match scores are consistent and reasonable
- ✅ AI reasoning is clear and helpful
- ✅ Auto-approval accuracy > 85% (validated by owner feedback)
- ✅ System handles errors gracefully without data loss

---

## Risk Mitigation

### Risk 1: AI Service Unavailability
- **Mitigation**: Fallback to manual approval, retry mechanism, queue system

### Risk 2: Poor AI Accuracy
- **Mitigation**: Iterative prompt improvement, owner feedback loop, manual override always available

### Risk 3: High API Costs
- **Mitigation**: Rate limiting, cost tracking, caching, consider async processing

### Risk 4: Complex Requirements
- **Mitigation**: Start simple, iterate based on feedback, comprehensive testing

### Risk 5: Data Privacy
- **Mitigation**: Review AI provider privacy policy, consider data anonymization, local model option

---

## Next Steps

1. **Review and Approve Plan**: Get stakeholder approval on approach
2. **Resolve Open Questions**: Make decisions on AI provider, sync/async, etc.
3. **Create Detailed Technical Specs**: Expand each phase into detailed tasks
4. **Set Up Development Environment**: AI API keys, test accounts, etc.
5. **Begin Phase 1**: Start with database schema extensions

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: Development Team  
**Status**: Draft - Awaiting Approval
