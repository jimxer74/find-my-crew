/**
 * Check if a user has a specific role
 * Uses the 'roles' array field from the profiles table
 */
export function hasRole(profile: { roles?: string[] | null } | null | undefined, role: 'owner' | 'crew'): boolean {
  return profile?.roles?.includes(role) ?? false;
}

/**
 * Check if user has owner role
 */
export function hasOwnerRole(profile: any): boolean {
  return hasRole(profile, 'owner');
}

/**
 * Check if user has crew role
 */
export function hasCrewRole(profile: any): boolean {
  return hasRole(profile, 'crew');
}
