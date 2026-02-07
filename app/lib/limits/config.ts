/**
 * Limits Configuration
 *
 * Environment variable-based limits configuration.
 * If an environment variable is not set, no limit applies (unlimited).
 *
 * Environment variables:
 * - LIMIT_MAX_BOATS_PER_USER: Maximum boats a user can create
 * - LIMIT_MAX_JOURNEYS_PER_USER: Maximum journeys a user can create
 * - LIMIT_MAX_LEGS_PER_JOURNEY: Maximum legs per journey
 * - LIMIT_MAX_REGISTERED_USERS: Maximum total registered users
 * - LIMIT_MAX_WAYPOINTS_PER_LEG: Maximum waypoints per leg
 * - LIMIT_MAX_IMAGES_PER_BOAT: Maximum images per boat
 * - LIMIT_MAX_AI_MESSAGES_PER_DAY_PER_USER: Maximum AI assistant messages per day per user
 */

import { Limits } from './types';

/**
 * Parse an environment variable as a positive integer.
 * Returns null if not set or invalid (meaning no limit).
 */
function parseEnvLimit(envVar: string | undefined): number | null {
  if (!envVar) return null;
  const parsed = parseInt(envVar, 10);
  if (isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Get the current limits from environment variables.
 * Returns null for any limit that is not set (meaning unlimited).
 */
export function getLimits(): Limits {
  return {
    maxBoatsPerUser: parseEnvLimit(process.env.LIMIT_MAX_BOATS_PER_USER),
    maxJourneysPerUser: parseEnvLimit(process.env.LIMIT_MAX_JOURNEYS_PER_USER),
    maxLegsPerJourney: parseEnvLimit(process.env.LIMIT_MAX_LEGS_PER_JOURNEY),
    maxRegisteredUsers: parseEnvLimit(process.env.LIMIT_MAX_REGISTERED_USERS),
    maxWaypointsPerLeg: parseEnvLimit(process.env.LIMIT_MAX_WAYPOINTS_PER_LEG),
    maxImagesPerBoat: parseEnvLimit(process.env.LIMIT_MAX_IMAGES_PER_BOAT),
    maxAIMessagesPerDayPerUser: parseEnvLimit(process.env.LIMIT_MAX_AI_MESSAGES_PER_DAY_PER_USER),
  };
}

/**
 * Get a specific limit value.
 * Returns null if not set (meaning unlimited).
 */
export function getLimit(key: keyof Limits): number | null {
  return getLimits()[key];
}

/**
 * Check if a specific limit is configured (not unlimited).
 */
export function hasLimit(key: keyof Limits): boolean {
  return getLimits()[key] !== null;
}

/**
 * Check if any limits are configured.
 */
export function hasAnyLimits(): boolean {
  const limits = getLimits();
  return Object.values(limits).some(v => v !== null);
}
