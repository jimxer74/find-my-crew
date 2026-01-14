'use client';

import { formatDate } from '@/app/lib/dateFormat';

type Waypoint = {
  index: number;
  geocode: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  name?: string;
};

type LegDetailsCardProps = {
  startWaypoint: Waypoint | null;
  endWaypoint: Waypoint | null;
  startDate?: string | null;
  endDate?: string | null;
  boatSpeed?: number | null; // Average speed in knots
  boatImageUrl?: string | null; // Boat image URL
  legName?: string | null;
  journeyName?: string | null;
  onClose?: () => void;
};

// Calculate distance between two coordinates using Haversine formula (nautical miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440; // Earth's radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate duration in hours based on distance and speed
function calculateDuration(distanceNM: number, speedKnots: number | null): number | null {
  if (!speedKnots || speedKnots <= 0) return null;
  // Account for 70-80% efficiency due to conditions
  const effectiveSpeed = speedKnots * 0.75;
  return distanceNM / effectiveSpeed;
}

// Format duration as human-readable string
function formatDuration(hours: number | null): string {
  if (hours === null) return 'N/A';
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) {
    return `${days}d`;
  }
  return `${days}d ${remainingHours}h`;
}

export function LegDetailsCard({ 
  startWaypoint, 
  endWaypoint, 
  startDate, 
  endDate, 
  boatSpeed,
  boatImageUrl,
  legName,
  journeyName,
  onClose
}: LegDetailsCardProps) {
  // Debug: Log boat image URL
  console.log('LegDetailsCard - boatImageUrl:', boatImageUrl);
  console.log('LegDetailsCard - boatSpeed:', boatSpeed);
  
  // Calculate distance and duration
  let distanceNM: number | null = null;
  let durationHours: number | null = null;
  
  if (startWaypoint && endWaypoint && startWaypoint.geocode.coordinates && endWaypoint.geocode.coordinates) {
    const [lng1, lat1] = startWaypoint.geocode.coordinates;
    const [lng2, lat2] = endWaypoint.geocode.coordinates;
    distanceNM = calculateDistance(lat1, lng1, lat2, lng2);
    durationHours = calculateDuration(distanceNM, boatSpeed || null);
  }

  const formatLocationName = (name: string) => {
    if (!name || name === 'Unknown location') {
      return <span className="text-sm font-semibold text-card-foreground">{name || 'Unknown location'}</span>;
    }
    
    // Split by comma to separate city and country
    const parts = name.split(',').map(part => part.trim());
    
    if (parts.length >= 2) {
      const city = parts[0];
      const country = parts.slice(1).join(', ');
      return (
        <span className="text-sm text-card-foreground">
          <span className="font-semibold">{city}</span>
          {country && <span className="font-normal">, {country}</span>}
        </span>
      );
    }
    
    // If no comma, just show the name in bold
    return <span className="text-sm font-semibold text-card-foreground">{name}</span>;
  };

  return (
    <div className="bg-card rounded-lg shadow-lg overflow-hidden max-w-sm mx-auto relative">
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-20 text-white bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors backdrop-blur-sm"
          aria-label="Close"
        >
          <svg
            className="w-4 h-4"
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
      )}

      {/* Boat Image Section */}
      <div className="relative w-full h-48 bg-muted">
        {boatImageUrl ? (
          <>
            {/* Debug info */}
            {console.log('Rendering boat image with URL:', boatImageUrl)}
            <img
              src={boatImageUrl}
              alt={journeyName || 'Boat'}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Error loading boat image:', boatImageUrl, e);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
              onLoad={() => {
                console.log('Boat image loaded successfully:', boatImageUrl);
              }}
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <div className="text-white/70 text-sm">No boat image available</div>
            <svg className="w-16 h-16 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
        
        {/* Journey Name Overlay - Top */}
        {journeyName && (
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 pt-6">
            <h2 className="text-xl font-bold text-white drop-shadow-lg">
              {journeyName}
            </h2>
          </div>
        )}

        {/* Duration and Distance Tags - Bottom Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pb-3">
          <div className="flex gap-2 flex-wrap">
            {durationHours !== null && (
              <span className="bg-white/90 backdrop-blur-sm text-card-foreground px-3 py-1 rounded-full text-sm font-medium">
                {formatDuration(durationHours)}
              </span>
            )}
            {distanceNM !== null && (
              <span className="bg-white/90 backdrop-blur-sm text-card-foreground px-3 py-1 rounded-full text-sm font-medium">
                {Math.round(distanceNM)} nm
              </span>
            )}
          </div>
        </div>
      </div>

      {/* White Content Section */}
      <div className="bg-card p-4">
        <div className="flex items-center">
          {/* Left Column - Start */}
          <div className="flex-1 flex flex-col">
            {/* Start Point */}
            <div className="mb-2">
              {startWaypoint ? (
                <div>
                  {formatLocationName(startWaypoint.name || 'Unknown location')}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No start point</div>
              )}
            </div>
            {/* Start Date */}
            <div>
              <div className="text-sm font-medium text-card-foreground">
                {formatDate(startDate)}
              </div>
            </div>
          </div>

          {/* Arrow - Centered Vertically */}
          <div className="mx-4 text-foreground flex items-center self-center">
            <span className="text-lg">→</span>
          </div>

          {/* Right Column - End */}
          <div className="flex-1 flex flex-col text-right">
            {/* End Point */}
            <div className="mb-2">
              {endWaypoint ? (
                <div>
                  {formatLocationName(endWaypoint.name || 'Unknown location')}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No end point</div>
              )}
            </div>
            {/* End Date */}
            <div>
              <div className="text-sm font-medium text-card-foreground">
                {formatDate(endDate)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
