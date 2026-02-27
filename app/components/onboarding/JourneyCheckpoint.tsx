'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@shared/ui/Button/Button';

interface JourneyData {
  fromLocation?: string | null;
  toLocation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface JourneyCheckpointProps {
  journey: JourneyData | null;
  onSkip: () => void;
}

export function JourneyCheckpoint({ journey, onSkip }: JourneyCheckpointProps) {
  const router = useRouter();

  const hasJourneyInfo = journey?.fromLocation || journey?.toLocation;

  const handleCreate = () => {
    router.push('/owner/journeys/new');
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground">Create your first journey?</h3>
      </div>

      <div className="px-5 py-4 space-y-3">
        {hasJourneyInfo ? (
          <>
            <p className="text-sm text-muted-foreground">
              You mentioned a journey. You can create it now in the journey planner with your
              collected info as a starting point.
            </p>
            <div className="space-y-1.5">
              {journey?.fromLocation && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 flex-shrink-0">From:</span>
                  <span className="text-foreground">{journey.fromLocation}</span>
                </div>
              )}
              {journey?.toLocation && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 flex-shrink-0">To:</span>
                  <span className="text-foreground">{journey.toLocation}</span>
                </div>
              )}
              {journey?.startDate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-16 flex-shrink-0">Departs:</span>
                  <span className="text-foreground">{journey.startDate}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            You can create your first journey now in the journey planner, or do it later from your
            dashboard.
          </p>
        )}
      </div>

      <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip, go to dashboard
        </Button>
        <Button size="sm" onClick={handleCreate}>
          Create journey
        </Button>
      </div>
    </div>
  );
}
