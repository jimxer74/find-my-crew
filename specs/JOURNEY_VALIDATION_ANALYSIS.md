# Journey Edit Form - Validation Analysis

## Current Validations

### ✅ Implemented
1. **Journey Name**: Required (HTML5 `required` attribute)
2. **Boat Selection**: Required (HTML5 `required` attribute)
3. **Publishing State**: 
   - Validates that all legs have start_date and end_date
   - Requires at least one leg before publishing
4. **Boat Ownership**: Verified via RLS policies (implicit)

---

## Missing Validations - Proposed

### 🔴 Critical Validations (Data Integrity)

#### 1. **Date Logic Validations**
**Issue**: No validation that end_date is after start_date

**Proposed Validation**:
- If both `start_date` and `end_date` are provided:
  - `end_date` must be >= `start_date`
  - Error message: "End date must be on or after start date"

**Impact**: Prevents illogical date ranges that would confuse users and break date filtering

---

#### 2. **Journey Dates vs Leg Dates Consistency**
**Issue**: Journey-level dates don't need to match leg dates, but should be logical

**Proposed Validation**:
- If journey has `start_date` and `end_date`:
  - Journey `start_date` should be <= earliest leg `start_date` (if legs exist)
  - Journey `end_date` should be >= latest leg `end_date` (if legs exist)
- **Note**: This might be too strict - consider making it a warning instead of error

**Impact**: Ensures journey dates encompass all leg dates for accurate date filtering

---

#### 3. **Past Date Validation**
**Issue**: No restriction on entering past dates

**Proposed Validation**:
- `start_date` should not be more than X days in the past (e.g., 30 days)
  - Allow past dates for "In planning" journeys (historical data entry)
  - For "Published" journeys, warn if start_date is in the past
- **Alternative**: Allow past dates but show warning message

**Impact**: Prevents accidental creation of journeys that have already started/ended

---

### 🟡 Important Validations (Matching & UX)

#### 4. **Risk Level Validation**
**Issue**: Risk level is optional (empty array allowed)

**Proposed Validation**:
- **Option A**: Require at least one risk level selection
  - Error: "Please select at least one risk level"
- **Option B**: Keep optional but show warning if empty
  - Warning: "No risk level selected - this journey may not match crew preferences"

**Impact**: Risk level is critical for matching crew members to journeys. Empty risk levels reduce match quality.

**Recommendation**: Make it required (Option A)

---

#### 5. **Experience Level Validation**
**Issue**: Currently defaults to 1 (Beginner) but can be null

**Proposed Validation**:
- Since default is 1, this is less critical
- **Option A**: Ensure it's never null (use default 1 if not set)
- **Option B**: Keep nullable but validate when publishing
  - Warning: "No minimum experience level set - defaulting to Beginner (1)"

**Impact**: Experience level is critical for matching. Should always have a value.

**Recommendation**: Option A - always set default to 1 if null

---

#### 6. **Skills Validation**
**Issue**: Skills array can be empty

**Proposed Validation**:
- **Option A**: Require at least one skill
  - Error: "Please select at least one required skill"
- **Option B**: Keep optional but show warning
  - Warning: "No skills selected - this may reduce matching accuracy"

**Impact**: Skills are used for matching. Empty skills array reduces match quality.

**Recommendation**: Option B (warning) - some journeys may genuinely not require specific skills

---

#### 7. **Description Validation**
**Issue**: Description is optional and has no length limits

**Proposed Validations**:
- **Min length**: Require at least 20-50 characters for published journeys
  - Error: "Description must be at least 20 characters for published journeys"
- **Max length**: Limit to reasonable length (e.g., 2000 characters)
  - Error: "Description cannot exceed 2000 characters"

**Impact**: Description helps crew members understand the journey. Too short = not informative, too long = UI issues.

**Recommendation**: 
- Min length: 20 chars for "Published" journeys only
- Max length: 2000 chars always

---

#### 8. **Journey Name Validation**
**Issue**: Only checks if name exists, no length/format validation

**Proposed Validations**:
- **Min length**: At least 3 characters
  - Error: "Journey name must be at least 3 characters"
- **Max length**: Maximum 100 characters
  - Error: "Journey name cannot exceed 100 characters"
