'use client';

import { logger } from '@shared/logging';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { TypeBadge } from '@shared/components/feedback/TypeBadge';
import { StatusBadge } from '@shared/components/feedback/StatusBadge';
import { VoteButtons } from '@shared/components/feedback/VoteButtons';
import { type FeedbackWithAuthor } from '@shared/lib/feedback/types';

interface FeedbackDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function FeedbackDetailPage({ params }: FeedbackDetailPageProps) {
  const { id } = use(params);
  const t = useTranslations('feedback');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const router = useRouter();

  const [feedback, setFeedback] = useState<FeedbackWithAuthor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/feedback/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError(t('feedbackNotFound'));
          } else {
            throw new Error('Failed to fetch feedback');
          }
          return;
        }

        const data = await res.json();
        setFeedback(data);
      } catch (err) {
        logger.error('Error fetching feedback:', err instanceof Error ? { error: err.message } : { error: String(err) });
        setError(t('fetchError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [id, t]);

  const handleVote = async (feedbackId: string, vote: 1 | -1 | 0) => {
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });

      if (!res.ok) throw new Error('Failed to vote');

      // Refresh the feedback
      const updatedRes = await fetch(`/api/feedback/${feedbackId}`);
      if (updatedRes.ok) {
        const updatedFeedback = await updatedRes.json();
        setFeedback(updatedFeedback);
      }
    } catch (error) {
      logger.error('Error voting:', error instanceof Error ? { error: error.message } : { error: String(error) });
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete feedback');

      router.push('/feedback/my');
    } catch (error) {
      logger.error('Error deleting feedback:', error instanceof Error ? { error: error.message } : { error: String(error) });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold">{error || t('feedbackNotFound')}</h2>
          <p className="mt-2 text-muted-foreground">{t('feedbackNotFoundDescription')}</p>
          <Link
            href="/feedback"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('backToFeedback')}
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === feedback.user_id;
  const authorDisplay = feedback.is_anonymous
    ? t('anonymous')
    : feedback.author?.full_name || feedback.author?.username || t('unknown');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/feedback" className="hover:underline">{t('pageTitle')}</Link>
          <span>/</span>
          <span className="truncate">{feedback.title}</span>
        </div>

        {/* Main content */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex gap-6">
            {/* Vote buttons */}
            <div className="flex-shrink-0">
              <VoteButtons
                feedbackId={feedback.id}
                upvotes={feedback.upvotes}
                userVote={feedback.user_vote ?? null}
                disabled={isOwner || !user}
                onVote={handleVote}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header with badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <TypeBadge type={feedback.type} />
                <StatusBadge status={feedback.status} />
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-foreground mb-4">
                {feedback.title}
              </h1>

              {/* Description */}
              {feedback.description ? (
                <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                  <p className="whitespace-pre-wrap">{feedback.description}</p>
                </div>
              ) : (
                <p className="text-muted-foreground italic mb-6">{t('noDescription')}</p>
              )}

              {/* Status note (if any) */}
              {feedback.status_note && (
                <div className="bg-accent/50 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium mb-1">{t('statusNote')}</h3>
                  <p className="text-sm text-muted-foreground">{feedback.status_note}</p>
                </div>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-t border-border pt-4">
                {/* Author */}
                {/*
                <div className="flex items-center gap-2">
                  {!feedback.is_anonymous && feedback.author?.profile_image_url ? (
                    <img
                      src={feedback.author.profile_image_url}
                      alt={authorDisplay}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                      <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <span>{authorDisplay}</span>
                </div>

                <span>•</span>
                */}

                {/* Date */}
                <span>
                  {t('submittedOn', { date: new Date(feedback.created_at).toLocaleDateString() })}
                </span>

                {/* Like count */}
                {feedback.upvotes > 0 && (
                  <>
                    <span>•</span>
                    <span>
                      {feedback.upvotes} {feedback.upvotes === 1 ? t('like') : t('likes')}
                    </span>
                  </>
                )}
              </div>

              {/* Owner actions */}
              {isOwner && (
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {t('delete')}
                  </button>
                </div>
              )}

              {/* Login prompt for voting */}
              {!user && (
                <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm">
                    <Link href="/auth/login" className="text-primary hover:underline font-medium">
                      {t('signInToVote')}
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6">
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('backToFeedback')}
          </Link>
        </div>
      </div>
    </div>
  );
}
