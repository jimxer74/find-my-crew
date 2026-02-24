'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/app/components/ui/Button/Button';
import { LegList, LegListItemData } from './LegList';
import { CostModel } from '@/app/types/cost-models';

// Extended leg type that includes all fields needed for LegDetailsPanel
export type LegBrowsePaneData = LegListItemData & {
  leg_description?: string | null;
  crew_needed?: number | null;
  leg_risk_level?: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null;
  journey_risk_level?: ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[] | null;
  cost_model?: CostModel | null;
  skills?: string[];
  boat_id?: string;
  boat_type?: string | null;
  boat_average_speed_knots?: number | null;
  owner_name?: string | null;
  owner_image_url?: string | null;
  min_experience_level?: number | null;
};

type LegBrowsePaneProps = {
  legs: LegBrowsePaneData[];
  onLegSelect?: (leg: LegBrowsePaneData) => void;
  onMinimizeChange?: (isMinimized: boolean) => void;
  className?: string;
  isLoading?: boolean;
  isVisible?: boolean;  // Control visibility (hide when detail panel is open)
  showMatchBadge?: boolean;  // Whether to show match badges (false when no user logged in)
};

export function LegBrowsePane({
  legs,
  onLegSelect,
  onMinimizeChange,
  className = '',
  isLoading = false,
  isVisible = true,
  showMatchBadge = false,
}: LegBrowsePaneProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  // Notify parent when minimized state changes
  useEffect(() => {
    onMinimizeChange?.(isMinimized);
  }, [isMinimized, onMinimizeChange]);

  const handleLegClick = useCallback((leg: LegListItemData) => {
    const fullLeg = legs.find(l => l.leg_id === leg.leg_id);
    if (fullLeg) {
      onLegSelect?.(fullLeg);
    }
  }, [legs, onLegSelect]);

  if (!isVisible) return null;

  return (
    <>
      {/* Main Pane */}
      <div
        className={`fixed top-0 left-0 bottom-0 bg-background border-r border-border z-30 flex-col hidden md:flex transition-all duration-300 ease-out ${
          isMinimized ? 'w-0' : 'w-[400px]'
        } ${className}`}
      >

        {/* Minimize button - Right edge of pane */}
        {!isMinimized && (
          <Button
            onClick={() => setIsMinimized(true)}
            variant="outline"
            size="sm"
            className="hidden md:flex !w-8 !h-12 absolute top-1/2 -right-7.5 -z-10 -translate-y-1/2 rounded-r-md !p-0 shadow-md"
            title="Minimize panel"
            aria-label="Minimize panel"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </Button>
        )}

        {/* Header */}
        {!isMinimized && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-background">
            <h2 className="font-semibold text-foreground">
              {legs.length} Leg{legs.length !== 1 ? 's' : ''} in View
            </h2>
            <Link
              href="/crew"
              className="flex items-center gap-1 px-2 py-1 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
              title="List View"
              aria-label="List View"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 6h13M8 12h13m-13 6h13M3 6h.01M3 12h.01M3 18h.01"
                />
              </svg>
              <span className="hidden sm:inline">List View</span>
            </Link>
          </div>
        )}

        {/* Content */}
        {!isMinimized && (
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <LegList
                legs={legs}
                onLegClick={handleLegClick}
                sortByMatch={showMatchBadge} // Only sort by match when showing match badges
                displayOptions={{
                  showCarousel: true,
                  showMatchBadge: showMatchBadge,
                  showLegName: true,
                  showJourneyName: true,
                  showLocations: true,
                  showDates: true,
                  showDuration: true,
                  carouselHeight: 'h-32',
                }}
                gap="md"
              />
            )}
          </div>
        )}
      </div>

      {/* Maximize button when minimized */}
      {isMinimized && (
        <Button
          onClick={() => setIsMinimized(false)}
          variant="outline"
          size="sm"
          className="hidden md:flex !w-8 !h-12 fixed top-1/2 left-0 -translate-y-1/2 rounded-r-md !p-0 shadow-md z-30"
          title="Show legs list"
          aria-label="Show legs list"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </Button>
      )}
    </>
  );
}
