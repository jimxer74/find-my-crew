/**
 * Check if a user has a specific role or roles
 * @param roles - Array of roles from profile (can be null/undefined)
 * @param requiredRole - Single role or array of roles to check
 * @returns true if user has at least one of the required roles
 */
export function hasRole(
  roles: string[] | null | undefined,
  requiredRole: 'owner' | 'crew' | ('owner' | 'crew')[]
): boolean {
  if (!roles || roles.length === 0) {
    return false;
  }

  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  
  return requiredRoles.some(role => roles.includes(role));
}

/**
 * Check if user has owner role
 */
export function hasOwnerRole(roles: string[] | null | undefined): boolean {
  return hasRole(roles, 'owner');
}

/**
 * Check if user has crew role
 */
export function hasCrewRole(roles: string[] | null | undefined): boolean {
  return hasRole(roles, 'crew');
}

/**
 * Check if user has both owner and crew roles
 */
export function hasBothRoles(roles: string[] | null | undefined): boolean {
  return hasOwnerRole(roles) && hasCrewRole(roles);
}
