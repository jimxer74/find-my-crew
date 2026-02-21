---
id: doc-006
title: 'Bug Analysis: DELETE MY ACCOUNT - User Not Logged Out in Edge Cases'
type: other
created_date: '2026-02-21 12:08'
---
# Bug Analysis: DELETE MY ACCOUNT - User Not Logged Out in Edge Cases

## Problem Summary

Users are not being logged out in certain edge cases when deleting their account. They can delete the account but remain authenticated and on the same page.

## Root Causes

### Issue 1: No Error Handling in Privacy Settings Page (Critical)

**File**: `app/settings/privacy/page.tsx`, lines 201-228

**Code:**
```typescript
const handleDeleteAccount = async () => {
  if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
    setError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
    return;
  }

  setIsDeleting(true);
  setError(null);

  try {
    const response = await fetch('/api/user/delete-account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: deleteConfirmation }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete account');
    }

    // Sign out and redirect to root
    await signOut();  // ← If this throws, no error handling!
  } catch (err: any) {
    setError(err.message || 'Failed to delete account. Please try again.');
    setIsDeleting(false);  // ← Loading state reset, but user NOT logged out
  }
};
```

**Edge Cases Where Logout Fails:**

1. **Network error during DELETE request** → Error caught, user NOT logged out
   - Timeout, connection refused, etc.
   - User sees error but remains authenticated

2. **API returns 4xx/5xx error** → Error caught, user NOT logged out
   - Account deletion might partially complete
   - User not logged out because catch block doesn't call signOut()

3. **signOut() throws exception** → No catch for this specific point
   - Supabase client error
   - Redirect error
   - User gets stuck with loading state

4. **response.json() fails** on error response → Generic error caught
   - User NOT logged out

### Issue 2: No Error Handling in AuthContext.signOut()

**File**: `app/contexts/AuthContext.tsx`, lines 65-77

**Code:**
```typescript
const signOut = async () => {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();  // ← Can throw, no try-catch!
  
  // Use window.location for a hard redirect to ensure we go to landing page
  if (typeof window !== 'undefined') {
    window.location.href = '/';  // ← If signOut() throws, never reaches here
  } else {
    router.replace('/');
    router.refresh();
  }
};
```

**Problems:**
1. If `supabase.auth.signOut()` fails, the `window.location.href = '/'` is never executed
2. No error logging for signOut failures
3. No fallback behavior

### Issue 3: Insufficient Error Information

When errors occur, the error message in catch block is too generic:
```typescript
catch (err: any) {
  setError(err.message || 'Failed to delete account. Please try again.');
  // User doesn't know if deletion succeeded or failed
}
```

**What user sees:**
- "Failed to delete account. Please try again." 
- But maybe account WAS deleted, just logout failed
- User is confused

## Security Implications

- ✅ Account data IS deleted (deletion happens server-side before logout)
- ⚠️ User session persists (not logged out)
- ⚠️ User can still access their account page and other authenticated pages
- ⚠️ User can't re-login anymore (account deleted) but also can't logout properly

## Edge Case Scenarios

### Scenario 1: Slow/Unreliable Network
1. User clicks "Delete My Account"
2. Network timeout occurs
3. Error: "Failed to delete account"
4. User is still logged in
5. Refresh page → Still logged in
6. Account might actually be deleted (check logs)
7. User is stuck in authenticated state without account

### Scenario 2: API Error During Deletion
1. Delete request succeeds initially
2. Database operation partially succeeds
3. API returns 500 error
4. Error caught, user NOT logged out
5. User still authenticated but profile is gone

### Scenario 3: Supabase signOut Fails
1. Delete request succeeds
2. signOut() is called
3. Supabase returns error (network issue, auth service down)
4. Error in signOut catches generic error
5. User sees "Failed to delete account" (misleading)
6. User still authenticated
7. Account deleted but user trapped

## Impact Assessment

