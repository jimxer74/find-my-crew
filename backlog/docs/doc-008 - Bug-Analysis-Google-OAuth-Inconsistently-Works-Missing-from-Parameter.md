---
id: doc-008
title: 'Bug Analysis: Google OAuth Inconsistently Works - Missing from Parameter'
type: other
created_date: '2026-02-21 13:04'
---
# Bug Analysis: Google OAuth Inconsistently Works - Missing from Parameter

## Problem Description

When user:
1. Arrives at front page
2. Clicks "Log In"
3. Selects Google authentication
4. Completes Google OAuth
5. Gets redirected to `sailsm.art?code=<oauth_code>`

**Result**: User is NOT authenticated and NOT redirected to `/crew`
- They remain on landing page with the query code in URL
- When they manually navigate elsewhere (e.g., `/crew`), they become authenticated

## Root Cause Analysis

### The Critical Missing Parameter: `from`

**Login Page** (`app/auth/login/page.tsx` lines 63-79):
```typescript
const handleGoogleLogin = async () => {
  setLoading(true);
  setError(null);

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      // ❌ MISSING: No `from` parameter!
      // Should be: redirectTo: `${window.location.origin}/auth/callback?from=owner`
    },
  });

  if (error) {
    setError(error.message);
    setLoading(false);
  }
};
```

### What The `from` Parameter Does

In `/auth/callback/route.ts` (line 10):
```typescript
const from = searchParams.get('from'); // Track signup source (e.g., 'prospect')
```

Then used (lines 70-71):
```typescript
const isFromProspect = from === 'prospect' || (!!prospectPreferences && from !== 'owner');
const isFromOwner = from === 'owner';
```

This affects the redirect decision in `buildRedirectContext()` and the final redirect path.

### The Inconsistency Pattern

**Why does it work sometimes?**

Looking at different OAuth locations:

| File | OAuth Type | Has `from` Parameter | Works Consistently |
|------|-----------|----------------------|-------------------|
| `app/auth/login/page.tsx` | Email login page (unrelated) | ❌ No | ❌ NO - User stays on page |
| `app/auth/signup/page.tsx` | Email signup page (unrelated) | ❌ No | ❌ NO - User stays on page |
| `app/components/LoginModal.tsx` | Login modal | ❌ No (uses variable `redirectTo`) | ❌ INCONSISTENT |
| `app/components/SignupModal.tsx` | Signup modal | ❌ No (uses variable `redirectTo`) | ❌ INCONSISTENT |
| `app/components/prospect/InlineChatLoginForm.tsx` | Chat login | ✅ Yes (`from=prospect`) | ✅ YES - Works |
| `app/components/prospect/InlineChatSignupForm.tsx` | Chat signup | ✅ Yes (`from=prospect`) | ✅ YES - Works |

**Why the inconsistency?**

When `from` parameter is missing:
- `isFromProspect = !!prospectPreferences && from !== 'owner'`
  - If `from` is undefined: `undefined !== 'owner'` = `true`
  - So user treats as prospect even if they should be owner
- `isFromOwner = from === 'owner'`
  - If `from` is undefined: `undefined === 'owner'` = `false`
  - So user is never treated as owner

This causes wrong redirect path selection.

### Scenario: User Clicks Google From Login Page

1. User on home page clicks "Log In" → goes to `/auth/login`
2. Clicks Google OAuth button
3. Google redirects: `sailsm.art/auth/callback?code=XYZ` (NO `from` parameter)
4. Callback processes:
   ```typescript
   from = undefined
   isFromProspect = ( false || true ) = true  // Wrong! Should detect owner
   isFromOwner = false
   ```
5. Redirect service treats user as prospect
6. But new user (no profile) + prospect flow → Different logic
7. Instead of auto-redirect to `/crew`, tries to process as prospect onboarding
8. Response might not include proper redirect

## Why Middleware Doesn't Save It

**Middleware** (`middleware.ts`, lines 30-33):
```typescript
// Only check redirects for root path (/) or welcome paths
if (pathname !== '/' && !pathname.startsWith('/welcome/')) {
  return NextResponse.next();
}
```

**Problem**: When user is on `/?code=XYZ`, middleware:
1. Runs redirect check
2. Finds user is actually authenticated now (by fresh session)
3. But middleware can only redirect FROM `/` or `/welcome/*`
4. Doesn't recognize the `?code=` parameter as special case
5. Tries to redirect but might not work correctly

## Solution Requirements

1. **Add `from` parameter to all OAuth calls** in login/signup pages
2. **Distinguish owner vs crew** OAuth sources
3. **Handle popup auth differently** if needed
4. **Ensure consistent redirect** from callback

## Affected Files

| File | Issue | Fix Needed |
|------|-------|-----------|
| `app/auth/login/page.tsx` | No `from` parameter on Google/Facebook | Add `from=owner` or detect context |
| `app/auth/signup/page.tsx` | No `from` parameter on Google/Facebook | Add `from=prospect` (signup = crew) |
| `app/components/LoginModal.tsx` | Uses variable `redirectTo`, unclear source | Clarify source and add `from` |
| `app/components/SignupModal.tsx` | Uses variable `redirectTo`, unclear source | Clarify source and add `from` |

## Why It Seems Inconsistent

**When it works**:
- User logs in via InlineChatLoginForm (prospect) with `from=prospect` → Works
- Has explicit source information
- Redirect service knows what to do

**When it doesn't work**:
- User logs in via main `/auth/login` without `from` parameter
- Callback treats as prospect (wrong source detection)
- Redirect service confused about what to do
- Middleware can't help because user isn't on `/` anymore

**When manual navigation fixes it**:
- User navigates to `/crew` after being stuck at home
- Middleware runs again with fresh auth state
- Finds authenticated user
- If on `/crew`, bypasses middleware and renders crew page
- AuthContext picks up the user and everything works

## Testing to Confirm

1. **Current broken case**:
   - Go to `sailsm.art`
   - Click "Log In" / "Sign Up"
   - Select Google
   - After OAuth: Stuck on page with `?code=` query
   - ❌ No redirect

2. **Working case**:
   - Go to crew chat (`sailsm.art/crew` or from landing page chat)
   - Click "Log In" or "Sign Up"
   - Select Google
   - After OAuth: Success → proper redirect
   - ✅ Redirects to right page

The difference: Crew chat uses `from=prospect` parameter

## Recommended Fix

### Option 1: Add from Parameter to Login Page (Recommended)
```typescript
// app/auth/login/page.tsx
const handleGoogleLogin = async () => {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?from=owner`, // ← ADD THIS
    },
  });
  // ...
};
```

### Option 2: Add from Parameter to Signup Page
```typescript
// app/auth/signup/page.tsx
const handleGoogleSignup = async () => {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?from=prospect`, // ← ADD THIS
    },
  });
  // ...
};
```

### Option 3: Detect Source from Referrer (Advanced)
```typescript
// app/auth/callback/route.ts
// Auto-detect if not provided
if (!from) {
  // If coming from /auth/login → owner
  // If coming from /auth/signup → prospect
  // Use referrer or request headers
}
```

## Security Considerations

- ✅ `from` parameter is only a hint, doesn't grant access
- ✅ Server verifies actual user role from profile
- ✅ No security issue if parameter is missing (just wrong redirect)
- ✅ User is still authenticated, just redirected wrong place
