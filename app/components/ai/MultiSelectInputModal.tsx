'use client';

import { useState } from 'react';
import { AIPendingAction } from '@/app/lib/ai/assistant/types';

interface MultiSelectInputModalProps {
  action: AIPendingAction;
  onSubmit: (value: string[]) => void;
  onCancel: () => void;
}

export function MultiSelectInputModal({ action, onSubmit, onCancel }: MultiSelectInputModalProps) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Update {getFieldLabel()}
              </h3>
              <p className="text-sm text-muted-foreground">
                {action.input_prompt || getFieldDescription()}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                {getFieldLabel()}
              </label>

              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">No options available.</p>
              ) : (
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {options.map((option) => (
                    <label key={option} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(option)}
                        onChange={() => handleToggle(option)}
                        className="w-4 h-4 text-primary bg-input-background border-border rounded focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">{option}</span>
                    </label>
                  ))}
                </div>
              )}

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