- **Affected Users**: Any user attempting to delete their account on slow networks or during API issues
- **Frequency**: Medium (depends on network reliability and API stability)
- **Severity**: High (security/logout concern, data deletion succeeded but user unaware)
- **User Experience**: Confusing - user sees error but doesn't know if deletion succeeded

## Solution Requirements

1. **Always attempt logout** - Even if primary deletion fails, try to sign out
2. **Better error distinction** - Show different messages for:
   - "Account deletion failed - not deleted"
   - "Account deleted - logout failed"
   - "Account deleted - successfully logged out"
3. **Add error handling to signOut()** - Catch errors and fallback to hard redirect
4. **Reload user state** - Verify account actually deleted before final redirect
5. **Timeout protection** - Ensure logout attempt doesn't hang indefinitely

## Suggested Fixes

### Fix 1: Add Robust Error Handling to handleDeleteAccount

```typescript
const handleDeleteAccount = async () => {
  if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
    setError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
    return;
  }

  setIsDeleting(true);
  setError(null);

  let accountDeleted = false;
  let deletionError: string | null = null;

  try {
    const response = await fetch('/api/user/delete-account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: deleteConfirmation }),
    });

    const data = await response.json();

    if (!response.ok) {
      deletionError = data.error || 'Account deletion failed';
      setError(`❌ ${deletionError}`);
      setIsDeleting(false);
      return; // Don't logout if deletion failed
    }

    accountDeleted = true;
    logger.info('Account deletion successful, proceeding with logout', {});

  } catch (err: any) {
    deletionError = err.message || 'Network error during deletion';
    setError(`❌ ${deletionError}`);
    setIsDeleting(false);
    return; // Don't logout if deletion failed
  }

  // Always attempt logout, even if there were partial errors
  try {
    logger.info('Attempting logout after account deletion', {});
    await signOut();
    // signOut() does full redirect, this line won't execute
  } catch (logoutErr: any) {
    logger.error('Logout failed after account deletion', {
      error: logoutErr instanceof Error ? logoutErr.message : String(logoutErr),
      accountDeleted // Important: indicate account WAS deleted
    });
    
    // Fallback: Force logout via window.location
    window.location.href = '/';
  }
};
```

### Fix 2: Add Error Handling to AuthContext.signOut()

```typescript
const signOut = async () => {
  const supabase = getSupabaseBrowserClient();
  
  try {
    logger.debug('[AuthContext] Signing out user', {});
    await supabase.auth.signOut();
    logger.debug('[AuthContext] signOut completed, redirecting to /', {});
  } catch (error: any) {
    logger.error('[AuthContext] signOut failed, forcing redirect anyway', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Continue with redirect even if signOut fails
  }

  // Always redirect, even if signOut failed
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  } else {
    router.replace('/');
    router.refresh();
  }
};
```

### Fix 3: Add Timeout to signOut

```typescript
const signOut = async () => {
  const supabase = getSupabaseBrowserClient();
  
  try {
    logger.debug('[AuthContext] Signing out user', {});
    
    // Use Promise.race to add timeout
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 3000)
      )
    ]);
    logger.debug('[AuthContext] signOut completed', {});
  } catch (error: any) {
    logger.warn('[AuthContext] signOut failed or timed out, forcing redirect', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Continue with redirect even if signOut fails or times out
  }

  // Always redirect, even if signOut failed
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  } else {
    router.replace('/');
    router.refresh();
  }
};
```

## Testing Checklist

After implementing fixes, test these scenarios:

1. **Normal case**: Delete account successfully → Logged out ✓
2. **Network timeout**: Slow network during deletion → User stays in account page with error ✓
3. **API error**: 500 error from API → User stays in account page with error ✓
4. **Partial deletion**: Data partially deleted → User sees error, not logged out ✓
5. **Logout failure**: signOut throws after deletion → User still redirected to home ✓
6. **Cascade**: Try to re-access account page → Get redirected to login ✓

## Files to Modify

1. `app/settings/privacy/page.tsx` - handleDeleteAccount function
2. `app/contexts/AuthContext.tsx` - signOut function
3. Add logging to both functions for debugging
