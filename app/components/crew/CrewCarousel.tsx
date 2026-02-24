'use client';

/**
 * CrewCarousel Component
 * 
 * Displays crew members in a horizontal scrolling carousel.
 * Features:
 * - Touch/swipe support for mobile
 * - Keyboard navigation (arrow keys)
 * - Responsive grid on desktop
 * - Loading and empty states
 */

import React, { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import CrewCard from './CrewCard';

interface CrewMember {
  id: string;
  name: string | null;
  image_url: string | null;
  experience_level: number;
  risk_levels: string[];
  skills: string[];
  location: string;
  matchScore: number;
  availability?: string;
  requiredSkills?: string[];
}

interface CrewCarouselProps {
  crewMembers: CrewMember[];
  loading?: boolean;
  onCrewClick?: (crewId: string) => void;
  title?: string;
  subtitle?: string;
  requiredSkills?: string[];
}

export default function CrewCarousel({
  crewMembers,
  loading = false,
  onCrewClick,
  title = 'Matching Crew Members',
  subtitle,
  requiredSkills,
}: CrewCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!scrollContainerRef.current) return;
      
      if (e.key === 'ArrowLeft') {
        scroll('left');
      } else if (e.key === 'ArrowRight') {
        scroll('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const scrollAmount = 320; // Width of one card + gap
    const currentScroll = scrollContainerRef.current.scrollLeft;
    const targetScroll = direction === 'left'
      ? currentScroll - scrollAmount
      : currentScroll + scrollAmount;
    
    scrollContainerRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full py-8">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          <span>Searching for matching crew...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!crewMembers || crewMembers.length === 0) {
    return (
      <div className="w-full py-12 px-4">
        <div className="flex flex-col items-center justify-center gap-4 text-gray-500">
          <Users className="w-16 h-16 text-gray-300" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-1">
              No crew members found
            </h3>
            <p className="text-sm text-gray-600">
              Try adjusting your search criteria or check back later
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-6">
      {/* Header */}
      <div className="mb-4 px-4 md:px-0">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {subtitle && (
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Found {crewMembers.length} matching crew member{crewMembers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Carousel Container */}
      <div className="relative group">
        {/* Scroll Left Button - Hidden on mobile, shown on desktop when there's overflow */}
        <button
          onClick={() => scroll('left')}
          className="
            hidden md:flex
            absolute left-0 top-1/2 -translate-y-1/2 z-10
            w-10 h-10 items-center justify-center
            bg-white/90 hover:bg-white
            border border-gray-300 rounded-full shadow-md
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            disabled:opacity-0 disabled:cursor-not-allowed
          "
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        {/* Scroll Right Button */}
        <button
          onClick={() => scroll('right')}
          className="
            hidden md:flex
            absolute right-0 top-1/2 -translate-y-1/2 z-10
            w-10 h-10 items-center justify-center
            bg-white/90 hover:bg-white
            border border-gray-300 rounded-full shadow-md
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            disabled:opacity-0 disabled:cursor-not-allowed
          "
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>

        {/* Scrollable Cards Container */}
        <div
          ref={scrollContainerRef}
          className="
            flex gap-4 overflow-x-auto
            px-4 md:px-0
            pb-4
            snap-x snap-mandatory
            scrollbar-hide
            md:scrollbar-default
          "
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 #f1f5f9',
          }}
        >
          {crewMembers.map((crew) => (
            <div key={crew.id} className="snap-start flex-shrink-0">
              <CrewCard
                {...crew}
                requiredSkills={requiredSkills || crew.requiredSkills}
                onClick={onCrewClick}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation hint for mobile */}
      <div className="md:hidden mt-2 px-4">
        <p className="text-xs text-center text-gray-500">
          Swipe to see more crew members
        </p>
      </div>
    </div>
  );
}

// Add CSS for hiding scrollbar on mobile
const style = `
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-default {
    scrollbar-width: thin;
  }
`;

// Inject styles if not already present
if (typeof window !== 'undefined' && !document.getElementById('crew-carousel-styles')) {
  const styleTag = document.createElement('style');
  styleTag.id = 'crew-carousel-styles';
  styleTag.textContent = style;
  document.head.appendChild(styleTag);
}
