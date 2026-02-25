'use client';

import React from 'react';
import { Badge } from '@shared/ui';
import type { BadgeVariant } from '@shared/ui/Badge/Badge.types';

interface RegistrationStatusBadgeProps {
  status: 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';
  className?: string;
}

/**
 * Badge component to display registration status
 * Shows user's registration status for a crew leg instead of Join button
 */
export function RegistrationStatusBadge({
  status,
  className = '',
}: RegistrationStatusBadgeProps) {
  // Map status to badge variant and display text
  const getStatusDisplay = (
    status: 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled'
  ): {
    variant: BadgeVariant;
    label: string;
    icon: React.ReactElement;
  } => {
    switch (status) {
      case 'Pending approval':
        return {
          variant: 'warning',
          label: 'Pending',
          icon: (
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 2m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        };

      case 'Approved':
        return {
          variant: 'success',
          label: 'Approved',
          icon: (
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ),
        };

      case 'Not approved':
        return {
          variant: 'error',
          label: 'Not Approved',
          icon: (
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ),
        };

      case 'Cancelled':
        return {
          variant: 'secondary',
          label: 'Cancelled',
          icon: (
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10H3L5 7m8 0h10l-2 3m-8 3v6m0-6h0m0 0a6 6 0 110-12"
              />
            </svg>
          ),
        };
    }
  };

  const { variant, label, icon } = getStatusDisplay(status);

  return (
    <Badge
      variant={variant}
      size="sm"
      icon={icon}
      title={`Registration status: ${status}`}
      className={`flex items-center gap-1 ${className}`}
    >
      {label}
    </Badge>
  );
}
