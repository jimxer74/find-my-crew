'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LegListItem, LegListItemData } from './LegListItem';

type LegCarouselProps = {
  legs: LegListItemData[];
  onLegClick?: (leg: LegListItemData) => void;
  onJoinClick?: (leg: LegListItemData) => void;
  loading?: boolean;
  showMoreUrl?: string;
  maxLegsBeforeShowMore?: number;
};

export function LegCarousel({
  legs,
  onLegClick,
  onJoinClick,
  loading = false,
  showMoreUrl,
  maxLegsBeforeShowMore = 5,
}: LegCarouselProps) {
  const t = useTranslations('crewHome');
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Determine if we should show the "show more" card
  const showShowMoreCard = showMoreUrl && legs.length >= maxLegsBeforeShowMore;

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
  }, [legs]);

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

  if (legs.length === 0) {
    return null;
  }

  return (
    <div className="relative group">
      {/* Left Arrow - Desktop only */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-card/90 hover:bg-card border border-border rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -ml-5"
          aria-label="Scroll left"
        >
          <svg
            className="w-5 h-5 text-foreground"
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
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {legs.map((leg) => (
          <div
            key={leg.leg_id}
            className="flex-shrink-0 w-[calc(50%-0.5rem)] sm:w-[280px] snap-start relative"
          >
            <LegListItem
              leg={leg}
              onClick={onLegClick}
              displayOptions={{
                showCarousel: true,
                showMatchBadge: true,
                showLegName: true,
                showJourneyName: false,
                showLocations: true,
                showDates: true,
                showDuration: true,
                showBoatInfo: false,
                carouselHeight: 'h-32 sm:h-40',
                compact: true,
              }}
            />
            {onJoinClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoinClick(leg);
                }}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md shadow-md transition-colors z-10"
                title={t('joinLeg')}
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
                {t('join')}
              </button>
            )}
          </div>
        ))}

        {/* Show More Card */}
        {showShowMoreCard && (
          <div className="flex-shrink-0 w-[calc(50%-0.5rem)] sm:w-[280px] snap-start">
            <button
              onClick={() => router.push(showMoreUrl)}
              className="w-full h-32 sm:h-40 flex flex-col items-center justify-center gap-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
            >
              <svg
                className="w-8 h-8 text-muted-foreground"
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
              <span className="text-sm font-medium text-foreground">
                {t('showMoreOnMap')}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile Swipe Hint - shown only on first render when there are more items */}
      {!hasScrolled && canScrollRight && legs.length > 1 && (
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
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-card/90 hover:bg-card border border-border rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -mr-5"
          aria-label="Scroll right"
        >
          <svg
            className="w-5 h-5 text-foreground"
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
