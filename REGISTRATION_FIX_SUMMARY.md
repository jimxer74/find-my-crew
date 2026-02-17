# Registration Flow Fix Summary

## Problem
The registration flow was showing empty content when users clicked "Register for leg" on journeys with auto-approval enabled and only server-side requirements (risk_level, experience_level, skill). The console logs showed:

- "Requirements exist but regular modal is shown - auto-switching to requirements form"
- "Blocking regular modal - requirements exist, switching to requirements form"

## Root Cause
The issue was in `LegDetailsPanel.tsx` where the logic for determining which form to show was incorrect:

1. **Incorrect conditional logic**: The code was checking `hasRequirements` without distinguishing between question-type and server-side requirements
2. **Overly restrictive safety effects**: Two safety effects (lines 338-400) were auto-switching to requirements form whenever any requirements existed
3. **Wrong registration modal condition**: The modal was only shown when NO requirements existed
4. **Restrictive submit button logic**: The submit button was blocked when ANY requirements existed

## Solution
Modified `LegDetailsPanel.tsx` to properly distinguish between requirement types:

### 1. Fixed Safety Effects (lines 338-400)
- **Initial Fix**: Added logic to check if requirements are question-type vs server-side
- **Final Fix**: Made safety effects extremely conservative - only trigger in edge cases where neither form is active
- Only auto-switch to requirements form for question-type requirements
- Allow regular modal for server-side requirements
- Added `isCheckingRequirements` guard to prevent interference with main logic
- Made safety effects more conservative to avoid overriding main checkRequirements logic

### 2. Fixed Registration Modal Condition (line 1088)
Changed from:
```tsx
showRegistrationModal && (!hasRequirements || (hasRequirements && !showRequirementsForm))
```
To:
```tsx
showRegistrationModal && (!hasRequirements || (hasRequirements && showRequirementsForm === false))
```

### 3. Fixed Submit Button Logic (lines 1150-1208)
- Removed blanket restriction on submitting when requirements exist
- Added specific check for question requirements before blocking submission
- Allow submission for server-side requirements

### 4. Fixed handleSubmitRegistration Logic (lines 731-784, 786-812)
- Replaced blanket checks for `hasRequirements` with specific checks for question requirements
- Only block submission when question requirements exist but no answers provided
- Allow submission when only server-side requirements exist

## Key Changes Made

### Safety Effects Updates (Final Version)
- **Made safety effects extremely conservative**: Only trigger if requirements exist but NEITHER form is active (edge case)
- Added `hasQuestionReqs` checks in both safety effects
- Added console logging to track requirement types
- Allow regular modal for server-side requirements
- Added `isCheckingRequirements` guard to prevent interference with main logic
- Made safety effects only handle broken states, not normal operation

### Registration Modal Condition
- Fixed logic to show regular modal when server-side requirements exist

### Submit Button Logic
- Check for question requirements specifically before blocking
- Allow submission for server-side requirements

### handleSubmitRegistration Updates
- Multiple locations updated to distinguish between question and server-side requirements
- Only block when question requirements exist without answers

## Result
Now the registration flow correctly:
- Shows requirements form only for question-type requirements
- Shows regular registration modal for server-side requirements
- Allows submission for server-side requirements
- Properly handles auto-approval workflows

## Testing
The fixes ensure that:
1. Journeys with only server-side requirements show the regular registration modal
2. Journeys with question requirements show the requirements form
3. Users can submit registrations for server-side requirements
4. Auto-switching behavior is eliminated for server-side requirements