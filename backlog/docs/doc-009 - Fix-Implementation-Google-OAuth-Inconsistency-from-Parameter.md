---
id: doc-009
title: 'Fix Implementation: Google OAuth Inconsistency - from Parameter'
type: other
created_date: '2026-02-21 13:09'
---
# Fix Implementation: Google OAuth Inconsistency - from Parameter

## Commit

**5a23637** - `fix(oauth): add missing from parameter to Google/Facebook OAuth redirects`

## Problem Fixed

Users clicking Google/Facebook auth from the main login/signup pages (`/auth/login`, `/auth/signup`) were:
- Not authenticated after OAuth completed
- Stuck on home page with `?code=<oauth_code>` in URL
- Not redirected to `/crew` as expected
- Had to manually navigate to trigger proper authentication

But the same OAuth flow worked perfectly when initiated from embedded chat forms.

## Root Cause

The OAuth `redirectTo` parameter was missing the `?from=` query parameter that tells the callback handler whether the user is coming from an "owner" (login) or "prospect" (signup) flow.

**Result of missing parameter:**
```typescript
// app/auth/callback/route.ts
const from = searchParams.get('from');  // ← Returns null
const isFromProspect = from === 'prospect' || (!!prospectPreferences && from !== 'owner');
  // Evaluates to: false || (false && true) = true  ❌ WRONG
const isFromOwner = from === 'owner';
  // Evaluates to: null === 'owner' = false  ❌ WRONG

// Result: User treated as prospect instead of owner!
```

## Changes

### 1. app/auth/login/page.tsx (Lines 44-79)

**Before:**
```typescript
const handleFacebookLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,  // ❌ No from param
    },
  });
};

const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,  // ❌ No from param
    },
  });
};
```

**After:**
```typescript
const handleFacebookLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?from=owner`,  // ✅ Added from
    },
  });
};

const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?from=owner`,  // ✅ Added from
    },
  });
};
```

### 2. app/auth/signup/page.tsx (Lines 52-86)

**Before:**
```typescript
const handleFacebookSignup = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,  // ❌ No from param
    },
  });
};

const handleGoogleSignup = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,  // ❌ No from param
    },
  });
};
```

**After:**
```typescript
const handleFacebookSignup = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?from=prospect`,  // ✅ Added from
    },
  });
};

const handleGoogleSignup = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?from=prospect`,  // ✅ Added from
    },
  });
};
```

### 3. app/components/LoginModal.tsx (Lines 51-93)

**Before:**
```typescript
const handleFacebookLogin = async () => {
  const redirectTo = fromProspect
    ? `${window.location.origin}/auth/callback?from=prospect`
    : `${window.location.origin}/auth/callback`;  // ❌ Missing from=owner
};

const handleGoogleLogin = async () => {
  const redirectTo = fromProspect
    ? `${window.location.origin}/auth/callback?from=prospect`
    : `${window.location.origin}/auth/callback`;  // ❌ Missing from=owner
};
```

**After:**
```typescript
const handleFacebookLogin = async () => {
  const redirectTo = fromProspect
    ? `${window.location.origin}/auth/callback?from=prospect`
    : `${window.location.origin}/auth/callback?from=owner`;  // ✅ Added from=owner
};

const handleGoogleLogin = async () => {
  const redirectTo = fromProspect
    ? `${window.location.origin}/auth/callback?from=prospect`
    : `${window.location.origin}/auth/callback?from=owner`;  // ✅ Added from=owner
};
```

### 4. app/components/SignupModal.tsx

✅ **No changes needed** - Already had correct logic with proper `from=` parameters in both Facebook and Google handlers

## How It Works Now

### Login Flow (Owner)
1. User clicks "Log In" → `/auth/login` page
2. Selects Google/Facebook
3. OAuth redirects to: `/auth/callback?code=XYZ&from=owner`
4. Callback identifies: `isFromOwner = true`
5. Redirect service applies owner logic
6. User redirected to `/crew` ✅

### Signup Flow (Prospect)
1. User clicks "Sign Up" → `/auth/signup` page
2. Selects Google/Facebook
3. OAuth redirects to: `/auth/callback?code=XYZ&from=prospect`
4. Callback identifies: `isFromProspect = true`
5. Redirect service applies prospect logic
6. User redirected to `/welcome/crew?profile_completion=true` ✅

## Testing Checklist

After deploying, verify:

### Test 1: Login Page OAuth
- [ ] Go to home page
- [ ] Click "Log In"
- [ ] Click Google button
- [ ] Complete OAuth
- [ ] **Expected**: Redirected to `/crew` ✓
- [ ] **Actual**: ___________

### Test 2: Login Page Facebook
- [ ] Go to home page
- [ ] Click "Log In"
- [ ] Click Facebook button
- [ ] Complete OAuth
- [ ] **Expected**: Redirected to `/crew` ✓
- [ ] **Actual**: ___________

### Test 3: Signup Page OAuth
- [ ] Go to home page
- [ ] Click "Sign Up"
- [ ] Click Google button
- [ ] Complete OAuth
- [ ] **Expected**: Redirected to `/welcome/crew?profile_completion=true` ✓
- [ ] **Actual**: ___________

### Test 4: Signup Page Facebook
- [ ] Go to home page
- [ ] Click "Sign Up"
- [ ] Click Facebook button
- [ ] Complete OAuth
- [ ] **Expected**: Redirected to `/welcome/crew?profile_completion=true` ✓
- [ ] **Actual**: ___________

### Test 5: Embedded Chat OAuth (Regression)
- [ ] Go to crew chat (embedded on home page)
- [ ] Click Google/Facebook
- [ ] Complete OAuth
- [ ] **Expected**: Should still work as before ✓
- [ ] **Actual**: ___________

## Debug Logging

Enable debug logs with `LOG_LEVEL=DEBUG` to see:

```
[INFO] LOGIN CALLBACK: Successfully exchanged code for session
[INFO] LOGIN CALLBACK: Checking for NULL user_id sessions to link
[DEBUG] [RedirectService] role_crew (priority 5): /crew
```

For signup:
```
[DEBUG] [RedirectService] pending_prospect_onboarding (priority 1): /welcome/crew?profile_completion=true
```

## Impact Assessment

- ✅ **Fixes**: Inconsistent OAuth behavior on main login/signup pages
- ✅ **Improves**: User experience - immediate redirect after OAuth
- ✅ **Maintains**: All existing OAuth flows (embedded chat, modals)
- ✅ **Security**: No security implications (only a hint, server verifies)
- ✅ **Build**: All 81 pages compiled successfully

## Summary of Changes

| File | Change | Lines | Impact |
|------|--------|-------|--------|
| app/auth/login/page.tsx | Add ?from=owner | 44-79 | Facebook/Google login now redirects correctly |
| app/auth/signup/page.tsx | Add ?from=prospect | 52-86 | Facebook/Google signup now redirects correctly |
| app/components/LoginModal.tsx | Add ?from=owner for non-prospect | 51-93 | Modal login consistency improved |
| **Total**: 3 files modified | **+6 insertions** | | **Fixes critical OAuth issue** |

## Rollback

If any issues arise:
```bash
git revert 5a23637
```

This will restore the previous behavior (missing from parameter), though users would experience the inconsistent OAuth behavior again.
