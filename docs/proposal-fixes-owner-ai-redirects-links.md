# Proposal: Fixes for Owner AI create_boat, Redirects, and Post-Onboarding Links

## Overview

This document proposes fixes for three reported areas:

1. **AI create_boat use case** – AI often does not call `create_boat` until the user explicitly says e.g. "please call create_boat".
2. **Redirects** – Route redirects fail sporadically; e.g. logged-in owner with no session not redirected to the expected owner destination; behavior inconsistent.
3. **Post-onboarding links** – After owner onboarding is done (e.g. journey created), "View Boat Details" and "View Journey Details" links do not work reliably.

---

## 1. Create Boat: AI Not Recognizing When to Call the Tool

### Current Behavior

- Step `add_boat` exposes only `fetch_boat_details_from_sailboatdata` and `create_boat`.
- Prompt says: present summary → "when user confirms, call `create_boat`" and "User confirmation = 'yes', 'looks good', 'confirm', etc. → call create_boat immediately."
- The model often does **not** emit a `create_boat` tool call after the user confirms; it only does so after an explicit prompt like "please call create_boat".

### Likely Causes

- **Confirmation phrasing** is described in one short line; the model may not treat it as a hard rule.
- **No explicit "you must call the tool" rule** in the add_boat step (unlike the old long prompt that had "CALL THE TOOL IMMEDIATELY" and long confirmation lists).
- **Tool-call format** is generic; there is no add_boat–specific example showing a real `create_boat` call with required fields.
- **No reminder** that after showing a boat summary, the *only* valid next action is to call `create_boat` on confirmation (no other tool).

### Proposed Fixes (Prompting)

1. **Strengthen add_boat instructions in `buildOwnerPromptForStep` (add_boat branch)**  
   - Add a single, very explicit rule:  
     "After you have shown the user a boat summary, if they reply with any confirmation (yes, looks good, confirm, correct, go ahead, create it, etc.), you MUST call the `create_boat` tool in your very next response. Do not ask again; do not describe the tool—call it."
   - Optionally list confirmation phrases again in this step only.

2. **Add a one-line "current phase" hint**  
   - If we can pass a simple hint (e.g. "last message was a boat summary"), add:  
     "You have just shown a boat summary. If the user's message is a confirmation, call create_boat now."
   - This can be implemented later if we add lightweight state (e.g. "last assistant message contained a boat summary") from the last turn.

3. **Include a concrete create_boat example in the add_boat step only**  
   - In the add_boat block, append a short example of a valid `create_boat` tool call (required fields: name, type, make_model, capacity) so the model sees the exact JSON shape once per conversation for this step.

4. **Clarify tool description for create_boat in this flow**  
   - In the step-specific tools block, add one sentence to the create_boat description:  
     "Call this as soon as the user confirms the boat summary (e.g. yes, looks good, confirm)."

5. **Optional: Retry / feedback on "summary but no tool"**  
   - In the owner chat tool loop, if the last assistant message looks like a boat summary (e.g. contains "name:", "type:", "capacity:" and boat-like content) and the user's message looks like a short confirmation (e.g. "yes", "looks good") but no `create_boat` call was parsed, inject a short user-side message:  
     "The user confirmed. Call the create_boat tool with the boat details you just summarized."  
   - This is a fallback; improving the prompt (1–4) should reduce the need for it.

### Files to Touch

- `app/lib/ai/owner/service.ts` – `buildOwnerPromptForStep` case `'add_boat'`: extend `stateAndGoal` and `stepInstructions`, add optional example and explicit "must call on confirmation" rule.

---

## 2. Redirects: Sporadic Failures and Wrong Destination

### Current Behavior

- **Root (`/`)**: If user is logged in, we call `shouldStayOnHomepage(user.id)`. If false, we call `redirectAfterAuth(user.id, 'root', router)`.
- **Redirect service**:  
  - Priority 1: Pending owner/prospect onboarding session → `/welcome/owner` or `/welcome/crew`.  
  - Priority 5: Role owner → `/owner/dashboard`.  
  - Dashboard then does `router.push('/owner/boats')`.
- User reports: "Redirects do not always work" and "if user is logged in and no session, not redirected to /owner/journeys as supposed."

### Likely Causes

