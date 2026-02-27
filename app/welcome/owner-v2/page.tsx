'use client';

import { OwnerOnboardingV2 } from '@/app/components/onboarding/OwnerOnboardingV2';

/**
 * New async owner onboarding flow (v2).
 *
 * Replaces the all-chat-based flow with structured confirmation checkpoints:
 *   1. Pre-signup AI chat (sync) → collects profile + boat info
 *   2. Signup modal
 *   3. Profile checkpoint → confirm & save
 *   4. Boat checkpoint → confirm & save
 *   5. Equipment checkpoint (optional) → async AI generation + review
 *   6. Journey checkpoint (optional) → redirect to journey planner
 *
 * The original flow at /welcome/owner remains completely unchanged.
 */
export default function OwnerOnboardingV2Page() {
  return <OwnerOnboardingV2 />;
}
