'use client';

import { logger } from '@/app/lib/logger';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
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
  is_ai_generated?: boolean;
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
  crew_needed?: number | null;
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
  const [allRegistrations, setAllRegistrations] = useState<Registration[]>([]);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [isPaneOpen, setIsPaneOpen] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hasFittedInitialBounds = useRef(false);
  const registrationCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // Filter registrations client-side based on selectedLegId (memoized to prevent unnecessary re-renders)
  const registrations = useMemo(() => {
    if (!selectedLegId) {
      return allRegistrations;
    }
    return allRegistrations.filter(reg => reg.leg_id === selectedLegId);
  }, [allRegistrations, selectedLegId]);

  const loadJourney = async () => {
    if (!user || !journeyId) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('journeys')
      .select('id, name, state, start_date, end_date, is_ai_generated')
      .eq('id', journeyId)
      .single();

    if (error) {
      logger.error('Error loading journey:', { errorCode: error.code, errorMessage: error.message });
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
      .select('id, name, start_date, end_date, crew_needed')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: true });

    if (legsError) {
      logger.error('Error loading legs:', { errorCode: legsError.code, errorMessage: legsError.message });
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
                logger.error('Error parsing location GeoJSON:', e instanceof Error ? { error: e.message } : { error: String(e) });
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
        }).sort((a: { index: number }, b: { index: number }) => a.index - b.index);
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
        crew_needed: leg.crew_needed || null,
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
      // Load all registrations without leg filter
      const url = `/api/registrations/by-journey/${journeyId}`;
      logger.debug('[loadRegistrations] Fetching', {
        url,
        journeyId,
      });
      const response = await fetch(url);
      
      logger.debug('[loadRegistrations] Response:', {
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
            logger.error('[loadRegistrations] API Error:', {
              status,
              statusText,
              error: errorData.error,
              details: errorData.details,
              fullError: errorData,
            });
          } else {
            // Try to get text response
            const text = await response.text();
            logger.error('[loadRegistrations] API Error (non-JSON):', {
              status,
              statusText,
              responseText: text,
            });
            errorMessage = text || `HTTP ${status}: ${statusText}`;
          }
        } catch (parseError) {
          logger.error('[loadRegistrations] Failed to parse error response:', { error: parseError instanceof Error ? parseError.message : String(parseError) });
          errorMessage = `HTTP ${status}: ${statusText}`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        const responseText = await response.text();
        logger.debug('[loadRegistrations] Response text:', { text: responseText });
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('Empty response from API');
        }
        
        data = JSON.parse(responseText);
        logger.debug('[loadRegistrations] Parsed data:', { data });
      } catch (parseError: any) {
        logger.error('[loadRegistrations] Failed to parse response:', parseError instanceof Error ? { error: parseError.message } : { error: String(parseError) });
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from API');
      }
      
      if (!Array.isArray(data.registrations)) {
        logger.warn('[loadRegistrations] registrations is not an array:', { data });
        setAllRegistrations([]);
        return;
      }
      
      setAllRegistrations(data.registrations || []);
    } catch (error: any) {
      logger.error('Error loading registrations:', error instanceof Error ? { error: error.message } : { error: String(error) });
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
      logger.error('Error fitting bounds:', { error: error instanceof Error ? error.message : String(error) });
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

  // Get all legs' waypoints for the map (memoized to prevent map re-initialization)
  const getAllLegsWaypoints = useMemo((): Array<{ waypoints: Array<{ index: number; geocode: { type: string; coordinates: [number, number] }; name: string }>; legId: string; isComplete: boolean }> => {
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
  }, [legs]);

  const handleLegClick = (legId: string) => {
    // Toggle selection: if clicking the same leg, deselect it
    if (selectedLegId === legId) {
      setSelectedLegId(null);
      setSelectedRegistrationId(null);
    } else {
      setSelectedLegId(legId);
      setSelectedRegistrationId(null);
    }
  };

  const handleRegistrationCardClick = (registration: Registration) => {
    // When a registration card is clicked, highlight its leg on the map
    setSelectedLegId(registration.leg_id);
    setSelectedRegistrationId(registration.id);
    
    // Scroll to the registration card
    const cardElement = registrationCardRefs.current.get(registration.id);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Calculate approved registrations per leg and create marker labels
  const legMarkerLabels = useMemo(() => {
    const labelsMap = new Map<string, string>();
    
    legs.forEach(leg => {
      const approvedCount = allRegistrations.filter(
        reg => reg.leg_id === leg.id && reg.status === 'Approved'
      ).length;
      
      const capacity = leg.crew_needed || 0;
      const label = capacity > 0 ? `${approvedCount}/${capacity}` : `${approvedCount}`;
      labelsMap.set(leg.id, label);
    });
    
    return labelsMap;
  }, [legs, allRegistrations]);

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

  // Only show loading screen during initial auth check or initial data load
  // Filtering happens client-side and shouldn't trigger loading state
  if (authLoading || (loading && allRegistrations.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-background flex flex-col overflow-hidden">

      <main className="flex-1 relative overflow-hidden min-h-0">
        {/* Map Container - Always full width, stays in place */}
        <div className="absolute inset-0 w-full h-full">
          <EditJourneyMap
            initialCenter={[0, 20]}
            initialZoom={2}
            onMapLoad={handleMapLoad}
            allLegsWaypoints={getAllLegsWaypoints}
            selectedLegId={selectedLegId}
            onLegClick={handleLegClick}
            legMarkerLabels={legMarkerLabels}
            disableStartNewLeg={true}
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
                  <div className="space-y-3 flex flex-col">
                    {/* Tags at the top */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Journey State Tag */}
                      {journey.state && (() => {
                        let stateStyle = 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800';
                        if (journey.state === 'In planning') {
                          stateStyle = 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800';
                        } else if (journey.state === 'Published') {
                          stateStyle = 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
                        } else if (journey.state === 'Archived') {
                          stateStyle = 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800';
                        }
                        return (
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium border rounded-md ${stateStyle}`}>
                            {journey.state}
                          </span>
                        );
                      })()}
                      {/* AI Generated Tag */}
                      {journey.is_ai_generated && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-md">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          AI generated
                        </span>
                      )}
                    </div>
                    <div className="mb-2">
                      <h2 className="text-base font-semibold text-card-foreground">
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
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="flex-1 p-6 overflow-y-auto min-h-0">
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
                    {selectedLegId && (
                      <button
                        onClick={() => {
                          setSelectedLegId(null);
                          setSelectedRegistrationId(null);
                        }}
                        className="text-xs text-primary hover:underline font-medium mb-2"
                      >
                        Show all registrations
                      </button>
                    )}
                    {registrations.map((registration) => {
                      const profile = registration.profiles;
                      const leg = registration.legs;
                      const journeyData = { id: journeyId, name: journey?.name || 'Journey' };

                      if (!profile || !leg || !journeyData) return null;

                      const isSelected = selectedRegistrationId === registration.id;
                      const isLegSelected = selectedLegId === registration.leg_id;
                      
                      return (
                        <div 
                          key={registration.id} 
                          ref={(el) => {
                            if (el) {
                              registrationCardRefs.current.set(registration.id, el);
                            } else {
                              registrationCardRefs.current.delete(registration.id);
                            }
                          }}
                          onClick={() => handleRegistrationCardClick(registration)}
                          className={`bg-card rounded-lg shadow p-4 flex flex-col h-full relative border transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-primary border-2 shadow-lg' 
                              : isLegSelected 
                              ? 'border-primary/50 border-2' 
                              : 'border-border'
                          }`}
                        >
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

                          {/* Status Badge - Bottom Center - Clickable */}
                          <div className="mt-auto pt-3 flex justify-center">
                            <Link
                              href={`/owner/registrations/${registration.id}`}
                              className="hover:opacity-80 transition-opacity"
                              title="View registration details"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {getStatusBadge(registration.status)}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer - Sticky Icon Menu */}
              <div className="sticky bottom-0 border-t border-border bg-card py-2 px-4">
                <div className="flex items-center justify-center gap-2">
                  {/* Edit Journey */}
                  <Link
                    href={`/owner/journeys/${journeyId}/edit`}
                    className="p-1 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                    title="Edit journey"
                    aria-label="Edit journey"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </Link>
                  {/* Legs View */}
                  <Link
                    href={`/owner/journeys/${journeyId}/legs`}
                    className="p-1 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                    title="View legs"
                    aria-label="View legs"
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
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </Link>
                  {/* Registrations View (Current) */}
                  <div
                    className="p-1 text-primary rounded bg-primary/10"
                    title="Registrations (current)"
                    aria-label="Registrations (current)"
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  {/* Back to Journeys */}
                  <Link
                    href={`/owner/journeys`}
                    className="p-1 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                    title="Back to journeys"
                    aria-label="Back to journeys"
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
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

    </div>
  );
}