- **Format**: Trim whitespace, prevent only spaces
  - Auto-trim on save, validate no empty after trim

**Impact**: Prevents invalid names that break UI or database constraints

---

### 🟢 Nice-to-Have Validations (UX Improvements)

#### 9. **State-Specific Validations**
**Issue**: Same validations apply regardless of journey state

**Proposed Validations**:
- **"Published" state**: 
  - Require description (min 20 chars)
  - Require at least one risk level
  - Require journey start_date and end_date (in addition to leg dates)
  - Warn if start_date is in the past
- **"In planning" state**: 
  - More lenient - allow incomplete data
- **"Archived" state**: 
  - No additional validations (read-only state)

**Impact**: Ensures published journeys have complete, accurate data for matching

---

#### 10. **Real-time Date Validation Feedback**
**Issue**: Date validation only happens on submit

**Proposed Enhancement**:
- Show inline validation messages as user types/selects dates
- Highlight date fields in red if invalid
- Disable submit button if critical validations fail

**Impact**: Better UX - users see errors immediately, not after clicking submit

---

#### 11. **Boat Capacity vs Crew Needed**
**Issue**: No validation that crew_needed (at leg level) doesn't exceed boat capacity

**Proposed Validation**:
- When saving journey, check all legs:
  - Sum of `crew_needed` across all legs should not exceed boat `capacity`
  - Or: Each leg's `crew_needed` should not exceed boat `capacity`
- **Note**: This validation might belong at leg level, not journey level

**Impact**: Prevents impossible crew requirements

**Recommendation**: Implement at leg level, not journey level

---

#### 12. **Duplicate Journey Name**
**Issue**: No check for duplicate journey names for the same boat

**Proposed Validation**:
- Check if journey name already exists for the same boat
- **Option A**: Prevent duplicates entirely
  - Error: "A journey with this name already exists for this boat"
- **Option B**: Allow duplicates but warn
  - Warning: "Another journey with this name exists for this boat"

**Impact**: Prevents confusion when multiple journeys have the same name

**Recommendation**: Option B (warning) - user might intentionally create similar journeys

---

## Validation Priority Summary

### 🔴 High Priority (Implement First)
1. **Date Logic**: end_date >= start_date
2. **Risk Level**: Require at least one selection
3. **Experience Level**: Ensure default value (1) is always set

### 🟡 Medium Priority (Implement Second)
4. **Description**: Min/max length validation
5. **Journey Name**: Min/max length validation
6. **State-Specific**: Stricter validations for "Published" journeys

### 🟢 Low Priority (Nice to Have)
7. **Past Date Warning**: Warn if start_date is in the past
8. **Skills Warning**: Warn if no skills selected
9. **Real-time Validation**: Inline error messages
10. **Duplicate Name Warning**: Warn about duplicate names

---

## Implementation Approach

### Phase 1: Critical Validations
- Add date logic validation (end_date >= start_date)
- Make risk_level required (at least one selection)
- Ensure min_experience_level always has default value

### Phase 2: Data Quality Validations
- Add description min/max length
- Add journey name min/max length
- Add state-specific validations for "Published"

### Phase 3: UX Enhancements
- Add real-time validation feedback
- Add warnings for optional fields
- Add duplicate name check

---

## Validation Error Display Strategy

### Current Approach
- Single error message displayed at top of form
- Errors shown only on submit

### Proposed Approach
1. **Inline Validation**: Show errors next to each field
2. **Summary**: Show error summary at top
3. **Real-time**: Validate on blur/change for better UX
4. **Visual Indicators**: 
   - Red border on invalid fields
   - Green checkmark on valid fields
   - Warning icon for warnings (non-blocking)

---

## Questions to Resolve

1. **Past Dates**: Should we allow past dates for "In planning" journeys? (Yes - for historical data entry)
2. **Risk Level**: Required or optional with warning? (Recommend: Required)
3. **Skills**: Required or optional with warning? (Recommend: Optional with warning)
4. **Journey Dates**: Should they encompass leg dates? (Recommend: Warning, not error)
5. **Duplicate Names**: Prevent or warn? (Recommend: Warn only)
