/**
 * Notification Service
 *
 * Core service for managing in-app notifications.
 * Provides CRUD operations for notifications and helper functions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  NotificationType,
  type Notification,
  type CreateNotificationPayload,
  type GetNotificationsParams,
  type NotificationsResponse,
  type NotificationMetadata,
} from './types';
import {
  sendRegistrationApprovedEmail,
  sendRegistrationDeniedEmail,
  sendNewRegistrationEmail,
} from './email';

// ============================================================================
// Email Helper
// ============================================================================

/**
 * Gets a user's email from the profiles table.
 * Email is synced from auth.users via database trigger.
 * This approach uses RLS and doesn't require service role key.
 */
async function getUserEmailFromProfiles(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[NotificationService] Error getting user email from profiles:', error);
      return null;
    }

    return data?.email || null;
  } catch (err) {
    console.error('[NotificationService] Failed to get user email:', err);
    return null;
  }
}

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Creates a new notification for a user
 */
export async function createNotification(
  supabase: SupabaseClient,
  payload: CreateNotificationPayload
): Promise<{ notification: Notification | null; error: string | null }> {
  console.log('[NotificationService] Creating notification:', {
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
  });

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      message: payload.message || null,
      link: payload.link || null,
      metadata: payload.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[NotificationService] Error creating notification:', {
      error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload,
    });
    return { notification: null, error: error.message };
  }

  console.log('[NotificationService] Notification created successfully:', data?.id);
  return { notification: data as Notification, error: null };
}

/**
 * Gets notifications for a user with pagination
 */
export async function getNotifications(
  supabase: SupabaseClient,
  userId: string,
  params: GetNotificationsParams = {}
): Promise<NotificationsResponse> {
  const { limit = 20, offset = 0, unread_only = false } = params;

  try {
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread_only) {
      query = query.eq('read', false);
    }

    const { data, error, count } = await query;

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[NotificationService] Notifications table does not exist yet. Run the migration.');
        return { notifications: [], total: 0, unread_count: 0 };
      }
      console.error('[NotificationService] Error fetching notifications:', error);
      return { notifications: [], total: 0, unread_count: 0 };
    }

    // Get unread count separately
    const { count: unreadCount, error: unreadError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (unreadError) {
      console.error('[NotificationService] Error fetching unread count:', unreadError);
    }

    return {
      notifications: (data as Notification[]) || [],
      total: count || 0,
      unread_count: unreadCount || 0,
    };
  } catch (err) {
    console.error('[NotificationService] Unexpected error:', err);
    return { notifications: [], total: 0, unread_count: 0 };
  }
}

/**
 * Gets the count of unread notifications for a user
 */
export async function getUnreadCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[NotificationService] Notifications table does not exist yet.');
        return 0;
      }
      console.error('[NotificationService] Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('[NotificationService] Unexpected error getting unread count:', err);
    return 0;
  }
}

/**
 * Marks a single notification as read
 */
