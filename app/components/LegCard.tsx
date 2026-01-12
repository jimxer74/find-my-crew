'use client';

type Waypoint = {
  index: number;
  geocode: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  name?: string;
};

type LegCardProps = {
  startWaypoint: Waypoint | null;
  endWaypoint: Waypoint | null;
  onEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
};

export function LegCard({ startWaypoint, endWaypoint, onEdit, onSave, onDelete }: LegCardProps) {
  const formatCoordinate = (coord: number) => {
    return coord.toFixed(6);
  };

  return (
    <div className="bg-card rounded-lg shadow p-4 mb-4">
      {/* Start and End Points */}
      <div className="flex items-center justify-between mb-4">
        {/* Start Point */}
        <div className="flex-1">
          {startWaypoint ? (
            <>
              <h3 className="font-semibold text-card-foreground mb-2">
                {startWaypoint.name || 'Unknown location'}
              </h3>
              <div className="text-sm text-muted-foreground">
                <p>Lat: {formatCoordinate(startWaypoint.geocode.coordinates[1])}</p>
                <p>Lon: {formatCoordinate(startWaypoint.geocode.coordinates[0])}</p>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No start point</div>
          )}
        </div>

        {/* Arrow */}
        <div className="mx-4 text-foreground">
          <span className="text-xl">→</span>
        </div>

        {/* End Point */}
        <div className="flex-1">
          {endWaypoint ? (
            <>
              <h3 className="font-semibold text-card-foreground mb-2">
                {endWaypoint.name || 'Unknown location'}
              </h3>
              <div className="text-sm text-muted-foreground">
                <p>Lat: {formatCoordinate(endWaypoint.geocode.coordinates[1])}</p>
                <p>Lon: {formatCoordinate(endWaypoint.geocode.coordinates[0])}</p>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No end point</div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-border my-3"></div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <button
          onClick={onEdit}
          className="text-primary hover:opacity-80 transition-opacity"
        >
          Edit
        </button>
        <span className="text-border">|</span>
        <button
          onClick={onSave}
          className="text-primary hover:opacity-80 transition-opacity"
        >
          Save
        </button>
        <span className="text-border">|</span>
        <button
          onClick={onDelete}
          className="text-primary hover:opacity-80 transition-opacity"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
