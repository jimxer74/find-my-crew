# Passport Requirement with Photo-Validation Flow Analysis

## Current State (TASK-103 AC #9 - DEFERRED)

This feature is **partially implemented at the database/schema level** but **NOT fully implemented in the UI/UX flow**.

---

## What SHOULD Happen: Expected Crew Registration Flow

### Phase 1: Pre-Check (Before Registration Dialog)
```
User clicks "Register for leg"
  ↓
System loads requirements for journey
  ↓
Check if "passport" requirement exists
  ├─ YES: Display info message "Passport verification required"
  └─ NO: Continue to Phase 2
  ↓
Check passport requirement settings:
  - require_photo_validation: boolean
  - pass_confidence_score: 0-10 threshold
```

### Phase 2: Passport Verification Dialog
**NEW STEP - Currently Missing**

```
Display: "Passport Verification Required"
  ├─ Check 1: Does user have passport in document vault?
  │   ├─ YES: Show passport details and request access grant
  │   └─ NO: Show "Please upload passport first" with link to document vault
  │
  └─ Check 2: If require_photo_validation is TRUE
      ├─ Show: "Photo verification required for this journey"
      ├─ Prompt: "Take or upload a facial photo"
      ├─ Show camera/upload UI
      └─ Wait for photo upload
```

### Phase 3: Question-Type Requirements (Existing)
```
If question-type requirements exist:
  - Display RegistrationRequirementsForm
  - User answers questions
  - Show notes field
```

### Phase 4: Submission & AI Assessment
```
User clicks Submit
  ↓
API receives registration with:
  - leg_id
  - notes (optional)
  - answers (for question-type requirements)
  - passport_reference (passport from vault) [MISSING]
  - photo_file (if required) [MISSING]
  ↓
Backend performs assessments:
  1. Pre-checks (risk_level, experience_level) ✅ Implemented
  2. Passport AI verification [MISSING]
     - Retrieve passport document
     - AI analyzes passport validity
     - AI analyzes if the passport information matches with the profile information, names, etc. 
     - If photo required: AI validates photo against passport
     - Compare confidence score against pass_confidence_score threshold
     - If confidence < threshold: FAIL registration
  3. Skill AI assessment ✅ Implemented
  4. Question AI assessment ✅ Implemented
  ↓
Decision:
  - All pass: Auto-approve or keep pending
  - Any fail: Keep as "Pending approval" + notify crew
```

---

## What's Currently Implemented ✅

### Database Schema (✅ Complete)
- `journey_requirements` table with:
  - `requirement_type = 'passport'`
  - `require_photo_validation: boolean`
  - `pass_confidence_score: integer (0-10)`

- `registration_answers` table with fields for passport:
  - `passport_document_id: uuid` (reference to document_vault)
  - `photo_verification_passed: boolean`
  - `photo_confidence_score: numeric(0.00-1.00)`
  - `passed: boolean`

### API & Owner UI (✅ Partially Complete)
- Owner can create passport requirements ✅
- Owner can set photo validation requirement ✅
- Owner can set confidence score threshold ✅

### Crew Registration Flow (❌ Missing)
- NO passport selection/upload UI during registration
- NO photo upload UI during registration
- NO passport verification display to user
- NO link to document vault for passport access

---

## What's Missing 🚫

### 1. Crew-Side UI Components
**Missing Components:**
- `PassportVerificationModal` or similar
- Camera/Photo upload UI for facial photo
- Passport selection interface
- Document vault access request UI

**File Locations Needed:**
```
app/components/crew/
  ├─ PassportVerificationStep.tsx (NEW)
  ├─ PhotoUploadModal.tsx (NEW)
  └─ PassportSelector.tsx (NEW)
```

### 2. Registration Flow Integration
**Modified Files Needed:**
- `app/components/crew/RegistrationRequirementsForm.tsx`
  - Add passport requirement handling
  - Add logic to check for passport requirements
  - Integrate photo upload UI

- `app/components/crew/LegRegistrationDialog.tsx` or `LegDetailsPanel.tsx`
  - Add passport verification step before question requirements
  - Manage passport data state

### 3. API Modifications
**Modified Files Needed:**
- `app/api/registrations/route.ts`
  - Accept `passport_document_id` from frontend
  - Accept `photo_file` or `photo_url` from frontend
  - Pass to AI assessment service

