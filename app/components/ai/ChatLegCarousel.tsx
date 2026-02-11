'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { LegListItem, LegListItemData } from '@/app/components/crew/LegListItem';

/**
 * Leg reference from AI chat messages
 * Compatible with both ProspectLegReference and assistant LegReference
 */
export interface ChatLegReference {
  id: string;
  name: string;
  journeyName?: string;
  journeyId?: string;
  boatName?: string;
  startDate?: string;
  endDate?: string;
  departureLocation?: string;
  arrivalLocation?: string;
  journeyImages?: string[];
  boatImages?: string[];
}

type ChatLegCarouselProps = {
  legs: ChatLegReference[];
  onLegClick?: (legId: string) => void;
  onJoinClick?: (legId: string, legName: string) => void;
  compact?: boolean;
};

// Group legs by journey ID
type LegGroup = {
  journeyId: string | null; // null for single legs without journey
  legs: LegListItemData[];
  isGrouped: boolean; // true if multiple legs, false if single leg
};

/**
 * Transform chat leg reference to LegListItemData format
 */
function transformToLegListItem(leg: ChatLegReference): LegListItemData {
  // Combine journey images and boat images, preferring journey images
  const allImages = [
    ...(leg.journeyImages || []),
    ...(leg.boatImages || []),
  ];

  return {
    leg_id: leg.id,
    leg_name: leg.name,
    journey_id: leg.journeyId,
    journey_name: leg.journeyName || '',
    start_date: leg.startDate || null,
    end_date: leg.endDate || null,
    journey_images: allImages,
    boat_name: leg.boatName || '',
    boat_image_url: leg.boatImages?.[0] || null,
    start_waypoint: leg.departureLocation
      ? { lng: 0, lat: 0, name: leg.departureLocation }
      : null,
    end_waypoint: leg.arrivalLocation
      ? { lng: 0, lat: 0, name: leg.arrivalLocation }
      : null,
  };
}

/**
 * ChatLegCarousel - Display AI-found legs in a horizontal scrollable carousel
 * Uses the same LegListItem component as the crew dashboard for consistent UX
 */
export function ChatLegCarousel({
  legs,
  onLegClick,
  onJoinClick,
  compact = true,
}: ChatLegCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  // Track selected leg index per journey group (key: journeyId or leg_id for single legs)
  const [selectedLegIndices, setSelectedLegIndices] = useState<Map<string, number>>(new Map());

  const handleLegClick = (leg: LegListItemData) => {
    if (onLegClick) {
      onLegClick(leg.leg_id);
    }
  };

  // Transform legs to LegListItemData format and deduplicate by leg_id
  // (AI may return the same leg multiple times in a message)
  const transformedLegs = useMemo(() => {
    const seenIds = new Set<string>();
    return legs
      .map(transformToLegListItem)
      .filter((leg) => {
        if (seenIds.has(leg.leg_id)) return false;
        seenIds.add(leg.leg_id);
        return true;
      });
  }, [legs]);

  // Group legs by journey_id
  const legGroups = useMemo<LegGroup[]>(() => {
    const groups: LegGroup[] = [];
    const journeyMap = new Map<string | null, LegListItemData[]>();

    // Group legs by journey_id
    transformedLegs.forEach((leg) => {
      const journeyId = leg.journey_id || null;
      if (!journeyMap.has(journeyId)) {
        journeyMap.set(journeyId, []);
      }
      journeyMap.get(journeyId)!.push(leg);
    });

    // Create groups
    journeyMap.forEach((legsInJourney, journeyId) => {
      groups.push({
        journeyId,
        legs: legsInJourney,
        isGrouped: legsInJourney.length > 1,
      });
    });

    return groups;
  }, [transformedLegs]);

  // Check scroll position to show/hide arrows
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    if (scrollLeft > 20 && !hasScrolled) {
      setHasScrolled(true);
    }
  };

  useEffect(() => {
    checkScrollPosition();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      window.addEventListener('resize', checkScrollPosition);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScrollPosition);
      }
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [legGroups]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const cardWidth = compact ? 220 : 280;
    const scrollAmount = cardWidth * 2;

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (legs.length === 0) {
    return null;
  }

  // Get selected leg index for a journey group
  const getSelectedLegIndex = (group: LegGroup): number => {
    const key = group.journeyId || group.legs[0].leg_id;
    return selectedLegIndices.get(key) ?? 0;
  };

  // Set selected leg index for a journey group
  const setSelectedLegIndex = (group: LegGroup, index: number) => {
    const key = group.journeyId || group.legs[0].leg_id;
    setSelectedLegIndices((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, index);
      return newMap;
    });
  };

  // Get the currently displayed leg for a group
  const getDisplayedLeg = (group: LegGroup): LegListItemData => {
    const selectedIndex = getSelectedLegIndex(group);
    return group.legs[selectedIndex];
  };

  return (
    <div className="relative group my-2">
      {/* Left Arrow - Desktop only */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-card/90 hover:bg-card border border-border rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -ml-4"
          aria-label="Scroll left"
        >
          <svg
            className="w-4 h-4 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {legGroups.map((group) => {
          const displayedLeg = getDisplayedLeg(group);
          const selectedIndex = getSelectedLegIndex(group);

          return (
            <div
              key={group.journeyId || displayedLeg.leg_id}
              className={`flex-shrink-0 snap-start ${
                compact ? 'w-[200px] sm:w-[220px]' : 'w-[calc(50%-0.5rem)] sm:w-[280px]'
              }`}
            >
              <div className="relative">
                <LegListItem
                  leg={displayedLeg}
                  onClick={handleLegClick}
                  displayOptions={{
                    showCarousel: true,
                    showMatchBadge: false,
                    showLegName: true,
                    showJourneyName: false,
                    showLocations: true,
                    showDates: true,
                    showDuration: false,
                    showBoatInfo: false,
                    carouselHeight: compact ? 'h-24 sm:h-28' : 'h-32 sm:h-40',
                    compact: compact,
                  }}
                />
                {/* Join button overlay */}
                {onJoinClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoinClick(displayedLeg.leg_id, displayedLeg.leg_name);
                    }}
                    className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-md transition-colors z-10"
                    title={`Join ${displayedLeg.leg_name}`}
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                    Join
                  </button>
                )}
              </div>
              {/* Tab buttons for grouped legs */}
              {group.isGrouped && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  {group.legs.map((leg, legIndex) => (
                    <button
                      key={leg.leg_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLegIndex(group, legIndex);
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        legIndex === selectedIndex
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      title={`Leg ${legIndex + 1}: ${leg.leg_name}`}
                    >
                      {legIndex + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Swipe Hint */}
      {!hasScrolled && canScrollRight && legGroups.length > 1 && (
        <div className="flex md:hidden items-center justify-center gap-1.5 mt-1 text-xs text-muted-foreground animate-pulse">
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
              d="M7 16l-4-4m0 0l4-4m-4 4h18"
            />
          </svg>
          <span>Swipe for more</span>
        </div>
      )}

      {/* Right Arrow - Desktop only */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-card/90 hover:bg-card border border-border rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -mr-4"
          aria-label="Scroll right"
        >
          <svg
            className="w-4 h-4 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Hide scrollbar with CSS */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
