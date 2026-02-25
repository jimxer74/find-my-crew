/**
 * Utility functions for profile handling
 *
 * Key distinction:
 * - No profile exists → Treat like unauthenticated user (hide all match badges)
 * - Profile exists but incomplete → Use available data for matching calculations
 */

import { ProfileData } from '@shared/lib/profile/useProfile';

/**
 * Check if a profile exists (is not null)
 * Even an incomplete profile (empty skills, no experience level) counts as existing
 *
 * @param profile - The profile object to check
 * @returns true if profile exists, false if no profile at all
 */
export function hasProfile(profile: ProfileData | null): boolean {
  return profile !== null;
}

/**
 * Check if profile is completely missing (same as unauthenticated)
 * This is the opposite of hasProfile
 *
 * @param profile - The profile object to check
 * @returns true if no profile (treat like unauthenticated), false if profile exists
 */
export function isProfileMissing(profile: ProfileData | null): boolean {
  return profile === null;
}
