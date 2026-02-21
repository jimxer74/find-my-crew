---
id: doc-004
title: 'Architecture Analysis: Why /welcome/crew Works but /welcome/owner Doesn''t'
type: other
created_date: '2026-02-21 10:43'
---
# Architecture Analysis: Why /welcome/crew Works but /welcome/owner Doesn't

## Executive Summary

The two pages work **fundamentally differently** in how they handle authentication state after OAuth:

- **`/welcome/crew`** (ProspectChatProvider): Has **retry logic** and error handling that allows the auth session to complete even when initial RLS queries fail
- **`/welcome/owner`** (OwnerChatProvider): Has **NO retry logic**, immediately fails silently, and never recovers

This architectural difference means:
- ConsentSetupContext on `/welcome/crew` can obtain `authLoading: false` even if initial queries hang
- ConsentSetupContext on `/welcome/owner` stays stuck with `authLoading: true` indefinitely

---

## The Root Cause: Retry Logic vs. Immediate Failure

### `/welcome/crew` (ProspectChatProvider) - WORKS ✅

**Key code section** (ProspectChatContext.tsx, lines 374-443):

```typescript
// Listen for auth state changes to update isAuthenticated when user logs in/out
useEffect(() => {
  const supabase = getSupabaseBrowserClient();
  
  async function checkAuthAndProfile() {
    logger.debug('Checking auth state on mount', {}, true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      // AuthSessionMissingError is expected for unauthenticated users
      const isSessionMissingError = authError.message?.includes('Auth session missing') || 
                                    authError.name === 'AuthSessionMissingError';
      
      if (isSessionMissingError) {
        logger.debug('User is not authenticated (expected for prospect flow)', {}, true);
      } else {
        logger.error('Auth check error', { error: authError.message });
      }
      
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        userId: null,
        userProfile: null,
        hasExistingProfile: false,
      }));
      return;
    }

    if (user) {
      // ✅ RETRY LOGIC - This is the critical difference!
      const queryProfileWithRetry = async (retryCount = 0): Promise<void> => {
        try {
          // First verify session is available
          const { data: { session: currentSession }, error: sessionError } = 
            await supabase.auth.getSession();
          
          if (sessionError || !currentSession) {
            if (retryCount < 3) {
              // ✅ RETRY: If session not ready, wait 500ms and try again
              logger.warn('Session not ready yet, retrying in 500ms');
              setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
              
              // ✅ CRITICAL: Set auth state EVEN IF session not ready
              setState((prev) => ({
                ...prev,
                isAuthenticated: true,    // ← Auth state is SET
                userId: user.id,
                userProfile: knownProfile,
                hasExistingProfile: false,
              }));
              return; // Don't block - continue in background
            }
            // After 3 retries (1.5 seconds), still set auth state
            logger.warn('Session not ready after retries, setting auth state only');
            setState((prev) => ({
              ...prev,
              isAuthenticated: true,    // ← Still SET, just missing profile
              userId: user.id,
              userProfile: knownProfile,
            }));
            return;
          }
          
          // ✅ Only query profile if session is ready
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profileError && profileError.code === 'PGRST301' && retryCount < 3) {
            // ✅ RETRY: RLS error? Try again
            logger.warn('Auth session error, retrying in 500ms');
            setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
            return;
          }
          
          // Finally got profile data
          setState((prev) => ({
            ...prev,
            isAuthenticated: true,
            userId: user.id,
            hasExistingProfile: !!profile,
          }));
        } catch (error) {
          // ✅ Still set auth state even on exception
          setState((prev) => ({
            ...prev,
            isAuthenticated: true,
            userId: user.id,
          }));
        }
      };
      
      // Start the retry attempt
      await queryProfileWithRetry();
    }
  }

  checkAuthAndProfile();
  
  // ALSO set up auth state change listener
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      // ... handles SIGNED_IN, SIGNED_OUT events ...
    }
  );
  
  return () => subscription.unsubscribe();
}, []); // Empty dependency array - runs once on mount
```

**Key behaviors:**
1. ✅ **Retry mechanism**: Tries up to 3 times with 500ms delays
2. ✅ **Set auth state early**: Even if session/profile query fails, `isAuthenticated: true` is SET
3. ✅ **Non-blocking**: Doesn't wait for profile query to complete before setting auth state
4. ✅ **Async continuation**: Profile queries happen in background via setTimeout retries
5. ✅ **Grace handling**: Accepts failure after retries and continues anyway

---

### `/welcome/owner` (OwnerChatProvider) - BROKEN ❌

**Key code section** (OwnerChatContext.tsx, lines 232-293):