- **Expected target** – User expects "redirect to /owner/journeys". Current design redirects owners to `/owner/dashboard`, which then redirects to `/owner/boats`. So either the product expectation is "owners land on journeys" or there is a bug in the intended target. Both should be clarified and aligned.
- **Race / ordering** – Redirect runs in a `useEffect` that depends on `user` and `authLoading`. If `buildRedirectContext` runs before the DB has been updated (e.g. right after onboarding completion), it might still see a "pending" session or stale profile and send the user to `/welcome/owner` instead of the post-onboarding destination.
- **No await of onboarding state update** – In `OwnerChatContext`, when we set `journeyCreated` we call `updateOnboardingState('completed')` but do **not** await it before dispatching `profileUpdated`. So the next navigation or redirect check might run before `owner_sessions.onboarding_state` is updated, leading to inconsistent redirects.
- **Single shot** – Root page runs the redirect logic once per effect run. If the first run fails (e.g. network, slow Supabase) or returns "stay on homepage" due to stale data, we don’t retry or re-run when data becomes ready.
- **Router timing** – `router.push(url)` and `router.refresh()` are fire-and-forget; we don’t wait for navigation to complete. Usually fine, but in edge cases (e.g. fast double mount) behavior can be flaky.

### Proposed Fixes (Redirects)

1. **Clarify and align owner landing target**  
   - Decide: after redirect, should owners land on `/owner/boats` or `/owner/journeys`?  
   - If the desired behavior is "owners without pending onboarding → /owner/journeys", then either:  
     - Change `redirectService.checkRoleBasedRedirects` for owner to return `path: '/owner/journeys'`, or  
     - Keep `/owner/dashboard` but change the dashboard page to redirect to `/owner/journeys` instead of `/owner/boats`.  
   - Update the centralized redirect doc and code so one place defines the owner post-onboarding landing.

2. **Await onboarding state update before dispatching profileUpdated**  
   - In `OwnerChatContext`, whenever we call `updateOnboardingState(...)` before dispatching `profileUpdated`, **await** `updateOnboardingState` so the DB is updated before any downstream logic (e.g. redirect or link click) runs.  
   - Example: `await updateOnboardingState('completed');` then dispatch `profileUpdated`.  
   - This reduces the chance that the next redirect check still sees a pending session.

3. **More robust root redirect**  
   - **Retry once on failure**: If `shouldStayOnHomepage` or `redirectAfterAuth` throws or the redirect path is clearly wrong, retry once after a short delay (e.g. 500–800 ms) so a transient failure or stale read doesn’t permanently leave the user on the wrong page.  
   - **Dependency**: Consider adding a small delay or a "redirect attempt" counter so we don’t loop forever; e.g. run at most two attempts.  
   - Optionally log when redirect is skipped (e.g. error) so we can see sporadic failures in logs.

4. **Optional: Re-run redirect when session state might have changed**  
   - If the app knows "onboarding just completed" (e.g. from context or a query param), we could trigger a single re-check of "should stay on homepage" and then redirect if the result changes. This is a refinement after 2 and 3.

### Files to Touch

- `app/lib/routing/redirectService.ts` – Optionally change owner default path to `/owner/journeys` (or keep and document as product decision).
- `app/owner/dashboard/page.tsx` – If product decision is "land on journeys", change redirect from `/owner/boats` to `/owner/journeys`.
- `app/contexts/OwnerChatContext.tsx` – Await `updateOnboardingState` before dispatching `profileUpdated` in all branches (profile created, boat created, journey created) in both `handleSendMessage` and `approveAction`.
- `app/page.tsx` – Add a single retry (with short delay and max attempts) around `shouldStayOnHomepage` / `redirectAfterAuth` and improve error logging.

---

## 3. Post-Onboarding: "View Boat Details" / "View Journey Details" Links Not Working

### Current Behavior

- After onboarding, OwnerChat shows "View Boat Details" (`/owner/boats`) and "View Journey Details" (`/owner/journeys`) as Next.js `<Link>` components.
- Boats page: uses `useAuth()`, `checkProfile(user.id)` for owner role, and `<FeatureGate feature="create_boat">`. If the profile is missing or doesn’t have the owner role, FeatureGate shows "Add owner role to your profile" instead of content.
- Journeys page: uses `useAuth()` and `useProfile()`; if `profile` is null or doesn’t include `'owner'`, it sets `hasOwnerRole` to false and can show limited or wrong UI.

### Likely Causes

- **Stale profile cache** – `useProfile` caches profile by userId and listens for `profileUpdated`. On `profileUpdated` it **debounces 500 ms** then clears cache and refetches. So for 500 ms after journey/boat created, any component using `useProfile` may still see old data (no owner role or outdated). If the user clicks "View Journey Details" within that window, the journeys page mounts with stale (or still-loading) profile and may show the limited-access message or redirect.
- **No immediate invalidation on onboarding completion** – We don’t clear the profile cache or force a refetch at the moment we know onboarding completed (e.g. journey created). We only dispatch `profileUpdated`, which is debounced.
- **FeatureGate** – Boats and journeys pages (or their parents) use FeatureGate; if profile hasn’t refreshed yet, access is denied and the user sees "Add owner role" even though they just completed onboarding.

