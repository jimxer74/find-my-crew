'use client';

import { getCostModelIconColor, CostModel } from '@/app/types/cost-models';

interface CostModelIconProps {
  model: CostModel;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CostModelIcon({ model, className = '', size = 'md' }: CostModelIconProps) {
  const colorCode = getCostModelIconColor(model);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  switch (model) {
    case 'Shared contribution':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${sizeClasses[size]} ${className}`}
        >
          <circle cx="12" cy="12" r="3" stroke={colorCode} />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={colorCode} />
        </svg>
      );
    case 'Owner covers all costs':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${sizeClasses[size]} ${className}`}
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke={colorCode} />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke={colorCode} />
          <line x1="12" y1="22.08" x2="12" y2="12" stroke={colorCode} />
        </svg>
      );
    case 'Crew pays a fee':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${sizeClasses[size]} ${className}`}
        >
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke={colorCode} />
          <line x1="1" y1="10" x2="23" y2="10" stroke={colorCode} />
          <line x1="6" y1="16" x2="6.01" y2="16" stroke={colorCode} />
          <line x1="10" y1="16" x2="10.01" y2="16" stroke={colorCode} />
          <line x1="14" y1="16" x2="14.01" y2="16" stroke={colorCode} />
          <line x1="18" y1="16" x2="18.01" y2="16" stroke={colorCode} />
        </svg>
      );
    case 'Delivery/paid crew':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${sizeClasses[size]} ${className}`}
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke={colorCode} />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke={colorCode} />
          <line x1="12" y1="22.08" x2="12" y2="12" stroke={colorCode} />
          <path d="M8 22l4-11 4 11" stroke={colorCode} />
        </svg>
      );
    case 'Not defined':
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${sizeClasses[size]} ${className}`}
        >
          <circle cx="12" cy="12" r="10" stroke={colorCode} />
          <path d="M12 8v4l3 3" stroke={colorCode} />
        </svg>
      );
  }
}