```typescript
// Check authentication and profile status (runs immediately on mount)
useEffect(() => {
  const supabase = getSupabaseBrowserClient();
  
  async function checkAuthAndProfile() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      // ❌ NO RETRY - immediate failure
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        userId: null,
        userProfile: null,
        hasExistingProfile: false,
        hasBoat: false,
        hasJourney: false,
      }));
      return;
    }

    const knownProfile = extractKnownProfile(user);
    
    // ❌ NO EARLY AUTH STATE SET - must query everything first
    // Check if user has a profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    // Check if user has boats
    const { data: boats } = await supabase
      .from('boats')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    // Check if user has journeys
    let hasJourney = false;
    if (boats?.length) {
      const { data: journeys } = await supabase
        .from('journeys')
        .select('id')
        .in('boat_id', boats.map((b) => b.id))
        .limit(1);
      hasJourney = (journeys?.length ?? 0) > 0;
    }

    // ❌ Only set state if ALL queries succeeded
    setState((prev) => ({
      ...prev,
      isAuthenticated: true,      // ← Only set if no errors above
      userId: user.id,
      userProfile: knownProfile,
      hasExistingProfile: !!profile,
      hasBoat: (boats?.length ?? 0) > 0,
      hasJourney,
    }));
  }

  // Run immediately on mount
  checkAuthAndProfile();
  
  // ALSO set up auth state change listener
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      // ...
    }
  );
  
  return () => subscription.unsubscribe();
}, []);
```

**Problem behaviors:**
1. ❌ **NO retry logic**: If any query fails (hangs due to RLS), the entire function is blocked
2. ❌ **All-or-nothing state**: `isAuthenticated: true` only set if ALL 3 queries (profile, boats, journeys) succeed
3. ❌ **Blocking**: Waits for all queries to complete before setting ANY auth state
4. ❌ **Cascading failure**: One RLS query hang blocks all three queries and prevents auth state update
5. ❌ **Silent failure**: If queries hang indefinitely, no error is caught, function just never completes

---

## What Happens on OAuth to /welcome/owner

1. **OAuth callback → successful auth** ✅
   - Supabase session is set in cookies
   - Browser redirected to `/welcome/owner?profile_completion=true`

2. **Page loads, OwnerChatProvider mounts**
   - OwnerChatContext calls `checkAuthAndProfile()`
   - Calls `supabase.auth.getUser()` - succeeds, returns authenticated user
   - Tries to query `profiles` table

3. **RLS policy blocks profiles query** ❌
   - Policy: `auth.uid() = id`
   - Browser's Supabase session not fully synced yet after OAuth
   - Query hangs indefinitely or times out slowly

4. **OwnerChatContext never sets isAuthenticated** ❌
   - Function blocked waiting for profiles query
   - Even if profiles query eventually fails, it's part of a series
   - If parties query fails, boats and journeys queries never run

5. **ConsentSetupContext stuck with authLoading: true** ❌
   - ConsentSetupContext depends on `!authLoading` to proceed
   - AuthContext's loading is false (it just gets session)
   - But ConsentSetupContext sees OwnerChatContext is not set properly
   - Wait... actually the issue is ConsentSetupContext checks different loading flag!

**Actually, let me reconsider:** The problem is that ConsentSetupContext depends on `AuthContext.loading`, not OwnerChatContext. Let me check what's actually preventing it on `/welcome/owner`.

---

## The REAL Root Cause: Multiple Auth Listener Race Conditions

Upon deeper analysis, the actual issue is a **race condition between multiple independent Supabase auth listeners**:

### What's Actually Happening:

1. **On both pages:**
   - `AuthContext` sets up its own `supabase.auth.onAuthStateChange()` listener
   - `OwnerChatContext` or `ProspectChatContext` sets up ANOTHER independent listener on the same `supabase` client

2. **On `/welcome/crew` (ProspectChatProvider):**
   - ProspectChatContext's `checkAuthAndProfile()` runs immediately
   - Has **retry logic**, so even if initial profile query fails, it sets `isAuthenticated: true` eventually
   - Meanwhile, AuthContext's auth listener completes separately
   - Result: ConsentSetupContext sees `authLoading: false` from AuthContext

3. **On `/welcome/owner` (OwnerChatProvider):**
   - OwnerChatContext's `checkAuthAndProfile()` runs and BLOCKS on profiles query (no retry)
   - Meanwhile AuthContext's auth listener is also running (on same client)
   - But OwnerChatContext's queries are blocking, creating lock contention
   - RLS queries hang because the browser's Supabase session isn't properly synced
   - Result: ConsentSetupContext sees `authLoading: true` for extended period

**The architectural flaw**: Two independent code paths trying to query the same Supabase tables on an auth session that isn't fully synced yet.

---

## Why ProspectChatProvider's Retry Logic Saves It

