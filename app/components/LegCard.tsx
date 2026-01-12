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
  return (
    <div className="bg-card rounded-lg shadow p-4 mb-4">
      {/* Start and End Points */}
      <div className="flex items-center justify-between mb-4">
        {/* Start Point */}
        <div className="flex-1">
          {startWaypoint ? (
            <h3 className="text-sm font-semibold text-card-foreground">
              {startWaypoint.name || 'Unknown location'}
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
            <h3 className="text-sm font-semibold text-card-foreground">
              {endWaypoint.name || 'Unknown location'}
            </h3>
          ) : (
            <div className="text-xs text-muted-foreground">No end point</div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-border my-3"></div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onEdit}
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
          onClick={onSave}
          className="text-primary hover:opacity-80 transition-opacity p-1 cursor-pointer"
          aria-label="Save leg"
          title="Save leg"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            {/* Main floppy disk body */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z"
            />
            {/* Top-right corner clip */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 6v-2a1 1 0 00-1-1h-2"
            />
            {/* Central rectangle (metal shutter) */}
            <rect x="8" y="10" width="8" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            {/* Horizontal line across the top of the central rectangle */}
            <line x1="8" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          onClick={onDelete}
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
