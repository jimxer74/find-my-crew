'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FeedbackModal } from './FeedbackModal';
import { Button } from '@shared/ui/Button/Button';
import { type CreateFeedbackPayload, type FeedbackType } from '@shared/lib/feedback/types';

interface FeedbackButtonProps {
  variant?: 'fab' | 'inline' | 'nav';
  initialType?: FeedbackType;
  contextPage?: string;
  contextMetadata?: Record<string, unknown>;
  onSuccess?: () => void;
}

const chatIcon = (size: 'sm' | 'md') => (
  <svg
    className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

export function FeedbackButton({
  variant = 'inline',
  initialType,
  contextPage,
  contextMetadata,
  onSuccess,
}: FeedbackButtonProps) {
  const t = useTranslations('feedback');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = async (payload: CreateFeedbackPayload) => {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to submit feedback');
    }

    onSuccess?.();
  };

  const modal = (
    <FeedbackModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleSubmit}
      initialType={initialType}
      contextPage={contextPage}
      contextMetadata={contextMetadata}
    />
  );

  // Floating action button variant
  if (variant === 'fab') {
    return (
      <>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          className="fixed bottom-6 right-6 z-40 !p-4 rounded-full shadow-lg hover:scale-105"
          aria-label={t('shareFeedback')}
        >
          {chatIcon('md')}
        </Button>
        {modal}
      </>
    );
  }

  // Navigation menu item variant
  if (variant === 'nav') {
    return (
      <>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="ghost"
          size="sm"
          className="w-full !justify-start !text-sm"
          leftIcon={chatIcon('sm')}
        >
          {t('shareFeedback')}
        </Button>
        {modal}
      </>
    );
  }

  // Inline button variant (default) — prominent, medium size
  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        variant="primary"
        size="md"
        leftIcon={chatIcon('md')}
      >
        {t('shareFeedback')}
      </Button>
      {modal}
    </>
  );
}
