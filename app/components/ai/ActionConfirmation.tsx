'use client';

import { AIPendingAction } from '@/app/lib/ai/assistant/types';
import { JSX } from 'react';

interface ActionConfirmationProps {
  action: AIPendingAction;
  onApprove: () => void;
  onReject: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  register_for_leg: 'Register for Leg',
  update_profile: 'Update Profile',
  create_journey: 'Create Journey',
  approve_registration: 'Approve Crew',
  reject_registration: 'Reject Crew',
};

const ACTION_ICONS: Record<string, JSX.Element> = {
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
};

export function ActionConfirmation({ action, onApprove, onReject }: ActionConfirmationProps) {
  const label = ACTION_LABELS[action.action_type] || action.action_type;
  const icon = ACTION_ICONS[action.action_type] || (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

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
              onClick={onApprove}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Approve
            </button>
            <button
              onClick={onReject}
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
