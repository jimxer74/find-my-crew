/**
 * Limits System
 *
 * Centralized exports for the environment-based limits system.
 * Set environment variables to control limits:
 * - LIMIT_MAX_BOATS_PER_USER
 * - LIMIT_MAX_JOURNEYS_PER_USER
 * - LIMIT_MAX_LEGS_PER_JOURNEY
 * - LIMIT_MAX_REGISTERED_USERS
 * - LIMIT_MAX_WAYPOINTS_PER_LEG
 * - LIMIT_MAX_IMAGES_PER_BOAT
 * - LIMIT_MAX_AI_MESSAGES_PER_DAY_PER_USER
 *
 * If an environment variable is not set, no limit applies (unlimited).
 */

export * from './types';
export * from './config';
export * from './service';