### Proposed Fixes (Links / Profile Refresh)

1. **Immediate profile invalidation when onboarding completes**  
   - When we dispatch `profileUpdated` from OwnerChatContext after `profileCreated`, `boatCreated`, or `journeyCreated`, we need the profile cache to be invalidated **immediately**, not after 500 ms.  
   - **Option A (recommended):** In `useProfile`, when handling `profileUpdated`, if the event detail indicates an onboarding-related update (e.g. `detail?.source === 'onboarding'` or a specific flag), skip the debounce: clear cache and call `fetchProfile` immediately.  
   - **Option B:** Reduce or remove the debounce for all `profileUpdated` events (may increase refetches on rapid successive updates; less targeted).  
   - **Option C:** From OwnerChatContext, after updating state and (when implemented) awaiting `updateOnboardingState`, call a small helper that clears `profileCache` for the current user and then dispatches `profileUpdated` with a flag like `{ detail: { immediate: true } }`; in `useProfile`, on `immediate: true`, invalidate and refetch without debounce.

2. **Ensure profileUpdated is dispatched after state is persisted**  
   - Await `updateOnboardingState` before dispatching `profileUpdated` (same as redirect fix). That way, when the profile is refetched, the session state in the DB is already "completed" and consistent.

3. **Optional: Invalidate before navigation when clicking the links**  
   - In OwnerChat, the "View Boat Details" and "View Journey Details" buttons could be changed to `onClick` + `router.push`: on click, first call `profileCache.delete(user.id)` (or a shared `invalidateProfile()`) and optionally trigger a refetch or dispatch `profileUpdated` with immediate flag, then `router.push('/owner/boats')` or `router.push('/owner/journeys')`. This makes the next page load with a fresh profile.  
   - This is a UX improvement; the main fix is (1) so that any navigation after onboarding sees an up-to-date profile quickly.

### Files to Touch

- `app/lib/profile/useProfile.tsx` – In `handleProfileUpdate`, support an immediate refetch (e.g. when `event.detail?.immediate === true` or `event.detail?.source === 'onboarding'`): clear cache and call `fetchProfile` without debounce.
- `app/contexts/OwnerChatContext.tsx` – When dispatching `profileUpdated` after boat/journey/profile creation, pass a detail like `{ immediate: true }` (or `source: 'onboarding'`) so useProfile can skip debounce; and await `updateOnboardingState` before dispatching.
- Optional: `app/components/owner/OwnerChat.tsx` – For "View Boat Details" and "View Journey Details", add onClick that invalidates profile (or calls a shared invalidation) then navigates.

---

## Implementation Order

1. **Redirects and state**  
   - Await `updateOnboardingState` before dispatching `profileUpdated` in OwnerChatContext.  
   - Decide owner landing (boats vs journeys) and update redirectService or dashboard.  
   - Add one retry with delay for root redirect and improve error logging.

2. **Profile refresh**  
   - Add immediate invalidation/refetch in useProfile when `profileUpdated` has an onboarding/immediate flag.  
   - From OwnerChatContext, pass that flag when dispatching after profile/boat/journey creation.

3. **Create boat prompting**  
   - Harden add_boat step: explicit "must call create_boat on confirmation" rule, optional example, and clearer tool description.  
   - Optionally add the "summary without tool call" feedback in the tool loop.

4. **Optional**  
   - Invalidate profile on click of "View boats/journeys" links before navigation.  
   - Re-run redirect once when onboarding might have just completed.

---

## Summary Table

| Issue | Root cause | Proposed fix |
|-------|------------|--------------|
| AI doesn’t call create_boat | Prompt not explicit enough; no strong "call on confirmation" rule or example | Stronger add_boat instructions + optional example + optional feedback when summary present but no tool |
| Redirects sporadic | Stale session state (state update not awaited); no retry; possible wrong target | Await updateOnboardingState; retry root redirect once; align owner landing to /owner/journeys or document /owner/boats |
| View boats/journeys links fail | useProfile 500 ms debounce; stale cache when user clicks immediately | Immediate profile invalidation when onboarding completes (flag in profileUpdated); await state update before dispatch |

All changes are in existing files; no new services or DB schema required. Implementing in the order above should address the three areas without starting from scratch.
