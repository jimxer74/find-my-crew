'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LocationAutocomplete, Location } from '@/app/components/ui/LocationAutocomplete';
import { formatDate, formatDateShort } from '@/app/lib/dateFormat';
import { Footer } from '@/app/components/Footer';
import { FeatureGate } from '@/app/components/auth/FeatureGate';

// Calculate distance between two coordinates using Haversine formula (nautical miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate duration in hours
function calculateDuration(distanceNM: number, speedKnots: number | null): number | null {
  if (!speedKnots || speedKnots <= 0) return null;
  const effectiveSpeed = speedKnots * 0.75;
  return distanceNM / effectiveSpeed;
}

// Format hours to readable string
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

type Boat = {
  id: string;
  name: string;
  average_speed_knots?: number | null;
  capacity?: number | null;
};

export default function ProposeJourneyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoatId, setSelectedBoatId] = useState('');
  const [selectedBoatSpeed, setSelectedBoatSpeed] = useState<number | null>(null);
  const [startLocation, setStartLocation] = useState<Location>({ name: '', lat: 0, lng: 0 });
  const [endLocation, setEndLocation] = useState<Location>({ name: '', lat: 0, lng: 0 });
  const [intermediateWaypoints, setIntermediateWaypoints] = useState<Location[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useSpeedPlanning, setUseSpeedPlanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedJourney, setGeneratedJourney] = useState<any>(null);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadBoats();
      resetForm();
    }
  }, [user]);

  const resetForm = () => {
    setSelectedBoatId('');
    setSelectedBoatSpeed(null);
    setStartLocation({ name: '', lat: 0, lng: 0 });
    setEndLocation({ name: '', lat: 0, lng: 0 });
    setIntermediateWaypoints([]);
    setStartDate('');
    setEndDate('');
    setUseSpeedPlanning(false);
    setGeneratedJourney(null);
    setAiPrompt(null);
    setError(null);
  };

  const loadBoats = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: boatsError } = await supabase
      .from('boats')
      .select('id, name, average_speed_knots, capacity')
      .eq('owner_id', user?.id)
      .order('name', { ascending: true });

    if (boatsError) {
      console.error('Failed to load boats:', boatsError);
      setError('Failed to load boats');
    } else {
      setBoats(data || []);
    }
  };

  useEffect(() => {
    if (selectedBoatId) {
      const selectedBoat = boats.find((boat) => boat.id === selectedBoatId);
      setSelectedBoatSpeed(selectedBoat?.average_speed_knots || null);
    } else {
      setSelectedBoatSpeed(null);
    }
  }, [selectedBoatId, boats]);

  const handleGenerate = async () => {
    setError(null);

    if (!selectedBoatId || !startLocation.name || !endLocation.name) {
      setError('Please fill in all required fields');
      return;
    }

    const validStart = startLocation.lat !== 0 && startLocation.lng !== 0;
    const validEnd = endLocation.lat !== 0 && endLocation.lng !== 0;

    if (!validStart || !validEnd) {
      setError('Select valid start and end locations from the suggestions');
      return;
    }

    const invalidWaypoint = intermediateWaypoints.some((wp) => wp.lat === 0 || wp.lng === 0);
    if (invalidWaypoint) {
      setError('Please select valid intermediate waypoints from the suggestions');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedJourney(null);

    const allWaypoints = [
      { name: startLocation.name, lat: startLocation.lat, lng: startLocation.lng },
      ...intermediateWaypoints.map((wp) => ({ name: wp.name, lat: wp.lat, lng: wp.lng })),
      { name: endLocation.name, lat: endLocation.lat, lng: endLocation.lng },
    ];

    try {
      const response = await fetch('/api/ai/generate-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boatId: selectedBoatId,
          startLocation: {
            name: startLocation.name,
            lat: startLocation.lat,
            lng: startLocation.lng,
          },
          endLocation: {
            name: endLocation.name,
            lat: endLocation.lat,
            lng: endLocation.lng,
          },
          intermediateWaypoints: intermediateWaypoints.length > 0 ? intermediateWaypoints.map((wp) => ({
            name: wp.name,
            lat: wp.lat,
            lng: wp.lng,
          })) : null,
          startDate: startDate || null,
          endDate: endDate || null,
          useSpeedPlanning,
          boatSpeed: selectedBoatSpeed || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate journey');
      }

      setGeneratedJourney(result.data);
      setAiPrompt(result.prompt || null);
    } catch (err: any) {
      setError(err.message || 'Failed to generate journey');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async () => {
    if (!generatedJourney || !selectedBoatId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const journeyInsertData: any = {
        boat_id: selectedBoatId,
        name: generatedJourney.journeyName,
        description: generatedJourney.description || '',
        state: 'In planning',
        is_ai_generated: true,
        ai_prompt: aiPrompt || null,
      };

      if (startDate) journeyInsertData.start_date = startDate;
      if (endDate) journeyInsertData.end_date = endDate;

      const { data: journeyData, error: journeyError } = await supabase
        .from('journeys')
        .insert(journeyInsertData)
        .select()
        .single();

      if (journeyError) {
        throw journeyError;
      }

      const foundBoat = boats.find((boat) => boat.id === selectedBoatId);
      const boatCapacity = foundBoat?.capacity || null;
      const defaultCrewNeeded = boatCapacity && boatCapacity > 0 ? Math.max(0, boatCapacity - 1) : null;

      for (const leg of generatedJourney.legs) {
        const legInsertData: any = {
          journey_id: journeyData.id,
          name: leg.name,
        };

        if (leg.start_date) legInsertData.start_date = leg.start_date;
        if (leg.end_date) legInsertData.end_date = leg.end_date;
        if (leg.crew_needed !== undefined && leg.crew_needed !== null) {
          legInsertData.crew_needed = leg.crew_needed;
        } else if (defaultCrewNeeded !== null) {
          legInsertData.crew_needed = defaultCrewNeeded;
        }

        const { data: newLeg, error: legError } = await supabase
          .from('legs')
          .insert(legInsertData)
          .select('id')
          .single();

        if (legError) {
          throw legError;
        }

        if (leg.waypoints && leg.waypoints.length > 0) {
          const { error: waypointsError } = await supabase.rpc('insert_leg_waypoints', {
            leg_id_param: newLeg.id,
            waypoints_param: leg.waypoints.map((wp: any) => ({
              index: wp.index !== undefined ? wp.index : 0,
              name: wp.name || null,
              lng: wp.geocode?.coordinates?.[0] || 0,
              lat: wp.geocode?.coordinates?.[1] || 0,
            })),
          });

          if (waypointsError) {
            await supabase.from('legs').delete().eq('id', newLeg.id);
            throw waypointsError;
          }
        }
      }

      resetForm();
      router.push(`/owner/journeys/${journeyData.id}/legs`);
    } catch (err: any) {
      console.error('Failed to save AI journey:', err);
      setError(err.message || 'Failed to save journey');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <FeatureGate feature="create_journey">
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div>
            <Link href="/owner/journeys" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
              ← Back to Journeys
            </Link>
            <h1 className="text-3xl font-semibold text-foreground mt-2">Propose Journey</h1>
            <p className="text-sm text-muted-foreground">
              Let AI sketch a multi-leg itinerary based on your preferred route and returns.
            </p>
          </div>

          <div className="bg-card rounded-2xl shadow-lg border border-border p-6 md:p-8 space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                {error}
              </div>
            )}

            {!generatedJourney ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="boat-select" className="block text-sm font-medium text-foreground mb-1">
                    Boat *
                  </label>
                  <select
                    id="boat-select"
                    value={selectedBoatId}
                    onChange={(e) => {
                      setSelectedBoatId(e.target.value);
                      setError(null);
                    }}
                    className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                  >
                    <option value="">Select a boat</option>
                    {boats.map((boat) => (
                      <option key={boat.id} value={boat.id}>
                        {boat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LocationAutocomplete
                    id="start_location"
                    label="Start Location"
                    value={startLocation.name}
                    onChange={(location) => {
                      setStartLocation(location);
                      setError(null);
                    }}
                    onInputChange={(value) => {
                      setStartLocation({ name: value, lat: 0, lng: 0 });
                      setError(null);
                    }}
                    placeholder="e.g., Barcelona, Spain"
                  />
                  <LocationAutocomplete
                    id="end_location"
                    label="End Location"
                    value={endLocation.name}
                    onChange={(location) => {
                      setEndLocation(location);
                      setError(null);
                    }}
                    onInputChange={(value) => {
                      setEndLocation({ name: value, lat: 0, lng: 0 });
                      setError(null);
                    }}
                    placeholder="e.g., Palma, Mallorca"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Intermediate Waypoints</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIntermediateWaypoints([...intermediateWaypoints, { name: '', lat: 0, lng: 0 }]);
                        setError(null);
                      }}
                      className="text-sm text-primary hover:opacity-80 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Waypoint
                    </button>
                  </div>
                  {intermediateWaypoints.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Optional: Add stops along the route.</p>
                  ) : (
                    <div className="space-y-3">
                      {intermediateWaypoints.map((waypoint, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="flex-1">
                            <LocationAutocomplete
                              id={`waypoint_${index}`}
                              label={`Waypoint ${index + 1}`}
                              value={waypoint.name}
                              onChange={(location) => {
                                const updated = [...intermediateWaypoints];
                                updated[index] = location;
                                setIntermediateWaypoints(updated);
                                setError(null);
                              }}
                              onInputChange={(value) => {
                                const updated = [...intermediateWaypoints];
                                updated[index] = { name: value, lat: 0, lng: 0 };
                                setIntermediateWaypoints(updated);
                                setError(null);
                              }}
                              placeholder="e.g., Ibiza, Spain"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = intermediateWaypoints.filter((_, idx) => idx !== index);
                              setIntermediateWaypoints(updated);
                              setError(null);
                            }}
                            className="mt-6 text-destructive hover:opacity-80 p-2"
                            title="Remove waypoint"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="proposal_start_date" className="block text-sm font-medium text-foreground mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="proposal_start_date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setError(null);
                      }}
                      className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="proposal_end_date" className="block text-sm font-medium text-foreground mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="proposal_end_date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setError(null);
                      }}
                      min={startDate || undefined}
                      className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useSpeedPlanning}
                      onChange={(e) => {
                        setUseSpeedPlanning(e.target.checked);
                        setError(null);
                      }}
                      disabled={!selectedBoatSpeed || !startDate || !endDate}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">
                      Use boat average speed planning {selectedBoatSpeed && `(${selectedBoatSpeed} kt)`}
                    </span>
                  </label>
                  {useSpeedPlanning && (!selectedBoatSpeed || !startDate || !endDate) && (
                    <p className="text-xs text-muted-foreground mt-1 ml-4">
                      {!selectedBoatSpeed && 'Boat speed is required. '}
                      {!startDate && 'Start date is required. '}
                      {!endDate && 'End date is required.'}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-border mt-6">
                  <Link
                    href="/owner/journeys"
                    className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition"
                  >
                    Cancel
                  </Link>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating || !selectedBoatId || !startLocation.name || !endLocation.name}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
                  >
                    {generating ? 'Generating...' : 'Generate Journey'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                      <p className="font-semibold mb-1">AI Generated Content Disclaimer</p>
                      <p>
                        This journey and legs are generated automatically by AI. Please note that this does not eliminate the need for proper navigation, charting, or passage planning. Always validate and confirm routes before sailing.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-2">
                    Generated Journey: {generatedJourney.journeyName}
                  </h3>
                  {generatedJourney.description && (
                    <p className="text-muted-foreground mb-4 text-sm">{generatedJourney.description}</p>
                  )}
                  {(startDate || endDate) && (
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      {startDate && (
                        <div>
                          <span className="text-muted-foreground">Start Date: </span>
                          <span className="font-medium text-card-foreground">{formatDate(startDate)}</span>
                        </div>
                      )}
                      {endDate && (
                        <div>
                          <span className="text-muted-foreground">End Date: </span>
                          <span className="font-medium text-card-foreground">{formatDate(endDate)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium text-card-foreground mb-2">Legs</h4>
                  <div className="space-y-3">
                    {generatedJourney.legs.map((leg: any, idx: number) => {
                      let distanceNM: number | null = null;
                      let durationHours: number | null = null;

                      if (leg.waypoints?.length >= 2) {
                        const startWp = leg.waypoints[0];
                        const endWp = leg.waypoints[leg.waypoints.length - 1];
                        if (startWp?.geocode?.coordinates && endWp?.geocode?.coordinates) {
                          const [lng1, lat1] = startWp.geocode.coordinates;
                          const [lng2, lat2] = endWp.geocode.coordinates;
                          distanceNM = calculateDistance(lat1, lng1, lat2, lng2);
                          durationHours = calculateDuration(distanceNM, selectedBoatSpeed);
                        }
                      }

                      return (
                        <div key={idx} className="bg-accent/50 p-4 rounded-lg border border-border">
                          <div className="mb-2">
                            <p className="font-medium text-card-foreground">{leg.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {leg.waypoints?.length || 0} waypoint{(leg.waypoints?.length || 0) !== 1 ? 's' : ''}
                            </p>
                          </div>

                          {(leg.start_date || leg.end_date) && (
                            <div className="grid grid-cols-2 gap-3 mb-2 text-xs">
                              {leg.start_date && (
                                <div>
                                  <span className="text-muted-foreground">Start: </span>
                                  <span className="font-medium text-card-foreground">{formatDateShort(leg.start_date)}</span>
                                </div>
                              )}
                              {leg.end_date && (
                                <div>
                                  <span className="text-muted-foreground">End: </span>
                                  <span className="font-medium text-card-foreground">{formatDateShort(leg.end_date)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-border/50">
                            {distanceNM !== null && (
                              <div>
                                <span className="text-muted-foreground">Distance: </span>
                                <span className="font-medium text-card-foreground">{Math.round(distanceNM)} nm</span>
                              </div>
                            )}
                            {durationHours !== null && (
                              <div>
                                <span className="text-muted-foreground">Duration: </span>
                                <span className="font-medium text-card-foreground">
                                  {formatDuration(durationHours)}
                                  {selectedBoatSpeed && distanceNM !== null && (
                                    <span className="text-muted-foreground ml-1">(@ {selectedBoatSpeed}kt)</span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedJourney(null);
                      setError(null);
                    }}
                    className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
                  >
                    {loading ? 'Saving...' : 'Accept & Create Journey'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </FeatureGate>
  );
}
