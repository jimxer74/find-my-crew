'use client';

import { useState, useRef, useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@shared/ui';
import { RegistrationCard } from './RegistrationCard';

type Status = 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';

interface Registration {
  id: string;
  status: Status;
  created_at: string;
  legs: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    journeys: {
      id: string;
      name: string;
    };
  };
  profiles: {
    full_name: string | null;
    username: string | null;
    profile_image_url: string | null;
  };
}

interface RegistrationsCarouselProps {
  registrations: Registration[];
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string, selected: boolean) => void;
  groupMessageSentCount?: number | null;
  onGroupMessageSentCountChange?: (count: number | null) => void;
}

export function RegistrationsCarousel({
  registrations,
  selectedIds,
  onSelectionChange,
  groupMessageSentCount,
  onGroupMessageSentCountChange,
}: RegistrationsCarouselProps) {
  const [expandedLegs, setExpandedLegs] = useState<Set<string>>(new Set());
  const scrollContainerRefs = useRef<Record<string, HTMLDivElement>>({});

  // Group registrations by leg
  const groupedByLeg = useMemo(() => {
    const map = new Map<string, { legName: string; legId: string; journeyName: string; registrations: Registration[] }>();

    for (const reg of registrations) {
      const legId = reg.legs.id;
      const legName = reg.legs.name;
      const journeyName = reg.legs.journeys.name;

      if (!map.has(legId)) {
        map.set(legId, { legName, legId, journeyName, registrations: [] });
      }
      map.get(legId)!.registrations.push(reg);
    }

    return Array.from(map.values());
  }, [registrations]);

  const toggleLeg = (legId: string) => {
    setExpandedLegs((prev) => {
      const next = new Set(prev);
      if (next.has(legId)) {
        next.delete(legId);
      } else {
        next.add(legId);
      }
      return next;
    });
  };

  const scroll = (direction: 'left' | 'right', legId: string) => {
    const container = scrollContainerRefs.current[legId];
    if (!container) return;

    const scrollAmount = 320; // Width of one card + gap
    const currentScroll = container.scrollLeft;
    const targetScroll = direction === 'left'
      ? currentScroll - scrollAmount
      : currentScroll + scrollAmount;

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });
  };

  if (registrations.length === 0) {
    return (
      <div className="w-full py-12 px-4 text-center">
        <p className="text-muted-foreground">No registrations found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-6 md:px-0">
      {groupMessageSentCount !== null && (
        <div className="px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-700 dark:text-green-400 flex items-center justify-between">
          <span>Message sent to {groupMessageSentCount} {groupMessageSentCount === 1 ? 'recipient' : 'recipients'}.</span>
          <button
            onClick={() => onGroupMessageSentCountChange?.(null)}
            className="text-muted-foreground hover:text-foreground ml-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {groupedByLeg.map((group) => (
        <div key={group.legId} className="space-y-3">
          {/* Leg Header - Collapsible */}
          <button
            onClick={() => toggleLeg(group.legId)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <ChevronDown
              className={`w-5 h-5 text-muted-foreground transition-transform ${
                expandedLegs.has(group.legId) ? 'rotate-0' : '-rotate-90'
              }`}
            />
            <div className="text-left flex-1">
              <h3 className="font-semibold text-foreground">{group.journeyName}</h3>
              <p className="text-sm text-muted-foreground">{group.legName}</p>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{group.registrations.length}</span>
          </button>

          {/* Carousel for registrations within this leg */}
          {expandedLegs.has(group.legId) && (
            <div className="relative group">
              {/* Scroll Left Button - Hidden on mobile, shown on desktop when there's overflow */}
              <Button
                onClick={() => scroll('left', group.legId)}
                variant="outline"
                size="sm"
                className="hidden md:absolute left-0 top-1/2 -translate-y-1/2 z-10 !w-10 !h-10 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 !p-0"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              {/* Scroll Right Button */}
              <Button
                onClick={() => scroll('right', group.legId)}
                variant="outline"
                size="sm"
                className="hidden md:absolute right-0 top-1/2 -translate-y-1/2 z-10 !w-10 !h-10 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 !p-0"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>

              {/* Scrollable Cards Container */}
              <div
                ref={(el) => {
                  if (el) scrollContainerRefs.current[group.legId] = el;
                }}
                className="
                  flex gap-3 overflow-x-auto
                  pb-2
                  snap-x snap-mandatory
                  scrollbar-hide
                  md:scrollbar-default
                  -mx-4 px-4 md:mx-0 md:px-0
                "
                style={{
                  scrollbarWidth: 'thin',
                }}
              >
                {group.registrations.map((registration) => (
                  <div
                    key={registration.id}
                    className="snap-start flex-shrink-0 w-[calc(50%-6px)] sm:w-[280px]"
                  >
                    <RegistrationCard
                      registration={registration}
                      isSelected={selectedIds?.has(registration.id) ?? false}
                      onSelectionChange={onSelectionChange}
                    />
                  </div>
                ))}
              </div>

              {/* Navigation hint for mobile */}
              <div className="md:hidden mt-2 px-4">
                <p className="text-xs text-center text-muted-foreground">
                  Swipe to see more registrations
                </p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// CSS for hiding scrollbar on mobile
const style = `
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = style;
  document.head.appendChild(styleEl);
}
