'use client';

import Link from 'next/link';
import { Card } from '@/app/components/ui';
import { type FeedbackWithAuthor } from '@/app/lib/feedback/types';
import { TypeBadge } from './TypeBadge';
import { StatusBadge } from './StatusBadge';
import { VoteButtons } from './VoteButtons';

interface FeedbackCardProps {
  feedback: FeedbackWithAuthor;
  isOwn?: boolean;
  onVote: (feedbackId: string, vote: 1 | -1 | 0) => Promise<void>;
}

/**
 * Formats a timestamp as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export function FeedbackCard({ feedback, isOwn = false, onVote }: FeedbackCardProps) {
  const authorDisplay = feedback.is_anonymous
    ? 'Anonymous'
    : feedback.author?.full_name || feedback.author?.username || 'Unknown';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Vote buttons */}
        <VoteButtons
          feedbackId={feedback.id}
          upvotes={feedback.upvotes}
          userVote={feedback.user_vote ?? null}
          disabled={isOwn}
          onVote={onVote}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header with badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <TypeBadge type={feedback.type} size="sm" />
            <StatusBadge status={feedback.status} size="sm" />
          </div>

          {/* Title */}
          <Link href={`/feedback/${feedback.id}`} className="block group">
            <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {feedback.title}
            </h3>
          </Link>

          {/* Description preview */}
          {feedback.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {feedback.description}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            {/* Author avatar */}
            {/*
            {!feedback.is_anonymous && feedback.author?.profile_image_url ? (
              <img
                src={feedback.author.profile_image_url}
                alt={authorDisplay}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : ( */}
            {/*}
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            {/* )} */}
            {/* <span>{authorDisplay}</span> */}
            <span>•</span>
            <span>{formatRelativeTime(feedback.created_at)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
