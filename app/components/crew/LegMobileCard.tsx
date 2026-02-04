'use client';

import Image from 'next/image';
import { formatDate } from '@/app/lib/dateFormat';
import { useAuth } from '@/app/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { checkProfile } from '@/app/lib/profile/checkProfile';

type Leg = {
  leg_id: string;
  leg_name: string;
  boat_name: string;
  boat_image_url: string | null;
  boat_make: string | null;
  boat_model: string | null;
  owner_name: string | null;
  owner_image_url: string | null;
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
  const { user } = useAuth();
  const [profileStatus, setProfileStatus] = useState<{ exists: boolean; completionPercentage: number } | null>(null);

  useEffect(() => {
    if (!user) {
      setProfileStatus({ exists: false, completionPercentage: 0 });
      return;
    }

    const loadProfileStatus = async () => {
      const status = await checkProfile(user.id);
      setProfileStatus({ exists: status.exists, completionPercentage: status.completionPercentage });
    };

    loadProfileStatus();
  }, [user]);

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
      {/* Close Button Overlay on Image */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute -top-12 right-0 z-10 bg-card border border-border rounded-md p-2 min-w-[44px] min-h-[44px] flex items-center justify-center shadow-sm hover:bg-accent transition-all md:hidden cursor-pointer"
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
      </button>
      <div className="bg-card rounded-lg shadow-xl border border-border flex items-stretch overflow-hidden">
        {/* Boat Image Container - No padding on left, top, or bottom */}
        <div className="relative flex-shrink-0 flex items-stretch" style={{ width: '96px' }}>
          {leg.boat_image_url ? (
            <div className="relative w-full flex-1 overflow-hidden">
              <Image
                src={leg.boat_image_url}
                alt={leg.boat_name}
                fill
                className="object-cover"
                style={{ 
                  borderRadius: '0.5rem 0 0 0.5rem',
                }}
              />
            </div>
          ) : (
            <div className="relative w-full flex-1 bg-muted flex items-center justify-center overflow-hidden" style={{ borderRadius: '0.5rem 0 0 0.5rem' }}>
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
              {/* Close Button Overlay on Placeholder */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="absolute top-2 left-2 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-white transition-colors shadow-sm z-10"
                aria-label="Close"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 px-3 py-2 flex flex-col">
          {/* Top Section: Boat Info (Left) and Skipper (Right) */}
          <div className="flex grid grid-cols-2 gap-2 mb-2">
            {/* Boat Information - Left Side */}
            {leg.boat_name && (
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-card-foreground leading-tight truncate" title={leg.boat_name}>
                  {leg.boat_name}
                </div>
                {(leg.boat_make || leg.boat_model) && (
                  <div className="text-xs text-muted-foreground leading-tight truncate">
                    {leg.boat_make && leg.boat_model ? `${leg.boat_make} ${leg.boat_model}` : leg.boat_make || leg.boat_model || ''}
                  </div>
                )}
              </div>
            )}
            
            {/* Skipper Avatar and Name - Right Side */}
            {profileStatus?.exists && (leg.owner_name || leg.owner_image_url) && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {leg.owner_image_url ? (
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border">
                    <Image
                      src={leg.owner_image_url}
                      alt={leg.owner_name || 'Owner'}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                )}
                {leg.owner_name && (
                  <div className="flex flex-col">
                    <p className="text-xs font-medium text-foreground leading-tight">Skipper:</p>
                    <p className="text-xs text-muted-foreground leading-tight max-w-[80px] truncate" title={leg.owner_name}>
                      {leg.owner_name}
                    </p>
                  </div>
                )}
              </div>
            )}
            {/* Empty avatar for incomplete profiles - no text */}
            {(!profileStatus?.exists ) && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Separator Line */}
          <div className="border-t border-border mb-2"></div>

          {/* Locations and Dates */}
          <div className="flex items-start gap-2">
            {/* Start Location */}
            <div className="flex-1 min-w-0">
              <div className="font-normal text-xs text-card-foreground leading-tight">
                {formatLocationName(leg.start_waypoint?.name || null)}
              </div>
              {leg.start_date && profileStatus?.exists && profileStatus.completionPercentage === 100 && (
                <div className="text-xs text-card-foreground mt-1 font-normal">
                  {formatDate(leg.start_date)}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 text-card-foreground flex items-center self-stretch pl-2 pr-2">
              <span className="text-base">→</span>
            </div>

            {/* End Location */}
            <div className="flex-1 min-w-0 text-left">
              <div className="font-normal text-xs text-card-foreground leading-tight">
                {formatLocationName(leg.end_waypoint?.name || null)}
              </div>
              {leg.end_date && profileStatus?.exists && profileStatus.completionPercentage === 100 && (
                <div className="text-xs text-card-foreground mt-1 font-normal">
                  {formatDate(leg.end_date)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
