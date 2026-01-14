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
  legName,
  journeyName,
  onClose
}: LegDetailsCardProps) {
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
      return <span className="text-xs font-semibold text-card-foreground">{name || 'Unknown location'}</span>;
    }
    
    // Split by comma to separate city and country
    const parts = name.split(',').map(part => part.trim());
    
    if (parts.length >= 2) {
      const city = parts[0];
      const country = parts.slice(1).join(', '); // Handle cases with multiple commas
      return (
        <span className="text-xs text-card-foreground">
          <span className="font-semibold">{city}</span>
          {country && <span className="font-normal">, {country}</span>}
        </span>
      );
    }
    
    // If no comma, just show the name in bold
    return <span className="text-xs font-semibold text-card-foreground">{name}</span>;
  };

  return (
    <div className="bg-card rounded-lg shadow-lg p-4 max-w-md mx-auto relative">
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors p-1"
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
      )}

      {/* Journey and Leg Name */}
      {(journeyName || legName) && (
        <div className="mb-3 pb-3 border-b border-border">
          {journeyName && (
            <div className="text-sm font-semibold text-card-foreground mb-1">
              {journeyName}
            </div>
          )}
          {legName && (
            <div className="text-xs text-muted-foreground">
              {legName}
            </div>
          )}
        </div>
      )}

      {/* Start and End Points */}
      <div className="flex items-center justify-between mb-4">
        {/* Start Point */}
        <div className="flex-1">
          {startWaypoint ? (
            <h3 className="text-card-foreground">
              {formatLocationName(startWaypoint.name || 'Unknown location')}
            </h3>
          ) : (
            <div className="text-xs text-muted-foreground">No start point</div>
          )}
        </div>

        {/* Arrow */}
        <div className="mx-4 text-foreground">
          <span className="text-lg">→</span>
        </div>

        {/* End Point */}
        <div className="flex-1">
          {endWaypoint ? (
            <h3 className="text-card-foreground">
              {formatLocationName(endWaypoint.name || 'Unknown location')}
            </h3>
          ) : (
            <div className="text-xs text-muted-foreground">No end point</div>
          )}
        </div>
      </div>

      {/* Dates Section */}
      <div className="mb-3">
        <div className="grid grid-cols-2 gap-4 pb-3 border-b border-border">
          {/* Start Date */}
          <div>
            <div className="text-sm font-medium text-card-foreground">
              {formatDate(startDate)}
            </div>
          </div>

          {/* End Date */}
          <div>
            <div className="text-sm font-medium text-card-foreground">
              {formatDate(endDate)}
            </div>
          </div>
        </div>

        {/* Duration and Distance */}
        <div className="grid grid-cols-2 gap-4 pt-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Duration</div>
            <div className="text-sm font-medium text-card-foreground">
              {durationHours !== null ? formatDuration(durationHours) : 'N/A'}
              {boatSpeed && distanceNM !== null && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({Math.round(distanceNM)}nm @ {boatSpeed}kt)
                </span>
              )}
            </div>
          </div>
          {distanceNM !== null && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Distance</div>
              <div className="text-sm font-medium text-card-foreground">
                {Math.round(distanceNM)} nm
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
