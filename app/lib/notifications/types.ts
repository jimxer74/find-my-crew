/**
 * Notification Types and Interfaces
 *
 * Defines the core types for the notification system including
 * notification types, database models, and API payloads.
 */

// ============================================================================
// Notification Type Enum
// ============================================================================

export enum NotificationType {
  REGISTRATION_APPROVED = 'registration_approved',
  REGISTRATION_DENIED = 'registration_denied',
  NEW_REGISTRATION = 'new_registration',
  JOURNEY_UPDATED = 'journey_updated',
  LEG_UPDATED = 'leg_updated',
  PROFILE_REMINDER = 'profile_reminder',
  AI_AUTO_APPROVED = 'ai_auto_approved',
  AI_REVIEW_NEEDED = 'ai_review_needed',
}

// ============================================================================
// Database Models
// ============================================================================

/**
 * Notification record as stored in the database
 */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  metadata: NotificationMetadata;
  created_at: string;
}

/**
 * Metadata stored with notifications for additional context
 */
export interface NotificationMetadata {
  journey_id?: string;
  journey_name?: string;
  leg_id?: string;
  leg_name?: string;
  registration_id?: string;
  crew_name?: string;
  crew_id?: string;
  owner_name?: string;
  owner_id?: string;
  reason?: string;
  changes?: string[];
  // Sender information for displaying avatar
  sender_id?: string;
  sender_name?: string;
  sender_avatar_url?: string;
  [key: string]: unknown;
}

/**
 * Email preferences record as stored in the database
 */
export interface EmailPreferences {
  user_id: string;
  registration_updates: boolean;
  journey_updates: boolean;
  profile_reminders: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Payload for creating a new notification
 */
export interface CreateNotificationPayload {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  metadata?: NotificationMetadata;
}

/**
 * Query parameters for fetching notifications
 */
export interface GetNotificationsParams {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
}

/**
 * Response for paginated notifications list
 */
export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

/**
 * Response for unread count endpoint
 */
export interface UnreadCountResponse {
  count: number;
}

// ============================================================================
// Notification Templates
// ============================================================================

/**
 * Template data for registration approved notification
 */
export interface RegistrationApprovedData {
  journey_id: string;
  journey_name: string;
  owner_name: string;
}

/**
 * Template data for registration denied notification
 */
export interface RegistrationDeniedData {
  journey_id: string;
  journey_name: string;
  owner_name: string;
  reason?: string;
}

/**
 * Template data for new registration notification (sent to owner)
 */
export interface NewRegistrationData {
  registration_id: string;
  journey_id: string;
  journey_name: string;
  crew_name: string;
  crew_id: string;
}

/**
 * Template data for journey updated notification
 */
export interface JourneyUpdatedData {
  journey_id: string;
  journey_name: string;
  changes: string[];
}

/**
 * Template data for leg updated notification
 */
export interface LegUpdatedData {
  leg_id: string;
  leg_name: string;
  journey_id: string;
  journey_name: string;
  changes: string[];
}

/**
 * Template data for profile reminder notification
 */
export interface ProfileReminderData {
  missing_fields: string[];
  completion_percentage: number;
}

// ============================================================================
// Helper Type Guards
// ============================================================================

export function isNotificationType(value: string): value is NotificationType {
  return Object.values(NotificationType).includes(value as NotificationType);
}
