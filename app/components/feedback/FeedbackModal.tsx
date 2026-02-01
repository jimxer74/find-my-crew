'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FeedbackType, type CreateFeedbackPayload } from '@/app/lib/feedback/types';

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
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
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

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="feedback-modal-title" className="text-lg font-semibold">
            {t('shareYourFeedback')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-accent transition-colors"
            aria-label={t('close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('whatTypeOfFeedback')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {feedbackTypes.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSelectedType(item.type)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    selectedType === item.type
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-sm font-medium">{item.label}</div>
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
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {/* Anonymous checkbox */}
          <div className="flex items-center gap-2">
            <input
              id="feedback-anonymous"
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 rounded border-border"
            />
            <label htmlFor="feedback-anonymous" className="text-sm text-muted-foreground">
              {t('submitAnonymously')}
            </label>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedType || !title.trim()}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t('submitting') : t('submitFeedback')}
          </button>
        </form>
      </div>
    </div>
  );
}
