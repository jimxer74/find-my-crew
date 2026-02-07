/**
 * Limits System Types
 *
 * Defines types for the environment-based limits system.
 * If an environment variable is not set, no limit applies (unlimited).
 */

export interface Limits {
  maxBoatsPerUser: number | null;
  maxJourneysPerUser: number | null;
  maxLegsPerJourney: number | null;
  maxRegisteredUsers: number | null;
  maxWaypointsPerLeg: number | null;
  maxImagesPerBoat: number | null;
  maxAIMessagesPerDayPerUser: number | null;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null; // null means no limit
  message?: string;
}

export interface UserUsage {
  boatCount: number;
  journeyCount: number;
}

export interface JourneyUsage {
  legCount: number;
}

export interface SystemUsage {
  totalUsers: number;
}

export interface AIUsage {
  messagesUsedToday: number;
}
