'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { FeedbackButton } from '@/app/components/feedback/FeedbackButton';
import { TypeBadge } from '@/app/components/feedback/TypeBadge';
import { StatusBadge } from '@/app/components/feedback/StatusBadge';
import { type FeedbackWithAuthor } from '@/app/lib/feedback/types';

export default function MyFeedbackPage() {
  const t = useTranslations('feedback');
  const tCommon = useTranslations('common');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<FeedbackWithAuthor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMyFeedback = useCallback(async (pageNum: number, resetItems = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pageNum.toString());
      params.set('limit', '20');

      const res = await fetch(`/api/feedback/my?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch feedback');

      const data = await res.json();
      setItems(resetItems ? data.items : [...items, ...data.items]);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoading(false);
    }
  }, [items]);

  useEffect(() => {
    if (user) {
      fetchMyFeedback(1, true);
    }
  }, [user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/feedback/my');
    }
  }, [authLoading, user, router]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMyFeedback(nextPage, false);
  };

  const handleDelete = async (feedbackId: string) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const res = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete feedback');

      setItems(items.filter(item => item.id !== feedbackId));
      setTotal(total - 1);
    } catch (error) {
      console.error('Error deleting feedback:', error);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{tCommon('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link href="/feedback" className="hover:underline">{t('pageTitle')}</Link>
              <span>/</span>
              <span>{t('myFeedback')}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t('myFeedback')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('myFeedbackCount', { count: total })}
            </p>
          </div>
          <FeedbackButton variant="inline" contextPage="/feedback/my" />
        </div>

        {/* Loading state */}
        {isLoading && items.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium">{t('noFeedbackYet')}</h3>
            <p className="mt-1 text-muted-foreground">{t('noFeedbackYetDescription')}</p>
            <div className="mt-6">
              <FeedbackButton variant="inline" contextPage="/feedback/my" />
            </div>
          </div>
        )}

        {/* Feedback list */}
        <div className="space-y-3">
          {items.map((feedback) => (
            <div key={feedback.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <TypeBadge type={feedback.type} size="sm" />
                    <StatusBadge status={feedback.status} size="sm" />
                    {feedback.is_anonymous && (
                      <span className="text-xs text-muted-foreground">{t('submittedAnonymously')}</span>
                    )}
                  </div>

                  {/* Title */}
                  <Link href={`/feedback/${feedback.id}`} className="block group">
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {feedback.title}
                    </h3>
                  </Link>

                  {/* Description preview */}
                  {feedback.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {feedback.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      {feedback.vote_score} {t('votes')}
                    </span>
                    <span>
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/feedback/${feedback.id}`}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title={t('view')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDelete(feedback.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                    title={t('delete')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center pt-6">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="px-6 py-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            >
              {isLoading ? tCommon('loading') : t('loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
