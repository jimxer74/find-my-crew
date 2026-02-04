'use client';

import { useState } from 'react';
import { AIPendingAction } from '@/app/lib/ai/assistant/types';

interface TextInputModalProps {
  action: AIPendingAction;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function TextInputModal({ action, onSubmit, onCancel }: TextInputModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!value.trim()) {
      setError('This field is required.');
      return;
    }

    // Field-specific validation
    if (action.action_type === 'update_profile_user_description' && value.length < 10) {
      setError('User description should be at least 10 characters long.');
      return;
    }

    if (action.action_type === 'update_profile_certifications' && value.length < 3) {
      setError('Certifications should be at least 3 characters long.');
      return;
    }

    if (action.action_type === 'update_profile_sailing_preferences' && value.length < 5) {
      setError('Sailing preferences should be at least 5 characters long.');
      return;
    }

    onSubmit(value);
  };

  const getPlaceholder = () => {
    switch (action.action_type) {
      case 'update_profile_user_description':
        return 'Tell us about your sailing experience and what you\'re looking for...';
      case 'update_profile_certifications':
        return 'List your sailing certifications (e.g., ASA 101, USCG License)...';
      case 'update_profile_sailing_preferences':
        return 'Describe your sailing preferences and goals...';
      default:
        return 'Enter your response here...';
    }
  };

  const getFieldLabel = () => {
    switch (action.action_type) {
      case 'update_profile_user_description':
        return 'User Description';
      case 'update_profile_certifications':
        return 'Certifications';
      case 'update_profile_sailing_preferences':
        return 'Sailing Preferences';
      default:
        return 'Input';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Update {getFieldLabel()}
              </h3>
              <p className="text-sm text-muted-foreground">
                {action.input_prompt || 'Please provide the new value for this field.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {getFieldLabel()}
              </label>
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[120px] resize-none"
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary hover:opacity-90 rounded-lg transition-colors"
              >
                Update Profile
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}