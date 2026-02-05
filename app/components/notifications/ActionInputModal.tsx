'use client';

import { useState } from 'react';
import { Notification, NotificationMetadata } from '@/app/lib/notifications';

interface ActionInputModalProps {
  notification: Notification;
  onSubmit: (value: string | string[]) => void;
  onCancel: () => void;
}

export function ActionInputModal({ notification, onSubmit, onCancel }: ActionInputModalProps) {
  const [value, setValue] = useState<string>('');
  const [multiValue, setMultiValue] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const metadata = notification.metadata as NotificationMetadata;

    // Basic validation
    if (metadata.input_type === 'text') {
      if (!value.trim()) {
        setError('This field is required.');
        return;
      }
      onSubmit(value);
    } else if (metadata.input_type === 'text_array') {
      if (multiValue.length === 0 || multiValue.some(item => !item.trim())) {
        setError('Please provide at least one valid item.');
        return;
      }
      onSubmit(multiValue);
    } else if (metadata.input_type === 'select') {
      if (!value) {
        setError('Please select an option.');
        return;
      }
      onSubmit(value);
    }
  };

  const getPlaceholder = () => {
    const metadata = notification.metadata as NotificationMetadata;
    return metadata.input_prompt || 'Enter your response here...';
  };

  const getFieldLabel = () => {
    const metadata = notification.metadata as NotificationMetadata;
    return metadata.input_prompt || 'Input';
  };

  const handleMultiValueChange = (index: number, newValue: string) => {
    const newArray = [...multiValue];
    newArray[index] = newValue;
    setMultiValue(newArray);
  };

  const handleAddMultiValue = () => {
    setMultiValue([...multiValue, '']);
  };

  const handleRemoveMultiValue = (index: number) => {
    setMultiValue(multiValue.filter((_, i) => i !== index));
  };

  const metadata = notification.metadata as NotificationMetadata;

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
                {notification.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {notification.metadata?.input_prompt ?? 'Please provide the required information.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {getFieldLabel()}
              </label>

              {metadata.input_type === 'text' && (
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={getPlaceholder()}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[120px] resize-none"
                  autoFocus
                />
              )}

              {metadata.input_type === 'text_array' && (
                <div className="space-y-2">
                  {multiValue.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleMultiValueChange(index, e.target.value)}
                        placeholder={`Item ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMultiValue(index)}
                        className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddMultiValue}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Add Item
                  </button>
                </div>
              )}

              {metadata.input_type === 'select' && (
                <select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select an option</option>
                  {metadata.input_options?.map((option, index) => (
                    <option key={index} value={option}>{option}</option>
                  ))}
                </select>
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
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}