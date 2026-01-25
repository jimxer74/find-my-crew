/**
 * Limits Configuration
 *
 * Centralized configuration for release-based limits.
 * Set RELEASE_TYPE environment variable to: 'pilot', 'beta', or 'production'
 */

import { ReleaseType, ReleaseLimits } from './types';

// Define limits for each release type
const LIMITS_BY_RELEASE: Record<ReleaseType, ReleaseLimits> = {
  pilot: {
    maxBoatsPerUser: 1,
    maxJourneysPerUser: 2,
    maxLegsPerJourney: 10,
    maxRegisteredUsers: 50,
    maxWaypointsPerLeg: 20,
    maxImagesPerBoat: 5,
  },
  beta: {
    maxBoatsPerUser: 3,
    maxJourneysPerUser: 10,
    maxLegsPerJourney: 25,
    maxRegisteredUsers: 500,
    maxWaypointsPerLeg: 50,
    maxImagesPerBoat: 10,
  },
  production: {
    maxBoatsPerUser: 10,
    maxJourneysPerUser: 50,
    maxLegsPerJourney: 50,
    maxRegisteredUsers: Infinity,
    maxWaypointsPerLeg: 100,
    maxImagesPerBoat: 20,
  },
};

/**
 * Get the current release type from environment variable
 * Defaults to 'pilot' if not set
 */
export function getReleaseType(): ReleaseType {
  const releaseType = process.env.RELEASE_TYPE?.toLowerCase();

  if (releaseType === 'beta' || releaseType === 'production') {
    return releaseType;
  }

  // Default to pilot for safety
  return 'pilot';
}

/**
 * Get the limits for the current release type
 */
export function getLimits(): ReleaseLimits {
  return LIMITS_BY_RELEASE[getReleaseType()];
}

/**
 * Check if we're in pilot mode
 */
export function isPilot(): boolean {
  return getReleaseType() === 'pilot';
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return getReleaseType() === 'production';
}

/**
 * Get a human-readable release type name
 */
export function getReleaseTypeName(): string {
  const type = getReleaseType();
  return type.charAt(0).toUpperCase() + type.slice(1);
}
