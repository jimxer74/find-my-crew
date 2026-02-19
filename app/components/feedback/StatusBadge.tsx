'use client';

import { Badge } from '@/app/components/ui';
import { FeedbackStatus, getFeedbackStatusLabel } from '@/app/lib/feedback/types';
import type { BadgeVariant } from '@/app/components/ui/Badge/Badge.types';

interface StatusBadgeProps {
  status: FeedbackStatus;
  size?: 'sm' | 'md';
}

/**
 * Map feedback status to badge variant
 */
function getFeedbackStatusBadgeVariant(status: FeedbackStatus): BadgeVariant {
  switch (status) {
    case FeedbackStatus.NEW:
      return 'info';
    case FeedbackStatus.UNDER_REVIEW:
      return 'warning';
    case FeedbackStatus.PLANNED:
    case FeedbackStatus.IN_PROGRESS:
      return 'info';
    case FeedbackStatus.COMPLETED:
      return 'success';
    case FeedbackStatus.DECLINED:
    default:
      return 'secondary';
  }
}

/**
 * Feedback status badge - Shows feedback status
 * Refactored to use core Badge component
 */
export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const variant = getFeedbackStatusBadgeVariant(status);
  const badgeSize = size === 'sm' ? 'sm' : 'md';

  return (
    <Badge variant={variant} size={badgeSize}>
      {getFeedbackStatusLabel(status)}
    </Badge>
  );
}
