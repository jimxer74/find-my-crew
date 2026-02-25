'use client';

import { Badge } from '@/app/components/ui';
import type { BadgeVariant } from '@/app/components/ui/Badge/Badge.types';

interface MatchBadgeProps {
  percentage: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  experienceMatches?: boolean; // Whether user's experience level meets requirement
}

/**
 * Match percentage badge - Displays skill match percentage with color coding
 * Considers both skill match percentage and experience level match
 * Refactored to use core Badge component
 */
export function MatchBadge({
  percentage,
  showLabel = true,
  size = 'md',
  className = '',
  experienceMatches = true, // Default to true (assume experience matches if not specified)
}: MatchBadgeProps) {
  // Reduce percentage if experience level doesn't match
  // This ensures the badge reflects the overall match quality
  const effectivePercentage = experienceMatches ? percentage : Math.min(percentage, 75);

  // Map effective percentage to badge variant
  const variant: BadgeVariant =
    effectivePercentage >= 80 ? 'success' :
    effectivePercentage >= 50 ? 'warning' :
    effectivePercentage >= 25 ? 'warning' :
    'error';

  // Show "Perfect Match" only when skill percentage is 100 AND experience matches
  const label = (percentage === 100 && experienceMatches)
    ? 'Perfect Match'
    : `${effectivePercentage}% Match`;

  const title = experienceMatches
    ? `${percentage}% skill match`
    : `${percentage}% skills but experience level doesn't match`;

  return (
    <Badge
      variant={variant}
      size={size}
      title={title}
      className={className}
    >
      {showLabel ? label : `${effectivePercentage}%`}
    </Badge>
  );
}
