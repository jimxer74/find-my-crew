'use client';

import { FeedbackStatus, getFeedbackStatusLabel, getFeedbackStatusColor } from '@/app/lib/feedback/types';

interface StatusBadgeProps {
  status: FeedbackStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${getFeedbackStatusColor(status)}`}>
      {getFeedbackStatusLabel(status)}
    </span>
  );
}
