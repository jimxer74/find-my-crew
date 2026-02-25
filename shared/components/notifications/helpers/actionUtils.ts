'use client';

import { Notification, NotificationType, type NotificationMetadata } from '@shared/lib/notifications';
import { type AIPendingAction } from '@shared/ai/assistant/types';

// Action labels matching those in ActionConfirmation.tsx
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
 * Converts an AIPendingAction to Notification format for use with ActionConfirmation component
 */
export function convertActionToNotification(action: AIPendingAction): Notification {
  return {
    id: action.id,
    user_id: '', // Not used in NotificationCenter context
    type: NotificationType.AI_PENDING_ACTION,
    title: formatActionType(action.action_type),
    message: action.explanation || 'Please review this AI-generated action',
    link: null, // Will be handled by ActionConfirmation handlers
    read: false,
    metadata: {
      action_id: action.id,
      action_type: action.action_type,
      action_explanation: action.explanation,
      input_required: !!action.input_type,
      input_type: action.input_type,
      input_options: action.input_options,
      input_prompt: action.input_prompt,
      profile_section: action.profile_section,
      profile_field: action.profile_field,
      ai_highlight_text: action.ai_highlight_text,
    } as NotificationMetadata,
    created_at: action.created_at,
  };
}

/**
 * Formats action type string into readable label
 */
export function formatActionType(type: string): string {
  const label = ACTION_LABELS[type];
  if (label) {
    return label;
  }

  // Fallback for unknown action types: convert snake_case to Title Case
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}