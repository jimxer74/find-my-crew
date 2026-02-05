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
  AI_PENDING_ACTION = 'ai_pending_action',
  AI_ACTION_APPROVED = 'ai_action_approved',
  FEEDBACK_STATUS_CHANGED = 'feedback_status_changed',
  FEEDBACK_MILESTONE = 'feedback_milestone',
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
  // Feedback-related metadata
  feedback_id?: string;
  feedback_title?: string;
  old_status?: string;
  new_status?: string;
  status_note?: string;
  milestone?: number;
  // AI Pending Action specific metadata
  action_id?: string;
  action_type?: string;
  action_payload?: Record<string, unknown>;
  action_explanation?: string;
  input_required?: boolean;
  input_type?: 'text' | 'text_array' | 'select';
  input_options?: string[];
  input_prompt?: string;
  profile_section?: 'personal' | 'preferences' | 'experience' | 'notifications';
  profile_field?: string;
  ai_highlight_text?: string;
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

/**
 * Type guard for checking if a notification is an AI pending action
 */
export function isAIPendingAction(notification: Notification): boolean {
  return notification.type === NotificationType.AI_PENDING_ACTION;
}

/**
 * Type guard for checking if metadata contains AI pending action data
 */
export function hasAIPendingActionMetadata(metadata: NotificationMetadata): boolean {
  return !!metadata.action_id && !!metadata.action_type;
}

/**
 * Type guard for checking if input is required for an AI pending action
 */
export function requiresInput(metadata: NotificationMetadata): boolean {
  return metadata.input_required === true;
}
