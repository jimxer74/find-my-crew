'use client';

import { AIPendingAction } from '@/app/lib/ai/assistant/types';
import React, { ReactElement } from 'react';

interface ActionConfirmationProps {
  action: AIPendingAction;
  onApprove: (value?: string) => void;
  onReject: () => void;
  onRedirectToProfile: (action: AIPendingAction) => void; // New prop
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

export function ActionConfirmation({ action, onApprove, onReject, onRedirectToProfile }: ActionConfirmationProps) {
  const label = ACTION_LABELS[action.action_type] || action.action_type;
  const icon = ACTION_ICONS[action.action_type] || (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const [inputValue, setInputValue] = React.useState<string>('');

  const handleApprove = () => {
    console.log('Approve button clicked for action:', action.id);
    onApprove(action.action_type === 'suggest_profile_update_user_description' ? inputValue : undefined);
  };

  const handleReject = () => {
    console.log('Reject button clicked for action:', action.id);
    onReject();
  };

  const handleRedirectToProfile = () => {
    console.log('Redirect to profile clicked for action:', action.id, 'type:', action.action_type);
    console.log('onRedirectToProfile function:', onRedirectToProfile);
    onRedirectToProfile(action);
  };

  // Special handling for profile update actions - redirect to profile page
  if (PROFILE_UPDATE_ACTIONS.includes(action.action_type)) {
    console.log('Rendering profile update action UI for:', action.action_type);
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{label}</span>
              <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                Pending
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {action.explanation}
            </p>

            {/* AI suggestion context */}
            {PROFILE_UPDATE_ACTIONS.includes(action.action_type) && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-700">
                  {ACTION_TO_PROFILE_MAPPING[action.action_type]?.highlightText || 'Update this field in your profile'}
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRedirectToProfile}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Update in Profile
              </button>
              <button
                onClick={handleReject}
                className="px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent text-foreground rounded transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Special handling for suggest_profile_update_user_description action with input collection
  if (action.action_type === 'suggest_profile_update_user_description') {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{label}</span>
              <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                Pending
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {action.explanation}
            </p>

            {/* Text input field for user description */}
            <div className="mt-3">
              <label htmlFor={`description-input-${action.id}`} className="block text-xs text-muted-foreground mb-1">
                New Description
              </label>
              <textarea
                id={`description-input-${action.id}`}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter your new description..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleApprove}
                disabled={!inputValue.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
              <button
                onClick={handleReject}
                className="px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent text-foreground rounded transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
              Pending
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {action.explanation}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleApprove}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Approve
            </button>
            <button
              onClick={handleReject}
              className="px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent text-foreground rounded transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
