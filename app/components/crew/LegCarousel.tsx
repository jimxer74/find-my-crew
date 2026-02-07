'use client';

import { useRef, useState, useEffect } from 'react';
import { LegListItem, LegListItemData } from './LegListItem';

type LegCarouselProps = {
  legs: LegListItemData[];
  onLegClick?: (leg: LegListItemData) => void;
  loading?: boolean;
};

export function LegCarousel({ legs, onLegClick, loading = false }: LegCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to show/hide arrows
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
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
            className="flex-shrink-0 w-[calc(50%-0.5rem)] sm:w-[280px] snap-start"
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
          </div>
        ))}
      </div>

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
