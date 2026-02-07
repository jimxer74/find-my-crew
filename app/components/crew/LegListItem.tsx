'use client';

import { formatDate } from '@/app/lib/dateFormat';
import { MatchBadge } from '@/app/components/ui/MatchBadge';
import { ImageCarousel } from '@/app/components/ui/ImageCarousel';

// Leg type matching the codebase pattern
export type LegListItemData = {
  leg_id: string;
  leg_name: string;
  journey_id?: string;
  journey_name: string;
  start_date: string | null;
  end_date: string | null;
  journey_images: string[];
  boat_name: string;
  boat_image_url: string | null;
  boat_make?: string | null;
  boat_model?: string | null;
  skill_match_percentage?: number;
  experience_level_matches?: boolean;
  start_waypoint: {
    lng: number;
    lat: number;
    name: string | null;
  } | null;
  end_waypoint: {
    lng: number;
    lat: number;
    name: string | null;
  } | null;
};

// Configurable display options
export type LegListItemDisplayOptions = {
  showCarousel?: boolean;        // Show image carousel (default: true)
  showMatchBadge?: boolean;      // Show match percentage badge (default: true)
  showLegName?: boolean;         // Show leg name (default: true)
  showJourneyName?: boolean;     // Show journey name (default: true)
  showLocations?: boolean;       // Show start/end locations (default: true)
  showDates?: boolean;           // Show dates (default: true)
  showDuration?: boolean;        // Show duration (default: true)
  showBoatInfo?: boolean;        // Show boat name/make/model (default: false)
  carouselHeight?: string;       // Custom carousel height (default: 'h-40')
  compact?: boolean;             // Compact mode for smaller display (default: false)
};

type LegListItemProps = {
  leg: LegListItemData;
  onClick?: (leg: LegListItemData) => void;
  displayOptions?: LegListItemDisplayOptions;
  className?: string;
};

// Helper to calculate duration in days
function calculateDuration(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : null;
}

// Helper to format location name
function formatLocationName(name: string | null): string {
  if (!name || name === 'Unknown location') {
    return 'Unknown';
  }
  // Truncate long names
  return name.length > 25 ? name.substring(0, 22) + '...' : name;
}

// Helper to format duration string
function formatDuration(days: number | null): string {
  if (days === null) return '';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export function LegListItem({
  leg,
  onClick,
  displayOptions = {},
  className = ''
}: LegListItemProps) {
  // Merge with defaults
  const options: Required<LegListItemDisplayOptions> = {
    showCarousel: true,
    showMatchBadge: true,
    showLegName: true,
    showJourneyName: true,
    showLocations: true,
    showDates: true,
    showDuration: true,
    showBoatInfo: false,
    carouselHeight: 'h-40',
    compact: false,
    ...displayOptions
  };

  // Combine journey images + boat image for carousel
  const allImages: string[] = [];
  if (leg.journey_images && leg.journey_images.length > 0) {
    allImages.push(...leg.journey_images);
  }
  if (leg.boat_image_url) {
    allImages.push(leg.boat_image_url);
  }

  const duration = calculateDuration(leg.start_date, leg.end_date);
  const hasMatchPercentage = typeof leg.skill_match_percentage === 'number';

  const handleClick = () => {
    if (onClick) {
      onClick(leg);
    }
  };

  return (
    <div
      className={`bg-card rounded-lg shadow-md border border-border overflow-hidden transition-all hover:shadow-lg ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
    >
      {/* Image Carousel Section */}
      {options.showCarousel && (
        <div className={`relative ${options.carouselHeight}`}>
          {allImages.length > 0 ? (
            <div className="relative w-full h-full" onClick={(e) => e.stopPropagation()}>
              <ImageCarousel
                images={allImages}
                alt={leg.leg_name}
                height={options.carouselHeight}
                showThumbnails={false}
                showDots={true}
                showArrows={true}
              />
            </div>
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <svg
                className="w-12 h-12 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* Match Badge Overlay */}
          {options.showMatchBadge && hasMatchPercentage && (
            <div className="absolute top-2 left-2 z-10">
              <MatchBadge
                percentage={leg.skill_match_percentage!}
                showLabel={true}
                size="sm"
                className="shadow-lg"
              />
            </div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className={`${options.compact ? 'p-2' : 'p-3'}`}>
        {/* Leg Name */}
        {options.showLegName && (
          <h3 className={`font-semibold text-card-foreground truncate ${options.compact ? 'text-sm' : 'text-base'}`}>
            {leg.leg_name}
          </h3>
        )}

        {/* Journey Name */}
        {options.showJourneyName && (
          <p className={`text-muted-foreground truncate ${options.compact ? 'text-xs' : 'text-sm'}`}>
            {leg.journey_name}
          </p>
        )}

        {/* Boat Info */}
        {options.showBoatInfo && (
          <p className={`text-muted-foreground truncate ${options.compact ? 'text-xs mt-0.5' : 'text-sm mt-1'}`}>
            {leg.boat_name}
            {(leg.boat_make || leg.boat_model) && (
              <span className="text-muted-foreground/70">
                {' '}({leg.boat_make} {leg.boat_model})
              </span>
            )}
          </p>
        )}

        {/* Locations */}
        {options.showLocations && (
          <div className={`flex items-center gap-1 ${options.compact ? 'mt-1 text-xs' : 'mt-2 text-sm'}`}>
            <span className="text-card-foreground truncate flex-1">
              {formatLocationName(leg.start_waypoint?.name || null)}
            </span>
            <span className="text-muted-foreground flex-shrink-0">→</span>
            <span className="text-card-foreground truncate flex-1 text-right">
              {formatLocationName(leg.end_waypoint?.name || null)}
            </span>
          </div>
        )}

        {/* Dates and Duration */}
        {(options.showDates || options.showDuration) && (
          <div className={`flex items-center justify-between ${options.compact ? 'mt-1 text-xs' : 'mt-2 text-sm'} text-muted-foreground`}>
            {options.showDates && (
              <span>
                {leg.start_date ? formatDate(leg.start_date) : 'TBD'}
                {leg.end_date && ` - ${formatDate(leg.end_date)}`}
              </span>
            )}
            {options.showDuration && duration && (
              <span className={`${options.compact ? 'text-xs' : 'text-sm'} font-medium text-primary`}>
                {formatDuration(duration)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
