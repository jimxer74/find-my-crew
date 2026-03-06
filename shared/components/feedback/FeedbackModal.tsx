'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Button, Checkbox } from '@shared/ui';
import { FeedbackType, type CreateFeedbackPayload } from '@shared/lib/feedback/types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateFeedbackPayload) => Promise<void>;
  initialType?: FeedbackType;
  contextPage?: string;
  contextMetadata?: Record<string, unknown>;
}

const feedbackTypes = [
  { type: FeedbackType.BUG, label: 'Bug', icon: '🐛', description: 'Something is broken' },
  { type: FeedbackType.FEATURE, label: 'Feature', icon: '✨', description: 'New functionality' },
  { type: FeedbackType.IMPROVEMENT, label: 'Improvement', icon: '💡', description: 'Make something better' },
  { type: FeedbackType.OTHER, label: 'Other', icon: '💬', description: 'General feedback' },
];

export function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  initialType,
  contextPage,
  contextMetadata,
}: FeedbackModalProps) {
  const t = useTranslations('feedback');
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(initialType || null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus title input when modal opens
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedType(initialType || null);
      setTitle('');
      setDescription('');
      setIsAnonymous(false);
      setError(null);
      setSubmitted(false);
    }
  }, [isOpen, initialType]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedType) {
      setError(t('selectType'));
      return;
    }

    if (!title.trim()) {
      setError(t('titleRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        type: selectedType,
        title: title.trim(),
        description: description.trim() || undefined,
        is_anonymous: isAnonymous,
        context_page: contextPage,
        context_metadata: contextMetadata,
      });
      setSubmitted(true);
      setTimeout(() => onClose(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Thank you!</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Your feedback has been submitted and is now visible in the list.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">This window will close automatically…</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('shareYourFeedback')}
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const formEvent = new Event('submit', { bubbles: true }) as any;
              handleSubmit(formEvent);
            }}
            disabled={isSubmitting || !selectedType || !title.trim()}
            className="flex-1"
          >
            {isSubmitting ? t('submitting') : t('submitFeedback')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('whatTypeOfFeedback')}</label>
          <div className="grid grid-cols-4 gap-2">
            {feedbackTypes.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setSelectedType(item.type)}
                className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                  selectedType === item.type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-background text-foreground hover:bg-accent'
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title input */}
        <div>
          <label htmlFor="feedback-title" className="block text-sm font-medium mb-1">
            {t('title')} <span className="text-red-500">*</span>
          </label>
          <input
            ref={titleInputRef}
            id="feedback-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder={t('titlePlaceholder')}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {title.length}/200
          </p>
        </div>

        {/* Description textarea */}
        <div>
          <label htmlFor="feedback-description" className="block text-sm font-medium mb-1">
            {t('description')}
          </label>
          <textarea
            id="feedback-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={t('descriptionPlaceholder')}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
        </div>

        {/* Anonymous checkbox */}
        <Checkbox
          id="feedback-anonymous"
          label={t('submitAnonymously')}
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
        />
      </form>
    </Modal>
  );
}
