'use client';

import { useState } from 'react';
import { Modal, Button } from '@/app/components/ui';
import { AIPendingAction } from '@shared/ai/assistant/types';

interface TextInputModalProps {
  action: AIPendingAction;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  isOpen?: boolean;
}

export function TextInputModal({ action, onSubmit, onCancel, isOpen = true }: TextInputModalProps) {
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
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={`Update ${getFieldLabel()}`}
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const formEvent = new Event('submit', { bubbles: true }) as any;
              handleSubmit(formEvent);
            }}
            className="flex-1"
          >
            Update Profile
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-4">
          {action.input_prompt || 'Please provide the new value for this field.'}
        </p>
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
    </Modal>
  );
}