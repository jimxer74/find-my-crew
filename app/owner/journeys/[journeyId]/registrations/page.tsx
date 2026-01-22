'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { EditJourneyMap } from '@/app/components/manage/EditJourneyMap';
import { formatDate } from '@/app/lib/dateFormat';
import Image from 'next/image';
import Link from 'next/link';
import mapboxgl from 'mapbox-gl';

type Registration = {
  id: string;
  leg_id: string;
  user_id: string;
  status: 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  legs: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    skills: string[] | null;
    min_experience_level: number | null;
    start_waypoint_name?: string | null;
    end_waypoint_name?: string | null;
  };
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    sailing_experience: number | null;
    skills: string[];
    phone: string | null;
    profile_image_url: string | null;
  };
  answers?: Array<{
    id: string;
    requirement_id: string;
    answer_text: string | null;
    answer_json: any;
    journey_requirements: {
      id: string;
      question_text: string;
      question_type: string;
      options: string[] | null;
      is_required: boolean;
      order: number;
    };
  }>;
  ai_match_score?: number | null;
  ai_match_reasoning?: string | null;
  auto_approved?: boolean;
};

type Journey = {
  id: string;
  name: string;
  state?: string;
  start_date?: string | null;
  end_date?: string | null;
};

type Leg = {
  id: string;
  startWaypoint: {
    index: number;
    geocode: {
      type: string;
      coordinates: [number, number];
    };
    name: string;
  } | null;
  endWaypoint: {
    index: number;
    geocode: {
      type: string;
      coordinates: [number, number];
    };
    name: string;
  } | null;
  start_date?: string | null;
  end_date?: string | null;
  intermediateWaypoints?: {
    index: number;
    geocode: {
      type: string;
      coordinates: [number, number];
    };
    name: string;
  }[];
};

