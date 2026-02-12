# Profile Redirect Comprehensive Verification

## Problem Solved

**Issue**: Users with active onboarding sessions (in `prospect_sessions` or `owner_sessions` tables) were being redirected to `/profile` or `/profile-setup` pages instead of the appropriate onboarding chat pages (`/welcome/crew` or `/welcome/owner`).

**Root Cause**: Multiple components throughout the application had hardcoded links to profile pages without checking for active onboarding sessions.

## Solution Implemented

### 1. Created Centralized Redirect Helper

**File**: `app/lib/profile/redirectHelper.ts`

**Key Functions**:
- `checkOnboardingSession(userId)`: Checks both `owner_sessions` and `prospect_sessions` tables for pending onboarding
- `getProfileRedirectUrl(userId, isSetup)`: Returns appropriate redirect URL based on session type
- `handleRedirect(userId, router, isSetup)`: Performs the actual redirect
- `useProfileRedirect()`: React hook for components to use redirect functionality

**Logic**:
- If owner session exists → Redirect to `/welcome/owner`
- If prospect session exists → Redirect to `/welcome/crew`
- If no session exists → Redirect to `/profile` or `/profile-setup`

### 2. Updated All Profile-Related Components

#### A. ProfileCompletionPrompt.tsx
- **Already implemented** redirect logic for onboarding sessions
- **Optimized**: Eliminated duplicate database queries by caching session type

#### B. ProfileCompletionBar.tsx
- Added `useProfileRedirect` hook and `router` import
- Modified all profile links to use `handleProfileClick` handler
- Links now redirect to appropriate onboarding pages if sessions exist

#### C. MissingFieldsIndicator.tsx
- Added `useProfileRedirect` hook and `router` import
- Modified all profile links (inline, list, and button variants) to use redirect handler
- All "Complete your profile" links now check for onboarding sessions

#### D. NavigationMenu.tsx
- Added `useProfileRedirect` hook
- Modified `handleNavClick` function to handle profile redirects
- Profile menu item now redirects to appropriate onboarding page

#### E. LimitedAccessIndicator.tsx
- Added `useProfileRedirect` hook and `router` import
- Modified "Complete your profile" link to use redirect handler

#### F. InlineChatProfileProgress.tsx
- Added `useProfileRedirect` hook, `router`, and `user` imports
- Modified "Continue to full profile" link to use redirect handler
- Added redirect state management to prevent multiple clicks

#### G. LegDetailsPanel.tsx
- Added `useProfileRedirect` hook and `router` import
- Modified `/profile-setup` link to use `handleProfileSetupClick` handler
- Links to profile setup now check for onboarding sessions first

## Database Queries Used

### Owner Sessions Check
```sql
SELECT session_id FROM owner_sessions
WHERE user_id = ? AND post_signup_onboarding_pending = true
LIMIT 1
```

### Prospect Sessions Check
```sql
SELECT session_id FROM prospect_sessions
WHERE user_id = ? AND post_signup_onboarding_pending = true
LIMIT 1
```

## Components That Now Handle Onboarding Redirects

1. **ProfileCompletionPrompt** - Banner and card variants
2. **ProfileCompletionBar** - Progress bar with profile links
3. **MissingFieldsIndicator** - Missing fields checklist with links
4. **NavigationMenu** - Main navigation profile menu item
5. **LimitedAccessIndicator** - Limited access warning with CTA
6. **InlineChatProfileProgress** - Chat-based profile progress
7. **LegDetailsPanel** - Leg details with profile setup link

## Expected Behavior

### For Users WITH Active Onboarding Sessions:
- **Owner session**: All profile links → `/welcome/owner`
- **Prospect session**: All profile links → `/welcome/crew`

### For Users WITHOUT Active Onboarding Sessions:
- Profile links → `/profile` (existing behavior)
- Profile setup links → `/profile-setup` (existing behavior)

### For Users With Complete Profiles:
- No profile completion prompts shown (existing behavior)

## Technical Implementation Details

### Performance Optimizations:
- **Single database query per session check** (eliminated duplicate queries in ProfileCompletionPrompt)
- **Cached session type** to avoid repeated database calls
- **Centralized redirect logic** to maintain consistency

### Error Handling:
- Graceful fallback if database queries fail
- Preserves existing behavior if user is not authenticated
- Maintains all existing UI/UX patterns

### Backward Compatibility:
- All existing functionality preserved for users without onboarding sessions
- No breaking changes to existing API or component interfaces
- Maintains all existing styling and animations

## Files Modified

1. `app/lib/profile/redirectHelper.ts` - **NEW**: Centralized redirect helper
2. `app/components/profile/ProfileCompletionPrompt.tsx` - **UPDATED**: Optimized existing redirect logic
3. `app/components/profile/ProfileCompletionBar.tsx` - **UPDATED**: Added redirect handling
4. `app/components/profile/MissingFieldsIndicator.tsx` - **UPDATED**: Added redirect handling
5. `app/components/NavigationMenu.tsx` - **UPDATED**: Added redirect handling
6. `app/components/profile/LimitedAccessIndicator.tsx` - **UPDATED**: Added redirect handling
7. `app/components/prospect/InlineChatProfileProgress.tsx` - **UPDATED**: Added redirect handling
8. `app/components/crew/LegDetailsPanel.tsx` - **UPDATED**: Added redirect handling for profile setup

## Testing Verification

To verify the implementation works correctly:

1. **Create a user with owner onboarding session**:
   - All profile links should redirect to `/welcome/owner`
   - Test all 7 component types listed above

2. **Create a user with prospect onboarding session**:
   - All profile links should redirect to `/welcome/crew`
   - Test all 7 component types listed above

3. **Create a user with no onboarding session**:
   - All profile links should redirect to `/profile` or `/profile-setup`
   - Existing behavior should be preserved

4. **Create a user with complete profile**:
   - No profile completion prompts should be shown
   - Existing behavior should be preserved

## Impact

✅ **All "Create profile" and "Complete profile" buttons now respect onboarding sessions**
✅ **Users with active onboarding sessions get seamless redirect to appropriate chat pages**
✅ **Preserves all existing functionality for users without onboarding sessions**
✅ **Centralized, maintainable redirect logic**
✅ **Performance optimized with minimal database queries**