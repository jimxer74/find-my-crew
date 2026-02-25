import type { ProfileStatus } from '@shared/lib/profile/checkProfile';
import { hasRole } from '@shared/lib/profile/hasRole';

export type FeatureName = 
  | 'browse_legs_full'
  | 'register_for_leg'
  | 'create_boat'
  | 'create_journey'
  | 'view_registrations'
  | 'view_profiles'
  | 'browse_legs_limited';

/**
 * Check if user has access to a specific feature
 * @param profileStatus - Profile status from checkProfile()
 * @param feature - Feature name to check
 * @returns true if user has access
 */
export function hasFeatureAccess(
  profileStatus: ProfileStatus | null,
  feature: FeatureName
): boolean {
  // No profile - only limited browsing
  if (!profileStatus || !profileStatus.exists) {
    return feature === 'browse_legs_limited';
  }

  // Profile exists but no roles - can browse full legs and view profiles
  if (!profileStatus.hasRoles) {
    return feature === 'browse_legs_full' || feature === 'view_profiles';
  }

  const roles = profileStatus.roles;

  // Feature access rules
  switch (feature) {
    case 'browse_legs_limited':
    case 'browse_legs_full':
    case 'view_profiles':
      return true; // All authenticated users with profile

    case 'register_for_leg':
      return hasRole(roles, 'crew');

    case 'create_boat':
    case 'create_journey':
    case 'view_registrations':
      return hasRole(roles, 'owner');

    default:
      return false;
  }
}

/**
 * Get list of features user has access to
 */
export function getAvailableFeatures(profileStatus: ProfileStatus | null): FeatureName[] {
  const allFeatures: FeatureName[] = [
    'browse_legs_limited',
    'browse_legs_full',
    'register_for_leg',
    'create_boat',
    'create_journey',
    'view_registrations',
    'view_profiles',
  ];

  return allFeatures.filter(feature => hasFeatureAccess(profileStatus, feature));
}
