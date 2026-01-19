'use client';

import { getMatchColorClass, getMatchTextColorClass } from '@/app/lib/skillMatching';

interface MatchBadgeProps {
  percentage: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MatchBadge({ 
  percentage, 
  showLabel = true, 
  size = 'md',
  className = '' 
}: MatchBadgeProps) {
  const colorClass = getMatchColorClass(percentage);
  const textColorClass = getMatchTextColorClass(percentage);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border-2 ${colorClass} ${textColorClass} ${sizeClasses[size]} ${className}`}
      title={`${percentage}% skill match`}
    >
      {showLabel && (
        <span className="mr-1">
          {percentage === 100 ? 'Perfect Match' : `${percentage}% Match`}
        </span>
      )}
      <span></span>
    </span>
  );
}