export default function JourneyRegistrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const journeyId = params?.journeyId as string;
  
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [isPaneOpen, setIsPaneOpen] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hasFittedInitialBounds = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && journeyId) {
      loadJourney();
      loadLegs();
      loadRegistrations();
    }
  }, [user, authLoading, router, journeyId]);

  useEffect(() => {
    if (user && journeyId) {
      loadRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLegId]);

  const loadJourney = async () => {
    if (!user || !journeyId) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('journeys')
      .select('id, name, state, start_date, end_date')
      .eq('id', journeyId)
      .single();

    if (error) {
      console.error('Error loading journey:', error);
    } else {
      setJourney(data);
    }
  };

  const loadLegs = async () => {
    if (!user || !journeyId) return;

    const supabase = getSupabaseBrowserClient();
    
    // Load legs data
    const { data: legsData, error: legsError } = await supabase
      .from('legs')
      .select('id, name, start_date, end_date')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: true });

    if (legsError) {
      console.error('Error loading legs:', legsError);
      setLegs([]);
      return;
    }

    if (!legsData || legsData.length === 0) {
      setLegs([]);
      return;
    }

    // Load waypoints for all legs using RPC function
    const convertedLegs: Leg[] = [];

    for (const leg of legsData) {
      // Load waypoints for this leg
      const { data: waypointsData, error: waypointsError } = await supabase
        .rpc('get_leg_waypoints', { leg_id_param: leg.id });

      let waypoints: Array<{
        index: number;
        geocode: { type: string; coordinates: [number, number] };
        name: string;
      }> = [];

      if (!waypointsError && waypointsData) {
        // Convert PostGIS GeoJSON to waypoint format
        waypoints = waypointsData.map((row: any) => {
          let coordinates: [number, number] = [0, 0];
          
          // Parse GeoJSON from PostGIS
          if (row.location) {
            if (typeof row.location === 'string') {
              try {
                const geoJson = JSON.parse(row.location);
                coordinates = geoJson.coordinates as [number, number];
              } catch (e) {
                console.error('Error parsing location GeoJSON:', e);
              }
            } else if (row.location.coordinates) {
              coordinates = row.location.coordinates as [number, number];
            } else if (row.location.type === 'Point' && row.location.coordinates) {
              coordinates = row.location.coordinates as [number, number];
            }
          }

          return {
            index: row.index,
            geocode: {
              type: 'Point',
              coordinates: coordinates,
            },
            name: row.name || '',
          };
        }).sort((a, b) => a.index - b.index);
      }

      const startWaypoint = waypoints.find(w => w.index === 0) || null;
      const maxIndex = waypoints.length > 0 ? Math.max(...waypoints.map(w => w.index)) : -1;
      const endWaypoint = waypoints.find(w => w.index === maxIndex) || null;
      const intermediateWaypoints = waypoints.filter(w => w.index !== 0 && w.index !== maxIndex);

      convertedLegs.push({
        id: leg.id,
        startWaypoint: startWaypoint ? {
          index: startWaypoint.index,
          geocode: {
            type: startWaypoint.geocode.type,
            coordinates: startWaypoint.geocode.coordinates,
          },
          name: startWaypoint.name || '',
        } : null,
        endWaypoint: endWaypoint ? {
          index: endWaypoint.index,
          geocode: {
            type: endWaypoint.geocode.type,
            coordinates: endWaypoint.geocode.coordinates,
          },
          name: endWaypoint.name || '',
        } : null,
        start_date: leg.start_date || null,
        end_date: leg.end_date || null,
        intermediateWaypoints: intermediateWaypoints.map(w => ({
          index: w.index,
          geocode: {
            type: w.geocode.type,
            coordinates: w.geocode.coordinates,
          },
          name: w.name || '',
        })),
      });
    }
      
    setLegs(convertedLegs);
    
    // Fit map to show all legs if map is loaded
    if (convertedLegs.length > 0 && mapRef.current && mapLoaded) {
      setTimeout(() => {
        fitMapToLegs(mapRef.current, convertedLegs);
      }, 200);
    }
  };

  const loadRegistrations = async () => {
    if (!user || !journeyId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLegId) {
        params.append('leg_id', selectedLegId);
      }

      const url = `/api/registrations/by-journey/${journeyId}${params.toString() ? '?' + params.toString() : ''}`;
      console.log('[loadRegistrations] Fetching:', url, {
        journeyId,
        selectedLegId,
      });
      const response = await fetch(url);
      
      console.log('[loadRegistrations] Response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to load registrations';
        const status = response.status;
        const statusText = response.statusText;
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
            console.error('[loadRegistrations] API Error:', {
              status,
              statusText,
              error: errorData.error,
              details: errorData.details,
              fullError: errorData,
            });
          } else {
            // Try to get text response
            const text = await response.text();
            console.error('[loadRegistrations] API Error (non-JSON):', {
              status,
              statusText,
              responseText: text,
            });
            errorMessage = text || `HTTP ${status}: ${statusText}`;
          }
        } catch (parseError) {
          console.error('[loadRegistrations] Failed to parse error response:', parseError);
          errorMessage = `HTTP ${status}: ${statusText}`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        const responseText = await response.text();
        console.log('[loadRegistrations] Response text:', responseText);
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('Empty response from API');
        }
        
        data = JSON.parse(responseText);
        console.log('[loadRegistrations] Parsed data:', data);
      } catch (parseError: any) {
        console.error('[loadRegistrations] Failed to parse response:', parseError);
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from API');
      }
      
      if (!Array.isArray(data.registrations)) {
        console.warn('[loadRegistrations] registrations is not an array:', data);
        setRegistrations([]);
        return;
      }
      
      setRegistrations(data.registrations || []);
    } catch (error: any) {
      console.error('Error loading registrations:', error);
      // Show user-friendly error message
      alert(`Failed to load registrations: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && journeyId) {
      loadRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLegId]);

  // Effect to fit map when both map and legs are ready (only on initial load)
  useEffect(() => {
    if (mapLoaded && mapRef.current && legs.length > 0 && !hasFittedInitialBounds.current) {
      const timer = setTimeout(() => {
        fitMapToLegs(mapRef.current, legs);
        hasFittedInitialBounds.current = true;
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, legs.length]);

  const fitMapToLegs = (map: any, legsToFit?: Leg[]) => {
    const legsToUse = legsToFit || legs;
    if (!map || legsToUse.length === 0) return;

    // Check if map is fully loaded
    if (!map.loaded()) {
      map.once('load', () => {
        fitMapToLegs(map, legsToFit);
      });
      return;
    }

    // Collect all coordinates from all legs
    const coordinates: [number, number][] = [];
    
    legsToUse.forEach(leg => {
      if (leg.startWaypoint) {
        coordinates.push(leg.startWaypoint.geocode.coordinates);
      }
      if (leg.intermediateWaypoints) {
        leg.intermediateWaypoints.forEach(wp => {
          coordinates.push(wp.geocode.coordinates);
        });
      }
      if (leg.endWaypoint) {
        coordinates.push(leg.endWaypoint.geocode.coordinates);
      }
    });

    if (coordinates.length === 0) return;

    // Handle single point case
    if (coordinates.length === 1) {
      const [lng, lat] = coordinates[0];
      map.flyTo({
        center: [lng, lat],
        zoom: 10,
        duration: 1000,
      });
      return;
    }

    // Calculate bounds
    const lngs = coordinates.map(c => c[0]);
    const lats = coordinates.map(c => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Add padding to bounds
    const padding = 0.1;
    const lngDiff = maxLng - minLng || 0.01;
    const latDiff = maxLat - minLat || 0.01;
    
    const bounds: [[number, number], [number, number]] = [
      [minLng - lngDiff * padding, minLat - latDiff * padding],
      [maxLng + lngDiff * padding, maxLat + latDiff * padding]
    ];

    // Fit map to bounds
    try {
      map.fitBounds(bounds, {
        padding: 50,
        duration: 1000,
        maxZoom: 12,
      });
    } catch (error) {
      console.error('Error fitting bounds:', error);
      if (coordinates.length > 0) {
        const [lng, lat] = coordinates[0];
        map.flyTo({
          center: [lng, lat],
          zoom: 8,
          duration: 1000,
        });
      }
    }
  };

  const handleMapLoad = (map: any) => {
    mapRef.current = map;
    setMapLoaded(true);
    if (legs.length > 0) {
      setTimeout(() => {
        fitMapToLegs(map, legs);
      }, 200);
    }
  };

  // Get all legs' waypoints for the map
  const getAllLegsWaypoints = (): Array<{ waypoints: Array<{ index: number; geocode: { type: string; coordinates: [number, number] }; name: string }>; legId: string; isComplete: boolean }> => {
    const allWaypoints: Array<{ waypoints: Array<{ index: number; geocode: { type: string; coordinates: [number, number] }; name: string }>; legId: string; isComplete: boolean }> = [];
    
    legs.forEach(leg => {
      if (!leg.startWaypoint) return;
      
      const waypoints: Array<{ index: number; geocode: { type: string; coordinates: [number, number] }; name: string }> = [];
      waypoints.push(leg.startWaypoint);
      
      if (leg.intermediateWaypoints) {
        const sortedWaypoints = [...leg.intermediateWaypoints].sort((a, b) => a.index - b.index);
        waypoints.push(...sortedWaypoints);
      }
      
      if (leg.endWaypoint) {
        waypoints.push(leg.endWaypoint);
      }
      
      if (waypoints.length > 0) {
        allWaypoints.push({
          waypoints: waypoints,
          legId: leg.id,
          isComplete: leg.endWaypoint !== null,
        });
      }
    });
    
    return allWaypoints;
  };

  const handleLegClick = (legId: string) => {
    // Toggle selection: if clicking the same leg, deselect it
    if (selectedLegId === legId) {
      setSelectedLegId(null);
    } else {
      setSelectedLegId(legId);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Pending approval': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Approved': 'bg-green-100 text-green-800 border-green-300',
      'Not approved': 'bg-red-100 text-red-800 border-red-300',
      'Cancelled': 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${statusConfig[status as keyof typeof statusConfig] || statusConfig['Pending approval']}`}>
        {status}
      </span>
    );
  };

  // Registrations are already filtered by the API based on selectedLegId

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 relative overflow-hidden min-h-0">
        {/* Map Container - Always full width, stays in place */}
        <div className="absolute inset-0 w-full h-full">
          <EditJourneyMap
            initialCenter={[0, 20]}
            initialZoom={2}
            onMapLoad={handleMapLoad}
            allLegsWaypoints={getAllLegsWaypoints()}
            selectedLegId={selectedLegId}
            onLegClick={handleLegClick}
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Floating button to open pane when closed */}
        {!isPaneOpen && (
          <button
            onClick={() => setIsPaneOpen(true)}
            className="absolute top-4 left-4 z-50 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all"
            title="Open panel"
            aria-label="Open panel"
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Left Sidebar - Registrations - Overlays the map */}
        <div
          className={`${
            isPaneOpen 
              ? 'translate-x-0' 
              : '-translate-x-full'
          } ${
            isPaneOpen ? 'w-full md:w-80' : 'w-0'
          } border-r border-border bg-card flex flex-col transition-all duration-300 overflow-hidden absolute left-0 top-0 bottom-0 z-40 shadow-lg`}
        >
          {isPaneOpen && (
            <>
              {/* Toggle Button - Inside Pane */}
              <button
                onClick={() => setIsPaneOpen(!isPaneOpen)}
                className="absolute top-4 right-4 z-10 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all"
                title={isPaneOpen ? 'Close panel' : 'Open panel'}
                aria-label={isPaneOpen ? 'Close panel' : 'Open panel'}
              >
                <svg
                  className="w-5 h-5 text-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  {isPaneOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                  )}
                </svg>
              </button>

              {/* Header Section */}
              <div className="p-6 border-b border-border">
                {journey && (
                  <div className="space-y-3 pr-10">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-lg font-semibold text-card-foreground">
                        {journey.name}
                      </h2>
                    </div>
                    {journey.start_date && (
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {journey.start_date && (
                          <p>
                            <span className="font-medium">Start:</span>{' '}
                            {formatDate(journey.start_date)}
                          </p>
                        )}
                        {journey.end_date && (
                          <p>
                            <span className="font-medium">End:</span>{' '}
                            {formatDate(journey.end_date)}
                          </p>
                        )}
                      </div>
                    )}
                    {selectedLegId && (
                      <div className="text-xs text-muted-foreground">
                        Showing registrations for selected leg
                      </div>
                    )}
                  </div>
                )}
              </div>


              {/* Content Section */}
              <div className="flex-1 p-6 overflow-y-auto">
                {registrations.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      {selectedLegId 
                        ? 'No registrations found for the selected leg.'
                        : 'No registrations found. Click on a leg on the map to filter registrations.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-xs text-muted-foreground mb-2">
                      {registrations.length} {registrations.length === 1 ? 'registration' : 'registrations'}
                    </div>
                    {registrations.map((registration) => {
                      const profile = registration.profiles;
                      const leg = registration.legs;
                      const journeyData = { id: journeyId, name: journey?.name || 'Journey' };

                      if (!profile || !leg || !journeyData) return null;

                      return (
                        <div key={registration.id} className="bg-card rounded-lg shadow p-4 flex flex-col h-full relative border border-border">
                          {/* Name and Avatar */}
                          <div className="flex items-start gap-3 mb-3">
                            {/* Crew Avatar - Left Side */}
                            <div className="relative w-12 h-12 flex-shrink-0">
                              {profile.profile_image_url ? (
                                <Image
                                  src={profile.profile_image_url}
                                  alt={profile.full_name || profile.username || 'Crew member'}
                                  fill
                                  className="object-cover rounded-full"
                                  sizes="48px"
                                />
                              ) : (
                                <div className="w-full h-full bg-accent rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-6 h-6 text-muted-foreground"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-foreground">
                                {profile.full_name || profile.username || 'Unknown User'}
                              </h3>
                              {/* Registration Date */}
                              <div className="text-[10px] italic text-muted-foreground mt-1">
                                Registration date: {formatDate(registration.created_at)}
                              </div>
                            </div>
                          </div>

                          {/* Waypoints and Dates */}
                          <div className="flex-1">
                            {(leg.start_waypoint_name || leg.end_waypoint_name || leg.start_date) && (
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                {/* Start Waypoint and Date */}
                                <div className="flex flex-col justify-center">
                                  {leg.start_waypoint_name && (
                                    <div className="text-xs font-semibold text-foreground line-clamp-1">
                                      {leg.start_waypoint_name}
                                    </div>
                                  )}
                                  {leg.start_date && (
                                    <div className="text-xs font-medium text-foreground">
                                      {formatDate(leg.start_date)}
                                    </div>
                                  )}
                                </div>

                                {/* Arrow */}
                                <div className="text-foreground flex items-center justify-center flex-shrink-0">
                                  <span className="text-lg">→</span>
                                </div>

                                {/* End Waypoint and Date */}
                                <div className="flex flex-col justify-center">
                                  {leg.end_waypoint_name && (
                                    <div className="text-xs font-semibold text-foreground line-clamp-1">
                                      {leg.end_waypoint_name}
                                    </div>
                                  )}
                                  {leg.end_date ? (
                                    <div className="text-xs font-medium text-foreground">
                                      {formatDate(leg.end_date)}
                                    </div>
                                  ) : leg.start_date ? (
                                    <div className="text-xs text-muted-foreground">No end date</div>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Status Badge - Bottom Center */}
                          <div className="mt-auto pt-3 flex justify-center">
                            {getStatusBadge(registration.status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
