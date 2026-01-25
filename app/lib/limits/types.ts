/**
 * Limits System Types
 *
 * Defines types for the pilot release limits system.
 */

export type ReleaseType = 'pilot' | 'beta' | 'production';

export interface ReleaseLimits {
  maxBoatsPerUser: number;
  maxJourneysPerUser: number;
  maxLegsPerJourney: number;
  maxRegisteredUsers: number;
  maxWaypointsPerLeg: number;
  maxImagesPerBoat: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
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
