'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LegListItem, LegListItemData } from './LegListItem';
import { RegistrationStatusBadge } from './RegistrationStatusBadge';
import { useUserRegistrations } from '@/app/hooks/useUserRegistrations';
import { Button } from '@shared/ui/Button/Button';

type LegCarouselProps = {
  legs: LegListItemData[];
  onLegClick?: (leg: LegListItemData) => void;
  onJoinClick?: (leg: LegListItemData) => void;
  loading?: boolean;
  showMoreUrl?: string;
  maxLegsBeforeShowMore?: number;
  showMatchBadge?: boolean; // Only show when user is authenticated
};

// Group legs by journey ID
type LegGroup = {
  journeyId: string | null; // null for single legs without journey
  legs: LegListItemData[];
  isGrouped: boolean; // true if multiple legs, false if single leg
};

export function LegCarousel({
  legs,
  onLegClick,
  onJoinClick,
  loading = false,
  showMoreUrl,
  maxLegsBeforeShowMore = 5,
  showMatchBadge = false,
}: LegCarouselProps) {
  const t = useTranslations('crewHome');
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  // Track selected leg index per journey group (key: journeyId or leg_id for single legs)
  const [selectedLegIndices, setSelectedLegIndices] = useState<Map<string, number>>(new Map());

  // Load user's registrations once on mount
  const { getRegistrationStatus } = useUserRegistrations();

  // Determine if we should show the "show more" card
  const showShowMoreCard = showMoreUrl && legs.length >= maxLegsBeforeShowMore;

  // Group legs by journey_id
  const legGroups = useMemo<LegGroup[]>(() => {
    const groups: LegGroup[] = [];
    const journeyMap = new Map<string | null, LegListItemData[]>();

    // Group legs by journey_id
    legs.forEach((leg) => {
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
  }, [legs]);

  // Check scroll position to show/hide arrows
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    // Hide swipe hint after user has scrolled
    if (scrollLeft > 20 && !hasScrolled) {
      setHasScrolled(true);
    }
  };

  useEffect(() => {
    checkScrollPosition();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      // Also check on resize
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

    // Scroll by approximately 2 card widths
    const cardWidth = 280; // Approximate card width including gap
    const scrollAmount = cardWidth * 2;

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (loading) {
    // Skeleton loading state
    return (
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[calc(50%-0.5rem)] sm:w-[280px] animate-pulse"
          >
            <div className="bg-muted rounded-lg h-40 mb-2" />
            <div className="bg-muted rounded h-4 w-3/4 mb-1" />
            <div className="bg-muted rounded h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
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

  if (legs.length === 0) {
    return null;
  }

  return (
    <div className="relative group">
      {/* Left Arrow - Desktop only */}
      {canScrollLeft && (
        <Button
          onClick={() => scroll('left')}
          variant="outline"
          size="sm"
          className="hidden md:absolute left-0 top-1/2 -translate-y-1/2 z-10 !w-10 !h-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -ml-5 !p-0 flex-shrink-0"
          aria-label="Scroll left"
        >
          <svg
            className="w-5 h-5"
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
        </Button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
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
              className="flex-shrink-0 w-[calc(50%-0.5rem)] sm:w-[280px] snap-start"
            >
              {(() => {
                const registrationStatus = getRegistrationStatus(displayedLeg.leg_id);

                // Render join button or status badge
                const rightBadge = onJoinClick ? (
                  registrationStatus ? (
                    <RegistrationStatusBadge status={registrationStatus} />
                  ) : (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onJoinClick(displayedLeg);
                      }}
                      variant="primary"
                      size="sm"
                      className="!text-xs flex-shrink-0"
                      title={t('joinLeg')}
                      leftIcon={
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
                      }
                    >
                      {t('join')}
                    </Button>
                  )
                ) : null;

                return (
                  <LegListItem
                    leg={displayedLeg}
                    onClick={onLegClick}
                    displayOptions={{
                      showCarousel: true,
                      showMatchBadge,
                      showLegName: true,
                      showJourneyName: false,
                      showLocations: true,
                      showDates: true,
                      showDuration: true,
                      showBoatInfo: false,
                      carouselHeight: 'h-32 sm:h-40',
                      compact: true,
                    }}
                    rightBadge={rightBadge}
                  />
                );
              })()}
              {/* Tab buttons for grouped legs */}
              {group.isGrouped && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  {group.legs.map((leg, legIndex) => (
                    <Button
                      key={leg.leg_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLegIndex(group, legIndex);
                      }}
                      variant={legIndex === selectedIndex ? 'primary' : 'secondary'}
                      size="sm"
                      className="!text-xs !px-2 !py-1"
                      title={`Leg ${legIndex + 1}: ${leg.leg_name}`}
                    >
                      {legIndex + 1}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Show More Card */}
        {showShowMoreCard && (
          <div className="flex-shrink-0 w-[calc(50%-0.5rem)] sm:w-[280px] snap-start">
            <button
              onClick={() => router.push(showMoreUrl)}
              className="w-full h-32 sm:h-40 flex flex-col items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent active:bg-accent/50 transition-colors font-medium text-foreground"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <span className="text-sm font-medium whitespace-nowrap">
                {t('showMoreOnMap')}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile Swipe Hint - shown only on first render when there are more items */}
      {!hasScrolled && canScrollRight && legGroups.length > 1 && (
        <div className="flex md:hidden items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground animate-pulse">
          <svg
            className="w-4 h-4"
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
          <span>{t('swipeForMore')}</span>
        </div>
      )}

      {/* Right Arrow - Desktop only */}
      {canScrollRight && (
        <Button
          onClick={() => scroll('right')}
          variant="outline"
          size="sm"
          className="hidden md:absolute right-0 top-1/2 -translate-y-1/2 z-10 !w-10 !h-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -mr-5 !p-0 flex-shrink-0"
          aria-label="Scroll right"
        >
          <svg
            className="w-5 h-5"
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
        </Button>
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
