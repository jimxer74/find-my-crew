'use client';

import { CrewOnboardingV2 } from '@/app/components/onboarding/CrewOnboardingV2';

/**
 * New crew onboarding flow (v2) — profile-quality focus.
 *
 * Signup-first → AI chat → profile review & save → redirect to /crew
 *
 * Collects: name, experience, 3+ skills, bio, motivation, risk levels,
 * preferred locations, and availability dates to build a rich crew profile.
 *
 * The original flow at /welcome/crew remains completely unchanged.
 */
export default function CrewOnboardingV2Page() {
  return <CrewOnboardingV2 />;
}
