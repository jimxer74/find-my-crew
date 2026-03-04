---
id: TASK-149
title: Add inline consent step to crew-v2 and owner-v2 onboarding flows
status: Done
assignee: []
created_date: '2026-03-04 11:25'
updated_date: '2026-03-04 11:28'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After signup in /welcome/crew-v2 and /welcome/owner-v2, show the consent form inline as a checkpoint card in the flow (like ProfileCheckpoint, BoatCheckpoint etc.) instead of a floating modal overlay.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added inline consent step to both v2 onboarding flows.

**New file**: `app/components/onboarding/ConsentCheckpoint.tsx`
- Inline consent form styled as a checkpoint card (matching CheckpointCard style: `rounded-xl border border-border bg-card shadow-sm`)
- Same save logic as `ConsentSetupModal`: upserts `user_consents`, writes audit log, calls `/api/onboarding/after-consent`
- AI processing pre-checked by default (user is signing up for AI-assisted onboarding)
- `onComplete()` callback — no router navigation, parent controls phase transition

**CrewOnboardingV2.tsx** and **OwnerOnboardingV2.tsx** — identical changes in both:
- Added `'consenting'` to `OnboardingPhase` union
- Added "Terms" step to `STEPS` array (between Account and Profile/About you)
- Updated `stepIndex()` to map `'consenting'` → 1, shifting all later steps up by 1
- `useEffect` now waits for `consentLoading` before resolving start phase; gates to `'consenting'` when `needsConsentSetup` is true
- `'consenting'` excluded from sessionStorage persistence (re-determined on load like `'signup'`)
- Loading spinner now shown while `user && consentLoading` (prevents phase flicker)
- `handleConsentComplete` advances phase to `'chatting'`
- Consent step rendered inline between signup and chat cards
- Removed floating `ConsentSetupModal` + `consentDone` state entirely

`ConsentSetupContext` already excludes `/welcome/crew-v2` and `/welcome/owner-v2` from the global modal — no changes needed there.
<!-- SECTION:FINAL_SUMMARY:END -->
