import { Badge } from '@/app/components/ui';
import type { BadgeVariant } from '@/app/components/ui/Badge/Badge.types';

type Status = 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';

interface StatusBadgeProps {
  status: Status;
  variant?: 'full' | 'circle'; // full text or just letter
}

/**
 * Map registration status to badge variant
 */
function getRegistrationStatusVariant(status: Status): BadgeVariant {
  switch (status) {
    case 'Pending approval':
      return 'warning';
    case 'Approved':
      return 'success';
    case 'Not approved':
      return 'error';
    case 'Cancelled':
    default:
      return 'secondary';
  }
}

/**
 * Get display text for status
 */
function getStatusLabel(status: Status): string {
  const labels: Record<Status, string> = {
    'Pending approval': 'Pending',
    'Approved': 'Approved',
    'Not approved': 'Not Approved',
    'Cancelled': 'Cancelled',
  };
  return labels[status];
}

/**
 * Registration status badge - Shows registration approval status
 * Refactored to use core Badge component
 */
export function StatusBadge({ status, variant = 'full' }: StatusBadgeProps) {
  const badgeVariant = getRegistrationStatusVariant(status);
  const label = getStatusLabel(status);

  if (variant === 'circle') {
    // For circle variant, use first letter
    return (
      <Badge
        variant={badgeVariant}
        size="sm"
        dot
        title={label}
        className="!w-8 !h-8 !p-0"
      >
        {label[0]}
      </Badge>
    );
  }

  return (
    <Badge variant={badgeVariant} size="sm">
      {status}
    </Badge>
  );
}
