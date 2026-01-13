'use client';

type Waypoint = {
  index: number;
  geocode: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  name?: string;
};

type EditLegCardProps = {
  startWaypoint: Waypoint | null;
  endWaypoint: Waypoint | null;
  startDate?: string | null;
  endDate?: string | null;
  boatSpeed?: number | null; // Average speed in knots
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
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

export function EditLegCard({ 
  startWaypoint, 
  endWaypoint, 
  startDate, 
  endDate, 
  boatSpeed,
  onEdit, 
  onDelete, 
  onClick, 
  isSelected = false, 
  cardRef 
}: EditLegCardProps) {
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
    <div
      ref={cardRef || undefined}
      onClick={onClick}
      className={`bg-card rounded-lg shadow p-4 mb-4 cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-primary border-2 border-primary' : ''
      }`}
    >
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

      {/* Dates and Duration Section */}
      <div className="border-t border-border pt-3 mb-3">
        <div className="grid grid-cols-2 gap-4 mb-2">
          {/* Start Date */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Start Date</div>
            <div className="text-sm font-medium text-card-foreground">
              {startDate ? new Date(startDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              }) : 'Not set'}
            </div>
          </div>

          {/* End Date */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">End Date</div>
            <div className="text-sm font-medium text-card-foreground">
              {endDate ? new Date(endDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              }) : 'Not set'}
            </div>
          </div>
        </div>

        {/* Duration and Distance */}
        <div className="grid grid-cols-2 gap-4">
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

      {/* Separator */}
      <div className="border-t border-border my-3"></div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="text-primary hover:opacity-80 transition-opacity p-1 cursor-pointer"
          aria-label="Edit leg"
          title="Edit leg"
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="text-primary hover:opacity-80 transition-opacity p-1 cursor-pointer"
          aria-label="Delete leg"
          title="Delete leg"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
