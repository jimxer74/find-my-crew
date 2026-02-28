'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { submitJob } from '@shared/lib/async-jobs';
import { JobProgressPanel } from '@shared/components/async-jobs';
import { LocationAutocomplete, type Location } from '@shared/ui/LocationAutocomplete';
import { logger } from '@shared/logging';

interface WaypointEntry {
  text: string;
  coords: { lat: number; lng: number } | null;
}

interface JourneyData {
  fromLocation?: string | null;
  toLocation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  intermediateWaypoints?: string[] | null;
}

interface JourneyCheckpointProps {
  journey: JourneyData | null;
  boatId: string | null;
  onSkip: () => void;
}

type Phase = 'form' | 'generating' | 'saving';

const VALID_RISK_LEVELS = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'] as const;

function parseRiskLevel(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const t = raw.trim().replace(/^["'\[\]]+|["'\[\]]+$/g, '');
    return VALID_RISK_LEVELS.includes(t as (typeof VALID_RISK_LEVELS)[number]) ? t : null;
  }
  if (Array.isArray(raw) && raw.length > 0) return parseRiskLevel(raw[0]);
  return null;
}

async function geocodeQuery(query: string): Promise<{ lat: number; lng: number; name: string } | null> {
  try {
    const res = await fetch('/api/onboarding/v2/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function JourneyCheckpoint({ journey, boatId, onSkip }: JourneyCheckpointProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('form');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start / end location state
  const [startText, setStartText] = useState(journey?.fromLocation ?? '');
  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [endText, setEndText] = useState(journey?.toLocation ?? '');
  const [endCoords, setEndCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Intermediate waypoints state
  const [waypoints, setWaypoints] = useState<WaypointEntry[]>(() =>
    (journey?.intermediateWaypoints ?? []).map((w) => ({ text: w, coords: null }))
  );

  const [isGeocoding, setIsGeocoding] = useState(false);

  const [startDate, setStartDate] = useState(journey?.startDate ?? '');
  const [endDate, setEndDate] = useState(journey?.endDate ?? '');

  // Auto-geocode all location names extracted from chat on mount
  useEffect(() => {
    type GeoTask = {
      query: string;
      onResult: (coords: { lat: number; lng: number }, name: string) => void;
    };

    const tasks: GeoTask[] = [];

    if (journey?.fromLocation) {
      tasks.push({
        query: journey.fromLocation,
        onResult: (c, name) => { setStartCoords(c); setStartText(name); },
      });
    }
    if (journey?.toLocation) {
      tasks.push({
        query: journey.toLocation,
        onResult: (c, name) => { setEndCoords(c); setEndText(name); },
      });
    }
    (journey?.intermediateWaypoints ?? []).forEach((wp, idx) => {
      tasks.push({
        query: wp,
        onResult: (c, name) => {
          setWaypoints((prev) => {
            const next = [...prev];
            if (next[idx]) next[idx] = { text: name, coords: c };
            return next;
          });
        },
      });
    });

    if (tasks.length === 0) return;

    setIsGeocoding(true);
    Promise.all(
      tasks.map(async ({ query, onResult }) => {
        const result = await geocodeQuery(query);
        if (result) onResult({ lat: result.lat, lng: result.lng }, result.name);
      })
    ).finally(() => setIsGeocoding(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Location handlers ----
  const handleStartChange = (loc: Location) => {
    setStartText(loc.name);
    setStartCoords({ lat: loc.lat, lng: loc.lng });
  };

  const handleEndChange = (loc: Location) => {
    setEndText(loc.name);
    setEndCoords({ lat: loc.lat, lng: loc.lng });
  };

  // ---- Waypoint handlers ----
  const addWaypoint = () => {
    setWaypoints((prev) => [...prev, { text: '', coords: null }]);
  };

  const removeWaypoint = (idx: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleWaypointChange = (idx: number, loc: Location) => {
    setWaypoints((prev) => {
      const next = [...prev];
      next[idx] = { text: loc.name, coords: { lat: loc.lat, lng: loc.lng } };
      return next;
    });
  };

  const handleWaypointInputChange = (idx: number, value: string) => {
    setWaypoints((prev) => {
      const next = [...prev];
      next[idx] = { text: value, coords: null };
      return next;
    });
  };

  // ---- Generate ----
  const handleGenerate = async () => {
    setError(null);

    if (!boatId) {
      setError('Boat not found. Please go back and save your boat first.');
      return;
    }
    if (!startText.trim() || !startCoords) {
      setError('Please select a valid departure location from the suggestions.');
      return;
    }
    if (!endText.trim() || !endCoords) {
      setError('Please select a valid destination from the suggestions.');
      return;
    }

    // Warn if some waypoints have text but no resolved coords
    const unresolvedWp = waypoints.filter((w) => w.text.trim() && !w.coords);
    if (unresolvedWp.length > 0) {
      setError('Some intermediate waypoints are not resolved. Please select them from the suggestions or remove them.');
      return;
    }

    const resolvedWaypoints = waypoints
      .filter((w) => w.text.trim() && w.coords)
      .map((w) => ({ name: w.text.trim(), lat: w.coords!.lat, lng: w.coords!.lng }));

    try {
      const { jobId: id } = await submitJob({
        job_type: 'generate-journey',
        payload: {
          boatId,
          startLocation: { name: startText.trim(), lat: startCoords.lat, lng: startCoords.lng },
          endLocation: { name: endText.trim(), lat: endCoords.lat, lng: endCoords.lng },
          ...(resolvedWaypoints.length > 0 ? { waypoints: resolvedWaypoints } : {}),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          waypointDensity: 'moderate',
        } as unknown as Record<string, unknown>,
      });
      setJobId(id);
      setPhase('generating');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start journey generation');
    }
  };

  const handleJobComplete = useCallback(
    async (result: Record<string, unknown>) => {
      const generatedJourney = result.journey as Record<string, unknown> | undefined;
      if (!generatedJourney || !boatId) {
        onSkip();
        return;
      }
      setPhase('saving');
      try {
        const supabase = getSupabaseBrowserClient();
        const riskLevel = parseRiskLevel(generatedJourney.riskLevel);

        const { data: journeyData, error: journeyError } = await supabase
          .from('journeys')
          .insert({
            boat_id: boatId,
            name: generatedJourney.journeyName as string,
            description: (generatedJourney.description as string) || '',
            state: 'In planning',
            is_ai_generated: true,
            ...(startDate ? { start_date: startDate } : {}),
            ...(endDate ? { end_date: endDate } : {}),
            ...(riskLevel ? { risk_level: riskLevel } : {}),
          })
          .select()
          .single();

        if (journeyError) throw journeyError;

        const legs = generatedJourney.legs as Array<Record<string, unknown>>;
        for (const leg of legs ?? []) {
          const { data: newLeg, error: legError } = await supabase
            .from('legs')
            .insert({
              journey_id: journeyData.id,
              name: leg.name as string,
              ...(leg.start_date ? { start_date: leg.start_date } : {}),
              ...(leg.end_date ? { end_date: leg.end_date } : {}),
            })
            .select('id')
            .single();

          if (legError) throw legError;

          const waypointsData = leg.waypoints as Array<Record<string, unknown>> | undefined;
          if (waypointsData && waypointsData.length > 0) {
            const { error: wpError } = await supabase.rpc('insert_leg_waypoints', {
              leg_id_param: newLeg.id,
              waypoints_param: waypointsData.map((wp) => {
                const coords = (wp.geocode as Record<string, unknown>)?.coordinates as number[] | undefined;
                return {
                  index: (wp.index as number) ?? 0,
                  name: (wp.name as string) ?? null,
                  lng: coords?.[0] ?? 0,
                  lat: coords?.[1] ?? 0,
                };
              }),
            });
            if (wpError) {
              logger.warn('[JourneyCheckpoint] Waypoint insert error', { error: wpError.message });
            }
          }
        }

        router.push(`/owner/journeys/${journeyData.id}/legs`);
      } catch (err) {
        logger.error('[JourneyCheckpoint] Save failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        setError(err instanceof Error ? err.message : 'Failed to save journey');
        setPhase('form');
      }
    },
    [boatId, startDate, endDate, router, onSkip]
  );

  const handleJobError = useCallback((errMsg: string) => {
    setError(errMsg);
    setPhase('form');
    setJobId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Saving state
  // ---------------------------------------------------------------------------
  if (phase === 'saving') {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-6 text-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Saving your journey…</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Generating state — async job progress
  // ---------------------------------------------------------------------------
  if (phase === 'generating' && jobId) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground">Generating your journey…</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI is planning the route from {startText} to {endText}. This takes 30–90 seconds.
          </p>
        </div>
        <div className="px-5 py-4">
          <JobProgressPanel
            jobId={jobId}
            onComplete={handleJobComplete}
            onError={handleJobError}
          />
        </div>
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex justify-start">
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Skip journey, go to dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground">Create your first journey</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI will plan the route and legs for you automatically.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {isGeocoding && (
          <p className="text-xs text-muted-foreground">Resolving locations from your conversation…</p>
        )}

        {/* Departure */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Departure location <span className="text-destructive">*</span>
          </label>
          <LocationAutocomplete
            value={startText}
            onChange={handleStartChange}
            onInputChange={(v) => { setStartText(v); setStartCoords(null); }}
            placeholder="e.g. Helsinki, Finland"
            excludeCruisingRegions={false}
          />
          {startCoords && (
            <p className="text-xs text-muted-foreground mt-0.5">✓ Location resolved</p>
          )}
        </div>

        {/* Intermediate waypoints */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">
              Intermediate stops (optional)
            </label>
            <button
              type="button"
              onClick={addWaypoint}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              + Add stop
            </button>
          </div>

          {waypoints.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No intermediate stops. Click &quot;+ Add stop&quot; to add waypoints.
            </p>
          )}

          <div className="space-y-2">
            {waypoints.map((wp, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <LocationAutocomplete
                    value={wp.text}
                    onChange={(loc) => handleWaypointChange(idx, loc)}
                    onInputChange={(v) => handleWaypointInputChange(idx, v)}
                    placeholder={`Stop ${idx + 1}, e.g. Mariehamn, Finland`}
                    excludeCruisingRegions={false}
                  />
                  {wp.text && wp.coords && (
                    <p className="text-xs text-muted-foreground mt-0.5">✓ Location resolved</p>
                  )}
                  {wp.text && !wp.coords && (
                    <p className="text-xs text-amber-600 mt-0.5">Select from suggestions to resolve</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeWaypoint(idx)}
                  className="mt-2 text-muted-foreground hover:text-destructive text-sm px-1"
                  aria-label="Remove stop"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Destination */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Destination <span className="text-destructive">*</span>
          </label>
          <LocationAutocomplete
            value={endText}
            onChange={handleEndChange}
            onInputChange={(v) => { setEndText(v); setEndCoords(null); }}
            placeholder="e.g. Tallinn, Estonia"
            excludeCruisingRegions={false}
          />
          {endCoords && (
            <p className="text-xs text-muted-foreground mt-0.5">✓ Location resolved</p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Departure date (optional)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Arrival date (optional)
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Skip, go to dashboard
        </button>
        <button
          onClick={handleGenerate}
          disabled={!startCoords || !endCoords}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Generate journey
        </button>
      </div>
    </div>
  );
}
