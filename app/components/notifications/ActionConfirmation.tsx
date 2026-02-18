'use client';

import { Notification } from '@/app/lib/notifications';
import { isAIPendingAction, hasAIPendingActionMetadata, requiresInput } from '@/app/lib/notifications/types';
import React, { ReactElement, useState } from 'react';
import { ActionModal } from './ActionModal';

interface ActionConfirmationProps {
  notification: Notification;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  onRedirectToProfile: (actionId: string, section: string, field: string) => void;
  useModal?: boolean; // Whether to use modal rendering for input actions
}

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

// Profile update actions that should redirect to profile page
const PROFILE_UPDATE_ACTIONS = [
  'suggest_profile_update_user_description',
  'update_profile_user_description',
  'update_profile_certifications',
  'update_profile_risk_level',
  'update_profile_sailing_preferences',
  'update_profile_skills',
  'refine_skills'
];

// Action to profile mapping for metadata
const ACTION_TO_PROFILE_MAPPING: Record<string, { section: string; field: string; highlightText: string }> = {
  'suggest_profile_update_user_description': {
    section: 'personal',
    field: 'user_description',
    highlightText: 'AI suggests updating your user description to improve match rate'
  },
  'update_profile_user_description': {
    section: 'personal',
    field: 'user_description',
    highlightText: 'Update your user description to better represent yourself'
  },
  'update_profile_certifications': {
    section: 'experience',
    field: 'certifications',
    highlightText: 'Add or update your sailing certifications'
  },
  'update_profile_risk_level': {
    section: 'preferences',
    field: 'risk_level',
    highlightText: 'Update your risk level preferences for better matching'
  },
  'update_profile_sailing_preferences': {
    section: 'preferences',
    field: 'sailing_preferences',
    highlightText: 'Update your sailing preferences to find better matches'
  },
  'update_profile_skills': {
    section: 'experience',
    field: 'skills',
    highlightText: 'Add or update your sailing skills'
  },
  'refine_skills': {
    section: 'experience',
    field: 'skills',
    highlightText: 'Refine your skills to improve your profile completeness'
  },
};

const ACTION_ICONS: Record<string, ReactElement> = {
  register_for_leg: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  update_profile: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  create_journey: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  approve_registration: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reject_registration: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  suggest_profile_update_user_description: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

export function ActionConfirmation({ notification, onApprove, onReject, onRedirectToProfile, useModal = true }: ActionConfirmationProps) {
  const [showModal, setShowModal] = useState(false);

  const actionType = notification.metadata.action_type!;
  const actionId = notification.metadata.action_id!;
  const label = ACTION_LABELS[actionType] || actionType;
  const icon = ACTION_ICONS[actionType] || (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );


  const handleApprove = () => {
    logger.debug('Approve button clicked for action:', actionId);
    onApprove(actionId);
  };

  const handleReject = () => {
    logger.debug('Reject button clicked for action:', actionId);
    onReject(actionId);
  };

  const handleRedirectToProfile = () => {
    logger.debug('[ActionConfirmation] 📊 Redirect to profile clicked for action:', actionId, 'type:', actionType);
    logger.debug('[ActionConfirmation] 📊 actionId parameter:', actionId);
    const mapping = ACTION_TO_PROFILE_MAPPING[actionType];
    logger.debug('[ActionConfirmation] 📊 Mapping lookup for actionType:', actionType);
    logger.debug('[ActionConfirmation] 📊 Found mapping:', mapping);
    if (mapping) {
      logger.debug('[ActionConfirmation] 📊 Calling onRedirectToProfile with:', { actionId, section: mapping.section, field: mapping.field });
      onRedirectToProfile(actionId, mapping.section, mapping.field);
    } else {
      logger.warn('[ActionConfirmation] 📊 No mapping found for actionType:', actionType);
    }
  };

  const handleModalSubmit = (value: string | string[]) => {
    logger.debug('Input submitted for action:', actionId, 'value:', value);
    onApprove(actionId);
    setShowModal(false);
  };

  // Special handling for profile update actions - redirect to profile page
  if (PROFILE_UPDATE_ACTIONS.includes(actionType)) {
    return (
      <div className="bg-card border-t border-border p-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {/*{icon}*/}
            <svg
        className="w-5 h-5 text-foreground"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {notification.metadata.action_explanation || notification.message}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRedirectToProfile}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors cursor-pointer"
              >
                Update in Profile
              </button>
              <button
                onClick={handleReject}
                className="px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent text-foreground rounded transition-colors cursor-pointer"
              >
                Mark as Completed
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}