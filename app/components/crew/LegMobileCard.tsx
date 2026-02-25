'use client';

import { LegListItem, LegListItemData } from './LegListItem';
import { Button } from '@shared/ui/Button/Button';

type Leg = {
  leg_id: string;
  leg_name: string;
  journey_name?: string;
  boat_name: string;
  boat_image_url: string | null;
  boat_make_model: string | null;
  owner_name: string | null;
  owner_image_url: string | null;
  journey_images?: string[];
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
  start_date: string | null;
  end_date: string | null;
};

type LegMobileCardProps = {
  leg: Leg;
  onClose: () => void;
  onClick?: () => void; // Optional click handler to open full panel
  showMatchBadge?: boolean; // Only show when user is authenticated
  showBlurSkipperBoat?: boolean; // Blur boat/skipper when not authenticated
};

export function LegMobileCard({ leg, onClose, onClick, showMatchBadge = false, showBlurSkipperBoat = false }: LegMobileCardProps) {
  // Convert leg to LegListItemData format
  const legData: LegListItemData = {
    leg_id: leg.leg_id,
    leg_name: leg.leg_name,
    journey_name: leg.journey_name || leg.boat_name, // Fallback to boat name if no journey name
    start_date: leg.start_date,
    end_date: leg.end_date,
    journey_images: leg.journey_images || [],
    boat_name: leg.boat_name,
    boat_image_url: leg.boat_image_url,
    boat_make_model: leg.boat_make_model,
    skill_match_percentage: leg.skill_match_percentage,
    experience_level_matches: leg.experience_level_matches,
    start_waypoint: leg.start_waypoint,
    end_waypoint: leg.end_waypoint,
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md md:hidden">
      {/* Close Button - Outside and above the card */}
      <div className="absolute -top-12 right-0 z-10">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          variant="outline"
          className="flex items-center justify-center"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </div>

      {/* LegListItem (which renders its own Card) */}
      <LegListItem
        leg={legData}
        onClick={onClick ? () => onClick() : undefined}
        className="shadow-xl"
        displayOptions={{
          showCarousel: true,
          showMatchBadge,
          showLegName: true,
          showJourneyName: true,
          showLocations: true,
          showDates: true,
          showDuration: true,
          showBoatInfo: true,
          blurSkipperBoat: showBlurSkipperBoat,
          carouselHeight: 'h-48', // Taller carousel for mobile card
          compact: false,
        }}
      />
    </div>
  );
}
