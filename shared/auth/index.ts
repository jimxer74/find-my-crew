// Auth module - Authentication and authorization
export { useAuth } from './AuthContext';
export { useUserRoles } from './UserRoleContext';
export { hasRole, hasOwnerRole, hasCrewRole } from './checkRole';
export { hasFeatureAccess, getAvailableFeatures, type FeatureName } from './featureAccess';
