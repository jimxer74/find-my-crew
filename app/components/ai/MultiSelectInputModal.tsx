'use client';

import { useState } from 'react';
import { Modal, Button, Checkbox } from '@/app/components/ui';
import { AIPendingAction } from '@/app/lib/ai/assistant/types';

interface MultiSelectInputModalProps {
  action: AIPendingAction;
  onSubmit: (value: string[]) => void;
  onCancel: () => void;
  isOpen?: boolean;
}

export function MultiSelectInputModal({ action, onSubmit, onCancel, isOpen = true }: MultiSelectInputModalProps) {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleToggle = (value: string) => {
    setSelectedValues(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (selectedValues.length === 0) {
      setError('Please select at least one option.');
      return;
    }

    onSubmit(selectedValues);
  };

  const getFieldLabel = () => {
    switch (action.action_type) {
      case 'update_profile_risk_level':
        return 'Risk Level';
      case 'update_profile_skills':
        return 'Skills';
      default:
        return 'Options';
    }
  };

  const getFieldDescription = () => {
    switch (action.action_type) {
      case 'update_profile_risk_level':
        return 'Select the sailing risk levels you are comfortable with.';
      case 'update_profile_skills':
        return 'Select your sailing skills and areas of expertise.';
      default:
        return 'Select the options that apply to you.';
    }
  };

  // Get available options - use input_options if provided, otherwise use defaults
  const getOptions = () => {
    if (action.input_options && action.input_options.length > 0) {
      return action.input_options;
    }

    // Default options based on field type
    switch (action.action_type) {
      case 'update_profile_risk_level':
        return ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
      case 'update_profile_skills':
        return [
          'Navigation',
          'Sailing',
          'Engine Maintenance',
          'Electronics',
          'Cooking',
          'First Aid',
          'Photography',
          'Teaching'
        ];
      default:
        return [];
    }
  };

  const options = getOptions();

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
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          {action.input_prompt || getFieldDescription()}
        </p>

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No options available.</p>
        ) : (
          <div className="grid gap-3 max-h-48 overflow-y-auto">
            {options.map((option) => (
              <Checkbox
                key={option}
                label={option}
                checked={selectedValues.includes(option)}
                onChange={() => handleToggle(option)}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </Modal>
  );
}