### 4. AI Assessment Service
**New Functions Needed in `app/lib/ai/assessRegistration.ts`:**
```typescript
async function assessPassportRequirement(
  supabase: SupabaseClient,
  registrationId: string,
  requirement: PassportRequirement,
  passportDocumentId: string,
  photoData?: { file: Blob } | { url: string }
): Promise<PassportAssessmentResult>

interface PassportAssessmentResult {
  passed: boolean;
  passportValid: boolean;
  photoVerified: boolean;
  confidenceScore: number; // 0-1
  aiReasoning: string;
}
```

### 5. Document Vault Integration
**Required Integration:**
- Fetch passport from document_vault
- Request/verify access grants
- Pass document to AI for verification

---

## Implementation Challenges 🤔

### 1. Photo Capture/Upload UI
- **Challenge:** No existing camera/photo upload UI in the app
- **Required:** Browser Camera API + file upload
- **Complexity:** Medium
- **Libraries needed:**
  - `react-camera-pro` or similar
  - File compression for large images

### 2. Async Document Processing
- **Challenge:** Retrieving documents from vault + AI verification is slow
- **Current approach:** Use `waitUntil()` for async AI assessment (✅ done)
- **Issue:** Photo validation during registration might cause timeouts
- **Solution:** Consider background processing with polling

### 3. Document Vault Access Grants
- **Challenge:** Must verify user has granted access to passport
- **Required API:** Check access grants before processing
- **Security:** Ensure only authorized owners can access crew passports

### 4. Biometric Verification
- **Challenge:** Matching facial photo to passport image requires specialized AI
- **Current:** No existing implementation for photo-to-passport matching
- **Required:** AI model/API call for facial verification
- **Cost:** Additional AI API costs

---

## Why AC #9 Was Deferred

From TASK-103 Implementation Plan:

> **AC #9 (Passport verification uses document vault integration and optionally requires photo-ID validation with configurable confidence)**
>
> **Note:** Passport verification with photo-ID validation requires additional photo upload UI during registration that was deferred as noted in the plan. The passport requirement type is fully supported in schema, API, and owner UI, but the full photo verification UX flow needs a separate task.

### Reasons:
1. **Complex UX:** Multi-step flow with camera/photo upload adds significant complexity
2. **New Capabilities:** Photo upload UI doesn't currently exist in the app
3. **Biometric Processing:** Requires specialized AI for photo-to-passport matching
4. **Testing:** Difficult to test biometric verification
5. **Data Sensitivity:** Handling sensitive identity documents requires careful consideration

---

## Current Workaround

**If passport requirement is set but without photo validation:**
- ✅ User can still register
- ✅ Passport reference stored in registration_answers
- ❌ Photo verification skipped
- ⚠️ No AI validation of passport validity

**If both passport AND photo validation are required:**
- ❌ Registration flow breaks (no UI to handle photo)
- Users would need to cancel and contact support

---

## To Enable Full Passport with Photo-Validation Flow

### Short Term (Use Without Photo Validation)
1. Owners can create passport requirements ✅
2. Set `require_photo_validation = false` ✅
3. Crew can see "passport verification required" message ✅
4. AI validates passport validity (server-side) ⚠️ Needs implementation

### Long Term (Full Implementation)
1. Create photo upload UI component
2. Integrate camera/file upload capability
3. Implement photo-to-passport matching in AI assessment
4. Add proper error handling for photo upload
5. Test biometric verification workflow
6. Add comprehensive error messages to crew

---

## Estimated Implementation Effort

- **UI Components:** 2-3 days
- **API Integration:** 1-2 days
- **AI Assessment Logic:** 2-3 days
- **Document Vault Integration:** 1 day
- **Testing & Error Handling:** 2 days
- **Total:** ~1-2 weeks of development

---

## Files Summary

### ✅ Already Complete
- `specs/tables.sql` - Schema defined
- `app/components/manage/RequirementsManager.tsx` - Owner can create requirement
- `app/api/journeys/.../requirements/route.ts` - API to manage requirement

### 🚧 Partially Complete
- `app/lib/ai/assessRegistration.ts` - Needs passport assessment function
- `app/api/registrations/route.ts` - Needs to accept passport/photo data

### ❌ Missing
- Photo upload UI components
- Passport verification display to crew
- Photo capture/upload functionality
- Passport assessment AI function
- Document vault access integration
