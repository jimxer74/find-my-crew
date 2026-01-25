/**
 * Limits Service
 *
 * Provides functions to check various limits for the pilot release.
 * Use these functions before creating boats, journeys, legs, or registrations.
 */

import { createClient } from '@supabase/supabase-js';
import { getLimits, getReleaseType } from './config';
import { LimitCheckResult, UserUsage, JourneyUsage, SystemUsage } from './types';

/**
 * Check if a user can create another boat
 */
export async function canCreateBoat(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();

  const { count, error } = await supabase
    .from('boats')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (error) {
    console.error('Error checking boat count:', error);
    return {
      allowed: false,
      current: 0,
      limit: limits.maxBoatsPerUser,
      message: 'Failed to check boat limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limits.maxBoatsPerUser) {
    return {
      allowed: false,
      current: currentCount,
      limit: limits.maxBoatsPerUser,
      message: `You have reached the maximum of ${limits.maxBoatsPerUser} boat${limits.maxBoatsPerUser !== 1 ? 's' : ''} for the ${getReleaseType()} release.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: limits.maxBoatsPerUser,
  };
}

/**
 * Check if a user can create another journey
 */
export async function canCreateJourney(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();

  // Count journeys owned by this user (via their boats)
  const { data, error } = await supabase
    .from('journeys')
    .select('id, boats!inner(owner_id)')
    .eq('boats.owner_id', userId);

  if (error) {
    console.error('Error checking journey count:', error);
    return {
      allowed: false,
      current: 0,
      limit: limits.maxJourneysPerUser,
      message: 'Failed to check journey limit',
    };
  }

  const currentCount = data?.length || 0;

  if (currentCount >= limits.maxJourneysPerUser) {
    return {
      allowed: false,
      current: currentCount,
      limit: limits.maxJourneysPerUser,
      message: `You have reached the maximum of ${limits.maxJourneysPerUser} journey${limits.maxJourneysPerUser !== 1 ? 's' : ''} for the ${getReleaseType()} release.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: limits.maxJourneysPerUser,
  };
}

/**
 * Check if a journey can have another leg
 */
export async function canCreateLeg(
  supabase: ReturnType<typeof createClient>,
  journeyId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();

  const { count, error } = await supabase
    .from('legs')
    .select('*', { count: 'exact', head: true })
    .eq('journey_id', journeyId);

  if (error) {
    console.error('Error checking leg count:', error);
    return {
      allowed: false,
      current: 0,
      limit: limits.maxLegsPerJourney,
      message: 'Failed to check leg limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limits.maxLegsPerJourney) {
    return {
      allowed: false,
      current: currentCount,
      limit: limits.maxLegsPerJourney,
      message: `This journey has reached the maximum of ${limits.maxLegsPerJourney} legs for the ${getReleaseType()} release.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: limits.maxLegsPerJourney,
  };
}

/**
 * Check if the system can accept another user registration
 */
export async function canRegisterUser(
  supabase: ReturnType<typeof createClient>
): Promise<LimitCheckResult> {
  const limits = getLimits();

  // Check if we're in production mode with unlimited users
  if (limits.maxRegisteredUsers === Infinity) {
    return {
      allowed: true,
      current: 0,
      limit: Infinity,
    };
  }

  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error checking user count:', error);
    return {
      allowed: false,
      current: 0,
      limit: limits.maxRegisteredUsers,
      message: 'Failed to check user registration limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limits.maxRegisteredUsers) {
    return {
      allowed: false,
      current: currentCount,
      limit: limits.maxRegisteredUsers,
      message: `We've reached the maximum number of users (${limits.maxRegisteredUsers}) for the ${getReleaseType()} release. Please check back later or join our waitlist.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: limits.maxRegisteredUsers,
  };
}

/**
 * Check if a leg can have another waypoint
 */
export async function canCreateWaypoint(
  supabase: ReturnType<typeof createClient>,
  legId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();

  const { count, error } = await supabase
    .from('waypoints')
    .select('*', { count: 'exact', head: true })
    .eq('leg_id', legId);

  if (error) {
    console.error('Error checking waypoint count:', error);
    return {
      allowed: false,
      current: 0,
      limit: limits.maxWaypointsPerLeg,
      message: 'Failed to check waypoint limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limits.maxWaypointsPerLeg) {
    return {
      allowed: false,
      current: currentCount,
      limit: limits.maxWaypointsPerLeg,
      message: `This leg has reached the maximum of ${limits.maxWaypointsPerLeg} waypoints for the ${getReleaseType()} release.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: limits.maxWaypointsPerLeg,
  };
}

/**
 * Get user's current usage statistics
 */
export async function getUserUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<UserUsage> {
  const [boatResult, journeyResult] = await Promise.all([
    supabase
      .from('boats')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId),
    supabase
      .from('journeys')
      .select('id, boats!inner(owner_id)')
      .eq('boats.owner_id', userId),
  ]);

  return {
    boatCount: boatResult.count || 0,
    journeyCount: journeyResult.data?.length || 0,
  };
}

/**
 * Get journey's current usage statistics
 */
export async function getJourneyUsage(
  supabase: ReturnType<typeof createClient>,
  journeyId: string
): Promise<JourneyUsage> {
  const { count } = await supabase
    .from('legs')
    .select('*', { count: 'exact', head: true })
    .eq('journey_id', journeyId);

  return {
    legCount: count || 0,
  };
}

/**
 * Get system-wide usage statistics
 */
export async function getSystemUsage(
  supabase: ReturnType<typeof createClient>
): Promise<SystemUsage> {
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  return {
    totalUsers: count || 0,
  };
}