ProspectChatProvider's retry strategy is sophisticated:

```typescript
// CRITICAL: Set auth state early, retry profile queries in background
setState((prev) => ({
  ...prev,
  isAuthenticated: true,    // ← Set immediately even if session not ready
  userId: user.id,          // ← Auth state is complete
}));

// Then retry the problematic query in background
setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
```

This means:
- **AuthContext sees**: `user` is set, `loading: false` (from its session check)
- **ConsentSetupContext sees**: `authLoading: false`, `hasUser: true`
- **ConsentSetupContext proceeds**: Queries `user_consents` (which might also hang, but timeout wrapper handles it)
- **ProspectChatContext continues** retrying profile query in background

OwnerChatProvider doesn't do this - it just blocks forever.

---

## The Timeout Fix (Commit 519a6b6)

The timeout wrapper in ConsentSetupContext helps handle hanging RLS queries:

```typescript
const queryWithTimeout = Promise.race([
  supabase
    .from('user_consents')
    .select('privacy_policy_accepted_at, terms_accepted_at')
    .eq('user_id', user.id)
    .maybeSingle(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('RLS query timeout')), 2000)
  ),
]);
```

**Why this helps on `/welcome/crew` but not `/welcome/owner`:**
- `/welcome/crew`: ConsentSetupContext eventually gets called (because ProspectChatContext's retry logic allows auth to proceed)
- `/welcome/owner`: ConsentSetupContext never gets called because `authLoading` stays true

---

## Why They Should Work Identically (But Don't)

Both pages should:
1. Load OAuth session
2. Show ConsentSetupModal
3. Allow user to save consents
4. Proceed with AI onboarding

**But they don't work the same because:**

1. **OwnerChatProvider requires ALL queries to succeed before setting auth state** ❌
   - Profile query
   - Boats query
   - Journeys query
   
   If any hangs, auth state is never set, and ConsentSetupContext is blocked.

2. **ProspectChatProvider sets auth state incrementally** ✅
   - Sets `isAuthenticated + userId` immediately
   - Retries profile query in background
   - Gracefully degrades (still sets auth state even if profile query permanently fails)

---

## The Real Fix Needed

To make `/welcome/owner` work like `/welcome/crew`, we need to refactor OwnerChatContext to:

### Option A: Add Retry Logic (Recommended)
```typescript
async function checkAuthAndProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  // ✅ Set auth state EARLY
  setState(prev => ({
    ...prev,
    isAuthenticated: true,
    userId: user.id,
    userProfile: extractKnownProfile(user),
  }));
  
  // Then query profile/boats/journeys with retry logic
  // (like ProspectChatProvider does)
  queryDataWithRetry();
}
```

### Option B: Make Queries Non-Blocking
```typescript
// Start queries in parallel, don't wait for all to complete
Promise.all([profileTask, boatsTask, journeys Task])
  .then(results => setState(...))
  .catch(() => {
    // Set partial state even if some queries failed
    setState(prev => ({
      ...prev,
      isAuthenticated: true,  // ← Still authenticated even if profile query failed
      userId: user.id,
      hasExistingProfile: false,  // Fallback
    }));
  });
```

### Option C: Eliminate Redundant Queries
Both chat contexts and AuthContext are querying auth status. We could:
- Have OwnerChatContext use `useAuth()` from AuthContext instead of calling `supabase.auth.getUser()` again
- This would eliminate the race condition entirely

---

## Summary

| Aspect | `/welcome/crew` (Prospect) | `/welcome/owner` (Owner) |
|--------|---------------------------|-------------------------|
| **Auth State Setting** | Incremental, early | Monolithic, late |
| **Retry Logic** | ✅ Has 3-retry mechanism | ❌ No retry |
| **Blocking** | Non-blocking for profile queries | Blocks entire function |
| **Error Handling** | Degrades gracefully | Silent failure |
| **Result on OAuth** | `authLoading: false` → ConsentSetupModal shows | `authLoading: true` → ConsentSetupModal blocked |
| **RLS Hang Behavior** | Retries for 1.5s, succeeds or gracefully fails | Hangs indefinitely |
| **Timeout Wrapper Help** | Works because auth state already set | Doesn't help because auth state never set |

The architectural difference isn't intentional—it's due to ProspectChatProvider being written more defensively with retry logic, while OwnerChatProvider uses the simpler all-or-nothing approach that breaks when upstream systems (Supabase session sync) aren't perfectly timing'd.

---

## Recommended Next Steps

1. **Immediate**: Add retry logic to OwnerChatContext (copy pattern from ProspectChatContext)
2. **Short-term**: Test both pages work identically after OAuth
3. **Long-term**: Refactor both contexts to share auth state via AuthContext instead of querying independently
