'use client';

import { useMemo } from 'react';
import { LegListItem, LegListItemData, LegListItemDisplayOptions } from './LegListItem';

type LegListProps = {
  legs: LegListItemData[];
  onLegClick?: (leg: LegListItemData) => void;
  displayOptions?: LegListItemDisplayOptions;
  sortByMatch?: boolean;           // Sort by match percentage (default: true)
  emptyMessage?: string;           // Custom empty state message
  className?: string;              // Container className
  itemClassName?: string;          // Individual item className
  columns?: 1 | 2;                 // Number of columns (default: 1)
  gap?: 'sm' | 'md' | 'lg';        // Gap between items
};

export function LegList({
  legs,
  onLegClick,
  displayOptions,
  sortByMatch = true,
  emptyMessage = 'No legs found in this area',
  className = '',
  itemClassName = '',
  columns = 1,
  gap = 'md'
}: LegListProps) {
  // Sort legs by match percentage if enabled
  const sortedLegs = useMemo(() => {
    if (!sortByMatch) return legs;

    return [...legs].sort((a, b) => {
      const matchA = a.skill_match_percentage ?? 0;
      const matchB = b.skill_match_percentage ?? 0;
      return matchB - matchA; // Descending order (best match first)
    });
  }, [legs, sortByMatch]);

  // Gap classes
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4'
  };

  // Column classes
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2'
  };

  // Empty state
  if (legs.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
        <svg
          className="w-16 h-16 text-muted-foreground mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-muted-foreground text-center text-sm">
          {emptyMessage}
        </p>
        <p className="text-muted-foreground/70 text-center text-xs mt-1">
          Try zooming out or panning to a different area
        </p>
      </div>
    );
  }

  return (
    <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}>
      {sortedLegs.map((leg) => (
        <LegListItem
          key={leg.leg_id}
          leg={leg}
          onClick={onLegClick}
          displayOptions={displayOptions}
          className={itemClassName}
        />
      ))}
    </div>
  );
}

// Export types for convenience
export type { LegListItemData, LegListItemDisplayOptions };
