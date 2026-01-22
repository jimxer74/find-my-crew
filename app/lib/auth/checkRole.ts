/**
 * Check if a user has a specific role
 * Supports both old 'role' field and new 'roles' array for backward compatibility
 */
export function hasRole(profile: any, role: 'owner' | 'crew'): boolean {
  if (!profile) return false;
  
  // Check new roles array first
  if (profile.roles && Array.isArray(profile.roles)) {
    return profile.roles.includes(role);
  }
  
  // Fallback to old role field for backward compatibility
  if (profile.role) {
    return profile.role === role;
  }
  
  return false;
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
