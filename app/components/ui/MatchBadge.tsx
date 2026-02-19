'use client';

import { Badge } from '@/app/components/ui';
import type { BadgeVariant } from '@/app/components/ui/Badge/Badge.types';

interface MatchBadgeProps {
  percentage: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Match percentage badge - Displays skill match percentage with color coding
 * Refactored to use core Badge component
 */
export function MatchBadge({
  percentage,
  showLabel = true,
  size = 'md',
  className = ''
}: MatchBadgeProps) {
  // Map percentage to badge variant
  const variant: BadgeVariant =
    percentage >= 80 ? 'success' :
    percentage >= 50 ? 'warning' :
    percentage >= 25 ? 'warning' :
    'error';

  const label = percentage === 100 ? 'Perfect Match' : `${percentage}% Match`;

  return (
    <Badge
      variant={variant}
      size={size}
      title={`${percentage}% skill match`}
      className={className}
    >
      {showLabel ? label : `${percentage}%`}
    </Badge>
  );
}
