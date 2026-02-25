/**
 * Notifications Module
 *
 * Centralized exports for the notification system.
 *
 * Usage:
 * ```ts
 * import {
 *   createNotification,
 *   notifyRegistrationApproved,
 *   sendRegistrationApprovedEmail,
 *   NotificationType,
 * } from '@shared/lib/notifications';
 * ```
 */

// Types
export * from './types';

// Core notification service
export {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  notifyRegistrationApproved,
  notifyRegistrationDenied,
  notifyNewRegistration,
  notifyJourneyUpdated,
  notifyLegUpdated,
  notifyProfileReminder,
  notifyAllApprovedCrew,
  notifyFeedbackStatusChanged,
  notifyFeedbackMilestone,
  notifyPendingRegistration,
} from './service';

// Email service
export {
  getEmailPreferences,
  shouldSendEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationDeniedEmail,
  sendNewRegistrationEmail,
  sendReviewNeededEmail,
  sendJourneyUpdatedEmail,
  sendProfileReminderEmail,
  getUserEmail,
} from './email';
