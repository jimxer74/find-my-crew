'use client';

import { logger } from '@/app/lib/logger';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FeedbackModal } from './FeedbackModal';
import { Button } from '@/app/components/ui/Button/Button';
import { type CreateFeedbackPayload, type PromptStatusResponse, FeedbackPromptType } from '@/app/lib/feedback/types';

interface FeedbackPromptProps {
  userId?: string;
}

export function FeedbackPrompt({ userId }: FeedbackPromptProps) {
  const t = useTranslations('feedback');
  const [promptStatus, setPromptStatus] = useState<PromptStatusResponse | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  // Fetch prompt status on mount
  useEffect(() => {
    if (!userId) return;

    const fetchPromptStatus = async () => {
      try {
        const res = await fetch('/api/feedback/prompts');
        if (!res.ok) return;

        const data: PromptStatusResponse = await res.json();
        setPromptStatus(data);

        // Show if any prompt should be displayed
        if (data.showPostJourneyPrompt || data.showGeneralPrompt || data.showEngagementPrompt) {
          // Delay showing the prompt a bit for better UX
          setTimeout(() => setIsVisible(true), 2000);
        }
      } catch (error) {
        logger.error('Error fetching prompt status:', { error: error instanceof Error ? error.message : String(error) });
      }
    };

    fetchPromptStatus();
  }, [userId]);

  const handleDismiss = async (days?: number) => {
    setIsDismissing(true);
    try {
      const promptType = promptStatus?.showPostJourneyPrompt
        ? FeedbackPromptType.POST_JOURNEY
        : FeedbackPromptType.GENERAL;

      await fetch('/api/feedback/prompts/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_type: promptType,
          dismiss_days: days,
        }),
      });

      setIsVisible(false);
    } catch (error) {
      logger.error('Error dismissing prompt:', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsDismissing(false);
    }
  };

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

    setIsVisible(false);
  };

  if (!isVisible || !promptStatus) return null;

  // Determine prompt content
  let title = t('generalPromptTitle');
  let message = t('generalPromptMessage');
  let contextMetadata: Record<string, unknown> | undefined;

  if (promptStatus.showPostJourneyPrompt && promptStatus.postJourneyContext) {
    title = t('postJourneyPromptTitle');
    message = t('postJourneyPromptMessage', {
      journeyName: promptStatus.postJourneyContext.journey_name,
    });
    contextMetadata = {
      journey_id: promptStatus.postJourneyContext.journey_id,
      journey_name: promptStatus.postJourneyContext.journey_name,
      leg_name: promptStatus.postJourneyContext.leg_name,
    };
  }

  return (
    <>
      {/* Prompt banner */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm">
        <div className="bg-card border border-border rounded-lg shadow-lg p-4">
          {/* Close button */}
          <Button
            onClick={() => handleDismiss(7)}
            disabled={isDismissing}
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 !p-1"
            aria-label={t('close')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>

          {/* Content */}
          <div className="pr-6">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="font-medium">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setIsModalOpen(true)}
                variant="primary"
                size="sm"
                className="flex-1"
              >
                {t('shareFeedback')}
              </Button>
              <Button
                onClick={() => handleDismiss(30)}
                disabled={isDismissing}
                variant="outline"
                size="sm"
              >
                {t('maybeLater')}
              </Button>
            </div>

            {/* Don't show again link */}
            <Button
              onClick={() => handleDismiss()}
              disabled={isDismissing}
              variant="ghost"
              size="sm"
              className="mt-2 !text-xs !text-muted-foreground hover:!underline !p-0"
            >
              {t('dontShowAgain')}
            </Button>
          </div>
        </div>
      </div>

      {/* Feedback modal */}
      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        contextPage={typeof window !== 'undefined' ? window.location.pathname : undefined}
        contextMetadata={contextMetadata}
      />
    </>
  );
}
