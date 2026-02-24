'use client';

import { useState } from 'react';
import { Modal, Button, Input } from '@/app/components/ui';
import { Notification, NotificationMetadata } from '@/app/lib/notifications';

interface ActionInputModalProps {
  notification: Notification;
  onSubmit: (value: string | string[]) => void;
  onCancel: () => void;
  isOpen?: boolean;
}

export function ActionInputModal({ notification, onSubmit, onCancel, isOpen = true }: ActionInputModalProps) {
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
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={notification.title}
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
            Submit
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          {notification.metadata?.input_prompt ?? 'Please provide the required information.'}
        </p>

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
                <Button
                  type="button"
                  onClick={() => handleRemoveMultiValue(index)}
                  variant="destructive"
                  size="sm"
                  className="!text-xs"
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              onClick={handleAddMultiValue}
              variant="primary"
              size="sm"
              className="!text-xs !bg-blue-600 hover:!bg-blue-700"
            >
              Add Item
            </Button>
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
    </Modal>
  );
}