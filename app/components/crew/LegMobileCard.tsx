'use client';

import Image from 'next/image';
import { formatDate } from '@/app/lib/dateFormat';

type Leg = {
  leg_id: string;
  leg_name: string;
  boat_name: string;
  boat_image_url: string | null;
  skipper_name: string | null;
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
};

export function LegMobileCard({ leg, onClose, onClick }: LegMobileCardProps) {
  const formatLocationName = (name: string | null) => {
    if (!name || name === 'Unknown location') {
      return 'Unknown location';
    }
    return name;
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md md:hidden"
      onClick={onClick}
    >
      <div className="bg-card rounded-lg shadow-xl border border-border p-3 flex items-start gap-3">
        {/* Boat Image */}
        {leg.boat_image_url ? (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src={leg.boat_image_url}
              alt={leg.boat_name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
              />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Boat Name with Skipper */}
          <h3 className="font-bold text-card-foreground mb-2 text-sm">
            {leg.boat_name}
            {leg.skipper_name && (
              <span className="font-normal"> with {leg.skipper_name}</span>
            )}
          </h3>

          {/* Locations and Dates */}
          <div className="flex items-start gap-2">
            {/* Start Location */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs text-card-foreground leading-tight">
                {formatLocationName(leg.start_waypoint?.name || null)}
              </div>
              {leg.start_date && (
                <div className="text-xs text-card-foreground mt-1 font-normal">
                  {formatDate(leg.start_date)}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 text-card-foreground pt-0.5">
              <span className="text-base">→</span>
            </div>

            {/* End Location */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs text-card-foreground leading-tight">
                {formatLocationName(leg.end_waypoint?.name || null)}
              </div>
              {leg.end_date && (
                <div className="text-xs text-card-foreground mt-1 font-normal">
                  {formatDate(leg.end_date)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 mt-0.5"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5"
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
        </button>
      </div>
    </div>
  );
}
