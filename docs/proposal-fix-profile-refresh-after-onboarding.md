# Proposal: Fix Profile Refresh After Onboarding Completion

## Problem Statement

After completing onboarding chat (both crew and owner), when users navigate to view journeys or boats, the profile state is not updated. This causes:
1. **NavigationMenu** to show incorrect items (missing role-based menu items)
2. **Pages** to not work properly (incorrect access checks, missing data)

## Root Cause Analysis

### Current Flow

**When profile/boat/journey is created in chat:**

1. **OwnerChatContext** (`app/contexts/OwnerChatContext.tsx`):
   - Lines 674-676: Updates local state (`hasExistingProfile`, `hasBoat`, `hasJourney`)
   - Lines 681-687: Updates onboarding state
   - **Missing**: Does NOT dispatch `profileUpdated` event

2. **ProspectChatContext** (`app/contexts/ProspectChatContext.tsx`):
   - Line 962: Detects `profileCreated === true`
   - Updates local state
   - **Missing**: Does NOT dispatch `profileUpdated` event

3. **useProfile Hook** (`app/lib/profile/useProfile.tsx`):
   - Lines 169-177: Listens for `profileUpdated` events
   - When event received: Clears cache and refetches profile
   - **Issue**: Event is never dispatched from chat contexts

4. **NavigationMenu** (`app/components/NavigationMenu.tsx`):
   - Line 45: Uses `useProfile()` hook
   - Line 194: Uses `useUserRoles()` hook
   - **Issue**: Profile data is stale because `useProfile` cache wasn't invalidated

### Why This Happens

- Chat contexts update their **local state** but don't notify the **global profile state**
- `useProfile` hook has a **5-minute cache** that prevents refetching
- `profileUpdated` event is only dispatched from `/profile` page, not from chat contexts
- NavigationMenu relies on `useProfile` which has stale data

## Proposed Solution

### Solution: Dispatch `profileUpdated` Event After Onboarding Completion

**When profile/boat/journey is created in chat contexts, dispatch the `profileUpdated` event to trigger profile refresh.**

### Implementation Plan

#### Phase 1: OwnerChatContext - Dispatch Events After Creation

**File:** `app/contexts/OwnerChatContext.tsx`

**Changes:**

1. **After profile creation** (around line 681):
   ```typescript
   if (data.profileCreated === true) {
     updateOnboardingState('boat_pending');
     
     // Dispatch profileUpdated event to refresh profile state
     if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('profileUpdated', {
         detail: {
           updatedFields: ['roles', 'profile_completion_percentage'],
           timestamp: Date.now()
         }
       }));
     }
   }
   ```

2. **After boat creation** (around line 683):
   ```typescript
   else if (data.boatCreated === true) {
     updateOnboardingState('journey_pending');
     
     // Dispatch profileUpdated event (boat creation doesn't change profile, but refresh anyway)
     if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('profileUpdated', {
         detail: {
           updatedFields: [],
           timestamp: Date.now()
         }
       }));
     }
   }
   ```

3. **After journey creation** (around line 685):
   ```typescript
   else if (data.journeyCreated === true) {
     updateOnboardingState('completed');
     
     // Dispatch profileUpdated event to refresh profile state
     if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('profileUpdated', {
         detail: {
           updatedFields: [],
           timestamp: Date.now()
         }
       }));
     }
   }
   ```

4. **Same changes in `approveAction` callback** (around lines 753-759)

#### Phase 2: ProspectChatContext - Dispatch Event After Profile Creation

**File:** `app/contexts/ProspectChatContext.tsx`

**Changes:**

1. **After profile creation** (around line 962):
   ```typescript
   if (data.profileCreated === true) {
     console.log('[ProspectChatContext] 🎉 Profile created successfully! Clearing all prospect data...');
     
     // Dispatch profileUpdated event to refresh profile state
     if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('profileUpdated', {
         detail: {
           updatedFields: ['roles', 'profile_completion_percentage', 'full_name', 'user_description'],
           timestamp: Date.now()
         }
       }));
     }
     
     // ... rest of existing code ...
   }
   ```

#### Phase 3: Also Dispatch When Journey Created via generate_journey_route

**File:** `app/contexts/OwnerChatContext.tsx`

**Note:** When `generate_journey_route` creates a journey, we need to check for `journeyCreated` in the response.

**Changes:**

Check if the response includes journey creation even when it's via `generate_journey_route`:
```typescript
// After receiving chat response
if (data.journeyCreated === true || (data.message?.metadata?.journeyCreated === true)) {
  // Dispatch profileUpdated event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('profileUpdated', {
      detail: {
        updatedFields: [],
        timestamp: Date.now()
      }
    }));
  }
}
```

## Alternative Approach: Force Profile Refetch

Instead of relying on events, we could:

1. **Call `refetch()` directly** from `useProfile` hook
2. **Clear cache** and trigger refetch programmatically
3. **Use router.refresh()** to force page refresh

**However**, the event-based approach is better because:
- It's consistent with existing pattern (`/profile` page uses events)
- It's non-invasive (doesn't require passing refetch functions)
- It works across all components using `useProfile`

## Testing Strategy

1. **Test Owner Chat:**
   - Complete profile creation → Verify NavigationMenu shows owner items
   - Complete boat creation → Verify NavigationMenu still works
   - Complete journey creation → Verify NavigationMenu still works
   - Navigate to `/owner/boats` → Verify page loads correctly
   - Navigate to `/owner/journeys` → Verify page loads correctly

2. **Test Prospect Chat:**
   - Complete profile creation → Verify NavigationMenu shows crew items
   - Navigate to `/crew` → Verify page loads correctly
   - Navigate to `/crew/registrations` → Verify page loads correctly

3. **Verify Profile State:**
   - Check `useProfile` hook cache is cleared
   - Check profile data is refetched from database
   - Check `useUserRoles` hook updates correctly
   - Check NavigationMenu shows correct role-based items

## Expected Outcomes

After implementing:
- ✅ Profile state refreshes immediately after onboarding completion
- ✅ NavigationMenu shows correct role-based items
- ✅ Pages load correctly with proper access checks
- ✅ No stale profile data in cache
- ✅ Consistent behavior across owner and prospect chats

## Implementation Notes

1. **Event Detail Format:**
   - Match the format used in `/profile` page (lines 501-509)
   - Include `updatedFields` array for debugging
   - Include `timestamp` for event ordering

2. **Window Check:**
   - Always check `typeof window !== 'undefined'` before dispatching
   - Prevents SSR errors

3. **Timing:**
   - Dispatch event **after** state update
   - Dispatch event **before** navigation (if any)

4. **Debouncing:**
   - `useProfile` hook already has 500ms debounce (line 55)
   - Multiple rapid events won't cause excessive refetches
