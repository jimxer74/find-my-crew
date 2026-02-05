/**
 * Action Utility Functions
 *
 * Helper functions for working with AI pending actions and notifications.
 * These utilities provide conversion between AIPendingAction and Notification formats
 * and formatting of action types to human-readable labels.
 */

import { Notification, NotificationType, NotificationMetadata } from '@/app/lib/notifications';
import { AIPendingAction, ActionType } from '@/app/lib/ai/assistant/types';

// Action labels mapping - matches ActionConfirmation component
const ACTION_LABELS: Record<string, string> = {
  register_for_leg: 'Register for Leg',
  update_profile: 'Update Profile',
  create_journey: 'Create Journey',
  approve_registration: 'Approve Crew',
  reject_registration: 'Reject Crew',
  suggest_profile_update_user_description: 'Update User Description',
  update_profile_user_description: 'Update User Description',
  update_profile_certifications: 'Update Certifications',
  update_profile_risk_level: 'Update Risk Level',
  update_profile_sailing_preferences: 'Update Sailing Preferences',
  update_profile_skills: 'Update Skills',
  refine_skills: 'Refine Skills',
};

/**
 * Converts an AIPendingAction to a Notification format for ActionConfirmation
 *
 * @param action - The AIPendingAction to convert
 * @returns A Notification object with the action embedded in metadata
 */
export function convertActionToNotification(action: AIPendingAction): Notification {
  // Extract action metadata from the action object
  const actionMetadata: NotificationMetadata = {
    action_id: action.id,
    action_type: action.action_type,
    action_payload: action.action_payload,
    action_explanation: action.explanation,
    input_required: action.awaiting_user_input || false,
    input_type: action.input_type,
    input_options: action.input_options,
    input_prompt: action.input_prompt,
    profile_section: action.profile_section,
    profile_field: action.profile_field,
    ai_highlight_text: action.ai_highlight_text,
  };

  // Create the notification with AI_PENDING_ACTION type
  const notification: Notification = {
    id: action.id,
    user_id: action.user_id,
    type: NotificationType.AI_PENDING_ACTION,
    title: formatActionType(action.action_type),
    message: action.explanation,
    link: null,
    read: false,
    metadata: actionMetadata,
    created_at: action.created_at,
  };

  return notification;
}

/**
 * Formats an action type string to a human-readable label
 *
 * @param type - The action type string (e.g., 'update_profile_skills')
 * @returns A human-readable label (e.g., 'Update Skills')
 */
export function formatActionType(type: string): string {
  // Check if we have a specific label for this action type
  if (type in ACTION_LABELS) {
    return ACTION_LABELS[type];
  }

  // Fallback for unknown action types - convert snake_case to Title Case
  // and handle common patterns
  if (typeof type === 'string') {
    return type
      .split('_')
      .map(word => {
        // Handle special cases
        if (word === 'ai') return 'AI';
        if (word === 'id') return 'ID';
        if (word === 'url') return 'URL';
        if (word === 'http') return 'HTTP';
        if (word === 'https') return 'HTTPS';

        // Capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space between camelCase letters
  }

  // Default fallback
  return 'Unknown Action';
}

/**
 * Type guard to check if a string is a valid ActionType
 *
 * @param value - The string to check
 * @returns True if the string is a valid ActionType
 */
export function isValidActionType(value: string): value is ActionType {
  const validActionTypes = Object.keys(ACTION_LABELS);
  return validActionTypes.includes(value);
}

/**
 * Gets the appropriate icon element for an action type
 *
 * @param type - The action type string
 * @returns JSX element for the icon, or null if not found
 */
export function getActionIcon(type: string): React.ReactElement | null {
  // This function returns SVG icons as JSX elements for use in React components
  // Icons are based on Heroicons library
  switch (type) {
    case 'register_for_leg':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" key="register_for_leg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );
    case 'update_profile':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" key="update_profile">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'create_journey':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" key="create_journey">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      );
    case 'approve_registration':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" key="approve_registration">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'reject_registration':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" key="reject_registration">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'suggest_profile_update_user_description':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" key="suggest_profile_update_user_description">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" key="default">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

/**
 * Checks if an action requires user input
 *
 * @param metadata - The notification metadata containing action information
 * @returns True if the action requires input
 */
export function requiresInput(metadata: NotificationMetadata): boolean {
  return metadata.input_required === true;
}

/**
 * Checks if an action is a profile update action that should redirect to profile page
 *
 * @param actionType - The action type string
 * @returns True if the action should redirect to profile
 */
export function isProfileUpdateAction(actionType: string): boolean {
  const profileUpdateActions = [
    'suggest_profile_update_user_description',
    'update_profile_user_description',
    'update_profile_certifications',
    'update_profile_risk_level',
    'update_profile_sailing_preferences',
    'update_profile_skills',
    'refine_skills',
  ];

  return profileUpdateActions.includes(actionType);
}

/**
 * Gets profile mapping for an action type
 *
 * @param actionType - The action type string
 * @returns Object with section, field, and highlight text, or null if not a profile action
 */
export function getProfileMapping(actionType: string): { section: string; field: string; highlightText: string } | null {
  const profileMapping: Record<string, { section: string; field: string; highlightText: string }> = {
    'suggest_profile_update_user_description': {
      section: 'personal',
      field: 'user_description',
      highlightText: 'AI suggests updating your user description to improve match rate',
    },
    'update_profile_user_description': {
      section: 'personal',
      field: 'user_description',
      highlightText: 'Update your user description to better represent yourself',
    },
    'update_profile_certifications': {
      section: 'experience',
      field: 'certifications',
      highlightText: 'Add or update your sailing certifications',
    },
    'update_profile_risk_level': {
      section: 'preferences',
      field: 'risk_level',
      highlightText: 'Update your risk level preferences for better matching',
    },
    'update_profile_sailing_preferences': {
      section: 'preferences',
      field: 'sailing_preferences',
      highlightText: 'Update your sailing preferences to find better matches',
    },
    'update_profile_skills': {
      section: 'experience',
      field: 'skills',
      highlightText: 'Add or update your sailing skills',
    },
    'refine_skills': {
      section: 'experience',
      field: 'skills',
      highlightText: 'Refine your skills to improve your profile completeness',
    },
  };

  return profileMapping[actionType] || null;
}