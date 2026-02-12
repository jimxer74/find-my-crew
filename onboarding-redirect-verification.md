# Onboarding Session Redirect Verification

## Problem Solved

**Issue**: Users without profiles were seeing the "Create profile" banner and being redirected to `/profile` page, even when they had existing onboarding sessions that should take precedence.

**Expected Behavior**: Users with existing onboarding sessions should be redirected to the appropriate onboarding page (`/welcome/crew` for prospect sessions or `/welcome/owner` for owner sessions) instead of the generic profile creation page.

## Solution Implemented

**Modified**: `app/components/profile/ProfileCompletionPrompt.tsx`

### Key Changes:

1. **Added Router Import**: Added `useRouter` to enable programmatic navigation
2. **Added State Tracking**: Added `hasOnboardingSession` state to track if user has pending onboarding
3. **Enhanced useEffect**: Added `checkOnboardingSessions()` function to query both session tables
4. **Early Redirect Logic**: Added redirect logic that runs before banner rendering
5. **Session Detection**: Checks both `prospect_sessions` and `owner_sessions` tables for pending onboarding

### Implementation Details:

```typescript
// Check for owner onboarding session
const { data: ownerSession } = await supabase
  .from('owner_sessions')
  .select('session_id')
  .eq('user_id', user.id)
  .eq('post_signup_onboarding_pending', true)
  .limit(1)
  .maybeSingle();

// Check for prospect onboarding session
const { data: prospectSession } = await supabase
  .from('prospect_sessions')
  .select('session_id')
  .eq('user_id', user.id)
  .eq('post_signup_onboarding_pending', true)
  .limit(1)
  .maybeSingle();

setHasOnboardingSession(!!ownerSession || !!prospectSession);
```

### Redirect Logic:

```typescript
// If user has an onboarding session, redirect instead of showing banner
if (hasOnboardingSession) {
  const redirectToOnboarding = async () => {
    // Check for owner session first
    if (ownerSession) {
      router.push('/welcome/owner');
      return;
    }

    // Check for prospect session
    if (prospectSession) {
      router.push('/welcome/crew');
      return;
    }
  };

  // Redirect immediately when component mounts
  redirectToOnboarding();
  return null;
}
```

## Behavior Flow

1. **User logs in** → ProfileCompletionPrompt component mounts
2. **Check profile status** → Load profile completion percentage
3. **Check onboarding sessions** → Query both session tables for pending onboarding
4. **Decision Logic**:
   - If profile is complete (100%) → Don't show banner
   - If has onboarding session → Redirect to appropriate onboarding page
   - If no onboarding session → Show banner with profile creation options

## Tables Checked

- **`owner_sessions`**: For users with owner onboarding sessions
  - Filter: `user_id = current_user AND post_signup_onboarding_pending = true`
- **`prospect_sessions`**: For users with prospect onboarding sessions
  - Filter: `user_id = current_user AND post_signup_onboarding_pending = true`

## Expected User Experience

1. **User with owner onboarding session**: Automatically redirected to `/welcome/owner`
2. **User with prospect onboarding session**: Automatically redirected to `/welcome/crew`
3. **User with no onboarding session**: Sees profile completion banner as before
4. **User with complete profile**: No banner shown (existing behavior preserved)

## Files Modified

- `app/components/profile/ProfileCompletionPrompt.tsx`

## Impact

- ✅ Users with pending onboarding sessions get seamless redirect to appropriate onboarding
- ✅ Profile completion banner behavior preserved for users without onboarding sessions
- ✅ Profile completion logic for complete profiles remains unchanged
- ✅ No breaking changes to existing functionality