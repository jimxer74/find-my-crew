'use client';

import { Badge } from '@/app/components/ui';
import { FeedbackType, getFeedbackTypeLabel } from '@/app/lib/feedback/types';
import type { BadgeVariant } from '@shared/ui/Badge/Badge.types';

interface TypeBadgeProps {
  type: FeedbackType;
  size?: 'sm' | 'md';
}

/**
 * Get icon SVG for feedback type
 */
function getTypeIcon(type: FeedbackType) {
  switch (type) {
    case FeedbackType.BUG:
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case FeedbackType.FEATURE:
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case FeedbackType.IMPROVEMENT:
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case FeedbackType.OTHER:
    default:
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
  }
}

/**
 * Map feedback type to badge variant
 */
function getFeedbackTypeBadgeVariant(type: FeedbackType): BadgeVariant {
  switch (type) {
    case FeedbackType.BUG:
      return 'error';
    case FeedbackType.FEATURE:
      return 'info';
    case FeedbackType.IMPROVEMENT:
      return 'success';
    case FeedbackType.OTHER:
    default:
      return 'secondary';
  }
}

/**
 * Feedback type badge - Shows feedback type with icon
 * Refactored to use core Badge component
 */
export function TypeBadge({ type, size = 'md' }: TypeBadgeProps) {
  const variant = getFeedbackTypeBadgeVariant(type);
  const badgeSize = size === 'sm' ? 'sm' : 'md';

  return (
    <Badge
      variant={variant}
      size={badgeSize}
      icon={getTypeIcon(type)}
    >
      {getFeedbackTypeLabel(type)}
    </Badge>
  );
}
