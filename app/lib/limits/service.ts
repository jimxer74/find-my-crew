/**
 * Limits Service
 *
 * Provides functions to check various limits based on environment variables.
 * If a limit is not configured (env var not set), the check always passes.
 */

import { logger } from '../logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getLimits } from './config';
import { LimitCheckResult, UserUsage, JourneyUsage, SystemUsage, AIUsage } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

/**
 * Check if a user can create another boat
 */
export async function canCreateBoat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();
  const limit = limits.maxBoatsPerUser;

  // If no limit configured, allow
  if (limit === null) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    };
  }

  const { count, error } = await supabase
    .from('boats')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (error) {
    logger.error('Error checking boat count:', { error: error?.message || String(error) });
    return {
      allowed: false,
      current: 0,
      limit,
      message: 'Failed to check boat limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      current: currentCount,
      limit,
      message: `You have reached the maximum of ${limit} boat${limit !== 1 ? 's' : ''}.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit,
  };
}

/**
 * Check if a user can create another journey
 */
export async function canCreateJourney(
  supabase: AnySupabaseClient,
  userId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();
  const limit = limits.maxJourneysPerUser;

  // If no limit configured, allow
  if (limit === null) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    };
  }

  // Count journeys owned by this user (via their boats)
  const { data, error } = await supabase
    .from('journeys')
    .select('id, boats!inner(owner_id)')
    .eq('boats.owner_id', userId);

  if (error) {
    logger.error('Error checking journey count:', { error: error?.message || String(error) });
    return {
      allowed: false,
      current: 0,
      limit,
      message: 'Failed to check journey limit',
    };
  }

  const currentCount = data?.length || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      current: currentCount,
      limit,
      message: `You have reached the maximum of ${limit} journey${limit !== 1 ? 's' : ''}.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit,
  };
}

/**
 * Check if a journey can have another leg
 */
export async function canCreateLeg(
  supabase: AnySupabaseClient,
  journeyId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();
  const limit = limits.maxLegsPerJourney;

  // If no limit configured, allow
  if (limit === null) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    };
  }

  const { count, error } = await supabase
    .from('legs')
    .select('*', { count: 'exact', head: true })
    .eq('journey_id', journeyId);

  if (error) {
    logger.error('Error checking leg count:', { error: error?.message || String(error) });
    return {
      allowed: false,
      current: 0,
      limit,
      message: 'Failed to check leg limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      current: currentCount,
      limit,
      message: `This journey has reached the maximum of ${limit} leg${limit !== 1 ? 's' : ''}.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit,
  };
}

/**
 * Check if the system can accept another user registration
 */
export async function canRegisterUser(
  supabase: AnySupabaseClient
): Promise<LimitCheckResult> {
  const limits = getLimits();
  const limit = limits.maxRegisteredUsers;

  // If no limit configured, allow
  if (limit === null) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    };
  }

  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    logger.error('Error checking user count:', { error: error?.message || String(error) });
    return {
      allowed: false,
      current: 0,
      limit,
      message: 'Failed to check user registration limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      current: currentCount,
      limit,
      message: `We've reached the maximum number of users (${limit}). Please check back later or join our waitlist.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit,
  };
}

/**
 * Check if a leg can have another waypoint
 */
export async function canCreateWaypoint(
  supabase: AnySupabaseClient,
  legId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();
  const limit = limits.maxWaypointsPerLeg;

  // If no limit configured, allow
  if (limit === null) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    };
  }

  const { count, error } = await supabase
    .from('waypoints')
    .select('*', { count: 'exact', head: true })
    .eq('leg_id', legId);

  if (error) {
    logger.error('Error checking waypoint count:', { error: error?.message || String(error) });
    return {
      allowed: false,
      current: 0,
      limit,
      message: 'Failed to check waypoint limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      current: currentCount,
      limit,
      message: `This leg has reached the maximum of ${limit} waypoint${limit !== 1 ? 's' : ''}.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit,
  };
}

/**
 * Check if a user can send another AI message today
 */
export async function canSendAIMessage(
  supabase: AnySupabaseClient,
  userId: string
): Promise<LimitCheckResult> {
  const limits = getLimits();
  const limit = limits.maxAIMessagesPerDayPerUser;

  // If no limit configured, allow
  if (limit === null) {
    return {
      allowed: true,
      current: 0,
      limit: null,
    };
  }

  // Get the start of today (UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Count user messages sent today
  // Join ai_messages with ai_conversations to filter by user_id
  const { count, error } = await supabase
    .from('ai_messages')
    .select('id, ai_conversations!inner(user_id)', { count: 'exact', head: true })
    .eq('ai_conversations.user_id', userId)
    .eq('role', 'user')
    .gte('created_at', todayISO);

  if (error) {
    logger.error('Error checking AI message count:', { error: error?.message || String(error) });
    return {
      allowed: false,
      current: 0,
      limit,
      message: 'Failed to check AI message limit',
    };
  }

  const currentCount = count || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      current: currentCount,
      limit,
      message: `You have reached your daily limit of ${limit} AI assistant message${limit !== 1 ? 's' : ''}. Please try again tomorrow.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit,
  };
}

/**
 * Get user's AI usage for today
 */
export async function getAIUsage(
  supabase: AnySupabaseClient,
  userId: string
): Promise<AIUsage> {
  // Get the start of today (UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { count } = await supabase
    .from('ai_messages')
    .select('id, ai_conversations!inner(user_id)', { count: 'exact', head: true })
    .eq('ai_conversations.user_id', userId)
    .eq('role', 'user')
    .gte('created_at', todayISO);

  return {
    messagesUsedToday: count || 0,
  };
}

/**
 * Get user's current usage statistics
 */
export async function getUserUsage(
  supabase: AnySupabaseClient,
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
  supabase: AnySupabaseClient,
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
  supabase: AnySupabaseClient
): Promise<SystemUsage> {
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  return {
    totalUsers: count || 0,
  };
}
