'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { FeedbackCard } from './FeedbackCard';
import { Button } from '@shared/ui/Button/Button';
import {
  FeedbackType,
  FeedbackStatus,
  type FeedbackWithAuthor,
  type FeedbackFilters,
  getFeedbackTypeLabel,
  getFeedbackStatusLabel,
} from '@shared/lib/feedback/types';
import { logger } from '@shared/logging';

interface FeedbackListProps {
  currentUserId?: string;
}

export function FeedbackList({ currentUserId }: FeedbackListProps) {
  const t = useTranslations('feedback');
  const [items, setItems] = useState<FeedbackWithAuthor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FeedbackFilters>({
    type: 'all',
    status: 'all',
    sort: 'newest',
    search: '',
  });

  const fetchFeedback = useCallback(async (pageNum: number, resetItems = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type !== 'all') params.set('type', filters.type);
      if (filters.status !== 'all') params.set('status', filters.status);
      params.set('sort', filters.sort);
      if (filters.search) params.set('search', filters.search);
      params.set('page', pageNum.toString());
      params.set('limit', '20');

      const res = await fetch(`/api/feedback?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch feedback');

      const data = await res.json();
      setItems(resetItems ? data.items : [...items, ...data.items]);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (error) {
      logger.error('Error fetching feedback:', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsLoading(false);
    }
  }, [filters, items]);

  // Fetch on initial load and when filters change
  useEffect(() => {
    setPage(1);
    fetchFeedback(1, true);
  }, [filters.type, filters.status, filters.sort, filters.search]);

  const handleVote = async (feedbackId: string, vote: 1 | -1 | 0) => {
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });

      if (!res.ok) throw new Error('Failed to vote');

      // Refresh the item
      const updatedRes = await fetch(`/api/feedback/${feedbackId}`);
      if (updatedRes.ok) {
        const updatedFeedback = await updatedRes.json();
        setItems(items.map(item =>
          item.id === feedbackId ? updatedFeedback : item
        ));
      }
    } catch (error) {
      logger.error('Error voting:', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeedback(nextPage, false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filters.search}
              onChange={handleSearchChange}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Type filter */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value as FeedbackType | 'all' })}
          className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">{t('allTypes')}</option>
          {Object.values(FeedbackType).map((type) => (
            <option key={type} value={type}>{getFeedbackTypeLabel(type)}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as FeedbackStatus | 'all' })}
          className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">{t('allStatuses')}</option>
          {Object.values(FeedbackStatus).map((status) => (
            <option key={status} value={status}>{getFeedbackStatusLabel(status)}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value as 'newest' | 'oldest' | 'most_votes' | 'least_votes' })}
          className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="newest">{t('sortNewest')}</option>
          <option value="oldest">{t('sortOldest')}</option>
          <option value="most_votes">{t('sortMostVotes')}</option>
          <option value="least_votes">{t('sortLeastVotes')}</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {t('showingResults', { count: items.length, total })}
      </p>

      {/* Loading state */}
      {isLoading && items.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium">{t('noFeedbackFound')}</h3>
          <p className="mt-1 text-muted-foreground">{t('noFeedbackDescription')}</p>
        </div>
      )}

      {/* Feedback list */}
      <div className="space-y-3">
        {items.map((feedback) => (
          <FeedbackCard
            key={feedback.id}
            feedback={feedback}
            isOwn={feedback.user_id === currentUserId}
            onVote={handleVote}
          />
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleLoadMore}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? t('loading') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