export async function markAsRead(
  supabase: SupabaseClient,
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('[NotificationService] Error marking notification as read:', error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Marks all notifications as read for a user
 */
export async function markAllAsRead(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; error: string | null; count: number }> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
    .select('id');

  if (error) {
    console.error('[NotificationService] Error marking all notifications as read:', error);
    return { success: false, error: error.message, count: 0 };
  }

  return { success: true, error: null, count: data?.length || 0 };
}

/**
 * Deletes a notification
 */
export async function deleteNotification(
  supabase: SupabaseClient,
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('[NotificationService] Error deleting notification:', error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// ============================================================================
// Notification Creation Helpers
// ============================================================================

/**
 * Creates a registration approved notification and sends email
 */
export async function notifyRegistrationApproved(
  supabase: SupabaseClient,
  crewUserId: string,
  journeyId: string,
  journeyName: string,
  ownerName: string
): Promise<{ notification: Notification | null; error: string | null }> {
  // Create in-app notification
  const result = await createNotification(supabase, {
    user_id: crewUserId,
    type: NotificationType.REGISTRATION_APPROVED,
    title: 'Registration Approved',
    message: `Your registration for "${journeyName}" has been approved by ${ownerName}. Welcome aboard!`,
    link: `/journeys/${journeyId}`,
    metadata: {
      journey_id: journeyId,
      journey_name: journeyName,
      owner_name: ownerName,
    },
  });

  // Send email notification (non-blocking)
  try {
    const userEmail = await getUserEmailFromProfiles(crewUserId);
    if (userEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const journeyLink = `${appUrl}/journeys/${journeyId}`;
      const emailResult = await sendRegistrationApprovedEmail(
        supabase,
        userEmail,
        crewUserId,
        journeyName,
        ownerName,
        journeyLink
      );
      if (emailResult.error) {
        console.error('[NotificationService] Failed to send approval email:', emailResult.error);
      } else {
        console.log('[NotificationService] Approval email sent to:', userEmail);
      }
    } else {
      console.warn('[NotificationService] Could not get email for user:', crewUserId);
    }
  } catch (emailErr) {
    console.error('[NotificationService] Error sending approval email:', emailErr);
  }

  return result;
}

/**
 * Creates a registration denied notification and sends email
 */
export async function notifyRegistrationDenied(
  supabase: SupabaseClient,
  crewUserId: string,
  journeyId: string,
  journeyName: string,
  ownerName: string,
  reason?: string
): Promise<{ notification: Notification | null; error: string | null }> {
  const message = reason
    ? `Your registration for "${journeyName}" was not approved. Reason: ${reason}`
    : `Your registration for "${journeyName}" was not approved by ${ownerName}.`;

  // Create in-app notification
  const result = await createNotification(supabase, {
    user_id: crewUserId,
    type: NotificationType.REGISTRATION_DENIED,
    title: 'Registration Not Approved',
    message,
    link: '/journeys',
    metadata: {
      journey_id: journeyId,
      journey_name: journeyName,
      owner_name: ownerName,
      reason,
    },
  });

  // Send email notification (non-blocking)
  try {
    const userEmail = await getUserEmailFromProfiles(crewUserId);
    if (userEmail) {
      const emailResult = await sendRegistrationDeniedEmail(
        supabase,
        userEmail,
        crewUserId,
        journeyName,
        ownerName,
        reason
      );
      if (emailResult.error) {
        console.error('[NotificationService] Failed to send denial email:', emailResult.error);
      } else {
        console.log('[NotificationService] Denial email sent to:', userEmail);
      }
    } else {
      console.warn('[NotificationService] Could not get email for user:', crewUserId);
    }
  } catch (emailErr) {
    console.error('[NotificationService] Error sending denial email:', emailErr);
  }

  return result;
}

/**
 * Creates a new registration notification for the journey owner and sends email
 */
export async function notifyNewRegistration(
  supabase: SupabaseClient,
  ownerUserId: string,
  registrationId: string,
  journeyId: string,
  journeyName: string,
  crewName: string,
  crewId: string
): Promise<{ notification: Notification | null; error: string | null }> {
  // Create in-app notification
  const result = await createNotification(supabase, {
    user_id: ownerUserId,
    type: NotificationType.NEW_REGISTRATION,
    title: 'New Crew Registration',
    message: `${crewName} has registered for "${journeyName}". Review their application now.`,
    link: `/owner/registrations/${registrationId}`,
    metadata: {
      registration_id: registrationId,
      journey_id: journeyId,
      journey_name: journeyName,
      crew_name: crewName,
      crew_id: crewId,
    },
  });

  // Send email notification (non-blocking)
  try {
    const ownerEmail = await getUserEmailFromProfiles(ownerUserId);
    if (ownerEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const registrationLink = `${appUrl}/owner/registrations?registration=${registrationId}`;
      const emailResult = await sendNewRegistrationEmail(
        supabase,
        ownerEmail,
        ownerUserId,
        crewName,
        journeyName,
        registrationLink
      );
      if (emailResult.error) {
        console.error('[NotificationService] Failed to send new registration email:', emailResult.error);
      } else {
        console.log('[NotificationService] New registration email sent to:', ownerEmail);
      }
    } else {
      console.warn('[NotificationService] Could not get email for owner:', ownerUserId);
    }
  } catch (emailErr) {
    console.error('[NotificationService] Error sending new registration email:', emailErr);
  }

  return result;
}

/**
 * Creates a journey updated notification for all approved crew
 */
export async function notifyJourneyUpdated(
  supabase: SupabaseClient,
  crewUserId: string,
  journeyId: string,
  journeyName: string,
  changes: string[]
): Promise<{ notification: Notification | null; error: string | null }> {
  const changesText = changes.length > 0 ? changes.join(', ') : 'details';

  return createNotification(supabase, {
    user_id: crewUserId,
    type: NotificationType.JOURNEY_UPDATED,
    title: 'Journey Updated',
    message: `"${journeyName}" has been updated: ${changesText}`,
    link: `/journeys/${journeyId}`,
    metadata: {
      journey_id: journeyId,
      journey_name: journeyName,
      changes,
    },
  });
}

/**
 * Creates a leg updated notification for all approved crew
 */
export async function notifyLegUpdated(
  supabase: SupabaseClient,
  crewUserId: string,
  legId: string,
  legName: string,
  journeyId: string,
  journeyName: string,
  changes: string[]
): Promise<{ notification: Notification | null; error: string | null }> {
  const changesText = changes.length > 0 ? changes.join(', ') : 'details';

  return createNotification(supabase, {
    user_id: crewUserId,
    type: NotificationType.LEG_UPDATED,
    title: 'Leg Updated',
    message: `"${legName}" in "${journeyName}" has been updated: ${changesText}`,
    link: `/journeys/${journeyId}?leg=${legId}`,
    metadata: {
      leg_id: legId,
      leg_name: legName,
      journey_id: journeyId,
      journey_name: journeyName,
      changes,
    },
  });
}

/**
 * Creates a profile completion reminder notification
 */
export async function notifyProfileReminder(
  supabase: SupabaseClient,
  userId: string,
  missingFields: string[],
  completionPercentage: number
): Promise<{ notification: Notification | null; error: string | null }> {
  const fieldsText = missingFields.slice(0, 3).join(', ');
  const moreText = missingFields.length > 3 ? ` and ${missingFields.length - 3} more` : '';

  return createNotification(supabase, {
    user_id: userId,
    type: NotificationType.PROFILE_REMINDER,
    title: 'Complete Your Profile',
    message: `Your profile is ${completionPercentage}% complete. Add ${fieldsText}${moreText} to improve your chances of being approved.`,
    link: '/profile',
    metadata: {
      missing_fields: missingFields,
      completion_percentage: completionPercentage,
    },
  });
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Notifies all approved crew members of a journey about an update
 */
export async function notifyAllApprovedCrew(
  supabase: SupabaseClient,
  journeyId: string,
  notificationFn: (crewUserId: string) => Promise<{ notification: Notification | null; error: string | null }>
): Promise<{ success: boolean; notifiedCount: number; errors: string[] }> {
  // Get all approved crew for this journey
  const { data: registrations, error } = await supabase
    .from('registrations')
    .select(`
      user_id,
      legs!inner (
        journey_id
      )
    `)
    .eq('status', 'Approved')
    .eq('legs.journey_id', journeyId);

  if (error) {
    console.error('[NotificationService] Error fetching approved crew:', error);
    return { success: false, notifiedCount: 0, errors: [error.message] };
  }

  if (!registrations || registrations.length === 0) {
    return { success: true, notifiedCount: 0, errors: [] };
  }

  // Get unique user IDs
  const uniqueUserIds = [...new Set(registrations.map(r => r.user_id))];

  const errors: string[] = [];
  let notifiedCount = 0;

  for (const userId of uniqueUserIds) {
    const result = await notificationFn(userId);
    if (result.error) {
      errors.push(`Failed to notify user ${userId}: ${result.error}`);
    } else {
      notifiedCount++;
    }
  }

  return {
    success: errors.length === 0,
    notifiedCount,
    errors,
  };
}
