'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { EditJourneyMap } from '@/app/components/manage/EditJourneyMap';
import { JourneyFormModal } from '@/app/components/manage/JourneyFormModal';
import { EditLegCard } from '@/app/components/manage/EditLegCard';
import { LegFormModal } from '@/app/components/manage/LegFormModal';
import { toGeocode } from '@/app/lib/IGeoCode';
import { formatDate } from '@/app/lib/dateFormat';

type Journey = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  state?: string;
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
  intermediateWaypoints?: {
    index: number;
    geocode: {
      type: string;
      coordinates: [number, number];
    };
    name: string;
  }[];
};

export default function LegsManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const journeyId = params?.journeyId as string;
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [boatSpeed, setBoatSpeed] = useState<number | null>(null);
  const [boatCapacity, setBoatCapacity] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLegModalOpen, setIsLegModalOpen] = useState(false);
  const [editingLegId, setEditingLegId] = useState<string | null>(null);
  const [isPaneOpen, setIsPaneOpen] = useState(true);
  const [legs, setLegs] = useState<Leg[]>([]);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [legToDelete, setLegToDelete] = useState<Leg | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [isDisclaimerModalOpen, setIsDisclaimerModalOpen] = useState(false);
  const legCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && journeyId) {
      loadJourney();
      loadLegs();
    }
  }, [user, authLoading, router, journeyId]);

  const loadJourney = async () => {
    if (!user || !journeyId) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('journeys')
      .select('id, name, start_date, end_date, boat_id, state, is_ai_generated, boats(average_speed_knots, capacity)')
      .eq('id', journeyId)
      .single();

    if (error) {
      console.error('Error loading journey:', error);
    } else {
      setJourney(data);
      // Extract boat speed and capacity
      const speed = (data as any).boats?.average_speed_knots;
      const capacity = (data as any).boats?.capacity;
      setBoatSpeed(speed || null);
      setBoatCapacity(capacity || null);
    }
    setLoading(false);
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
      setLoading(false);
      return;
    }

    if (!legsData || legsData.length === 0) {
      setLegs([]);
      setLoading(false);
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
      // Use setTimeout to ensure map is fully ready
      setTimeout(() => {
        fitMapToLegs(mapRef.current, convertedLegs);
      }, 200);
    }
    
    setLoading(false);
  };

  // Effect to fit map when both map and legs are ready (only on initial load)
  const hasFittedInitialBounds = useRef(false);
  useEffect(() => {
    if (mapLoaded && mapRef.current && legs.length > 0 && !hasFittedInitialBounds.current) {
      // Use setTimeout to ensure everything is ready
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
      // Wait for map to load
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
    const padding = 0.1; // 10% padding
    const lngDiff = maxLng - minLng || 0.01; // Avoid division by zero
    const latDiff = maxLat - minLat || 0.01;
    
    const bounds: [[number, number], [number, number]] = [
      [minLng - lngDiff * padding, minLat - latDiff * padding],
      [maxLng + lngDiff * padding, maxLat + latDiff * padding]
    ];

    // Fit map to bounds
    try {
      map.fitBounds(bounds, {
        padding: 50, // 50px padding on all sides
        duration: 1000,
        maxZoom: 12, // Don't zoom in too much
      });
    } catch (error) {
      console.error('Error fitting bounds:', error);
      // Fallback to center on first waypoint
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
    // Fit map to show all legs if legs are already loaded
    if (legs.length > 0) {
      // Use setTimeout to ensure map is fully initialized
      setTimeout(() => {
        fitMapToLegs(map, legs);
      }, 200);
    }
  };

  const handleEditSuccess = () => {
    loadJourney();
  };

  const handleStartNewLeg = (lng: number, lat: number, name: string) => {
    // Create a new leg with the first waypoint
    const geocode = toGeocode(lat, lng);
    const newLeg: Leg = {
      id: `temp-${Date.now()}`, // Temporary ID until saved to database
      startWaypoint: {
        index: 0,
        geocode: {
          type: geocode.type,
          coordinates: [geocode.coordinates[0], geocode.coordinates[1]] as [number, number],
        },
        name: name,
      },
      endWaypoint: null,
    };
    
    setLegs([...legs, newLeg]);
  };

  const handleAddWaypoint = (lng: number, lat: number, name: string) => {
    // Find the active leg (one without an end point)
    const activeLegIndex = legs.findIndex(leg => leg.startWaypoint !== null && leg.endWaypoint === null);
    
    if (activeLegIndex === -1) {
      console.error('No active leg found to add waypoint to');
      return;
    }

    // Get the active leg
    const activeLeg = legs[activeLegIndex];
    const geocode = toGeocode(lat, lng);
    
    // Create the new waypoint
    const newWaypoint = {
      index: (activeLeg.intermediateWaypoints?.length || 0) + 1,
      geocode: {
        type: geocode.type,
        coordinates: [geocode.coordinates[0], geocode.coordinates[1]] as [number, number],
      },
      name: name,
    };
    
    // Update the leg with the new waypoint
    const updatedLegs = [...legs];
    updatedLegs[activeLegIndex] = {
      ...activeLeg,
      intermediateWaypoints: [...(activeLeg.intermediateWaypoints || []), newWaypoint],
    };
    
    setLegs(updatedLegs);
  };

  const handleEndLeg = async (lng: number, lat: number, name: string) => {
    // Find the active leg (one without an end point)
    const activeLegIndex = legs.findIndex(leg => leg.startWaypoint !== null && leg.endWaypoint === null);
    
    if (activeLegIndex === -1) {
      console.error('No active leg found to end');
      return;
    }

    // Get the active leg
    const activeLeg = legs[activeLegIndex];
    const geocode = toGeocode(lat, lng);
    
    // Calculate the end waypoint index (should be after all intermediate waypoints)
    const endIndex = (activeLeg.intermediateWaypoints?.length || 0) + 1;
    
    // Create the end waypoint
    const endWaypoint = {
      index: endIndex,
      geocode: {
        type: geocode.type,
        coordinates: [geocode.coordinates[0], geocode.coordinates[1]] as [number, number],
      },
      name: name,
    };
    
    // Build all waypoints array for database
    const allWaypoints = [];
    if (activeLeg.startWaypoint) {
      allWaypoints.push(activeLeg.startWaypoint);
    }
    if (activeLeg.intermediateWaypoints) {
      allWaypoints.push(...activeLeg.intermediateWaypoints);
    }
    allWaypoints.push(endWaypoint);
    
    // Create leg name: "Starting point to Ending point"
    const legName = `${activeLeg.startWaypoint?.name || 'Unknown'} to ${name}`;
    
    // Save to database
    const supabase = getSupabaseBrowserClient();
    
    if (activeLeg.id.startsWith('temp-')) {
      // New leg - insert into database
      const legInsertData: any = {
        journey_id: journeyId,
        name: legName,
      };

      // Set default crew_needed: boat capacity - 1 (assuming owner/skipper is always on board)
      if (boatCapacity && boatCapacity > 0) {
        legInsertData.crew_needed = Math.max(0, boatCapacity - 1);
      }

      const { data: newLeg, error: insertError } = await supabase
        .from('legs')
        .insert(legInsertData)
        .select('id')
        .single();
      
      if (insertError) {
        console.error('Error saving leg to database:', insertError);
        return;
      }

      // Insert waypoints using RPC function
      const { error: waypointsError } = await supabase.rpc('insert_leg_waypoints', {
        leg_id_param: newLeg.id,
        waypoints_param: allWaypoints.map(wp => ({
          index: wp.index,
          name: wp.name || null,
          lng: wp.geocode.coordinates[0],
          lat: wp.geocode.coordinates[1],
        })),
      });

      if (waypointsError) {
        console.error('Error saving waypoints:', waypointsError);
        // Rollback: delete the leg if waypoints failed
        await supabase.from('legs').delete().eq('id', newLeg.id);
        return;
      }
      
      // Update local state with database ID
      const updatedLegs = [...legs];
      updatedLegs[activeLegIndex] = {
        id: newLeg.id,
        startWaypoint: activeLeg.startWaypoint,
        endWaypoint: endWaypoint,
        intermediateWaypoints: activeLeg.intermediateWaypoints,
      };
      setLegs(updatedLegs);
      
      // Recenter and refocus map to show all legs after ending a leg
      if (mapRef.current && mapLoaded) {
        setTimeout(() => {
          fitMapToLegs(mapRef.current, updatedLegs);
        }, 200);
      }
    } else {
      // Existing leg - update in database
      const { error: updateError } = await supabase
        .from('legs')
        .update({
          name: legName,
        })
        .eq('id', activeLeg.id);
      
      if (updateError) {
        console.error('Error updating leg in database:', updateError);
        return;
      }

      // Update waypoints using RPC function
      const { error: waypointsError } = await supabase.rpc('insert_leg_waypoints', {
        leg_id_param: activeLeg.id,
        waypoints_param: allWaypoints.map(wp => ({
          index: wp.index,
          name: wp.name || null,
          lng: wp.geocode.coordinates[0],
          lat: wp.geocode.coordinates[1],
        })),
      });

      if (waypointsError) {
        console.error('Error updating waypoints:', waypointsError);
        return;
      }
      
      // Update local state
      const updatedLegs = [...legs];
      updatedLegs[activeLegIndex] = {
        ...activeLeg,
        endWaypoint: endWaypoint,
      };
      setLegs(updatedLegs);
      
      // Recenter and refocus map to show all legs after ending a leg
      if (mapRef.current && mapLoaded) {
        setTimeout(() => {
          fitMapToLegs(mapRef.current, updatedLegs);
        }, 200);
      }
    }
  };

  // Get all legs' waypoints for the map
  // Returns waypoints for all completed legs plus the active leg
  const getAllLegsWaypoints = (): Array<{ waypoints: Array<{ index: number; geocode: { type: string; coordinates: [number, number] }; name: string }>; legId: string; isComplete: boolean }> => {
    const allWaypoints: Array<{ waypoints: Array<{ index: number; geocode: { type: string; coordinates: [number, number] }; name: string }>; legId: string; isComplete: boolean }> = [];
    
    // Process all legs
    legs.forEach(leg => {
      if (!leg.startWaypoint) return;
      
      const waypoints: Array<{ index: number; geocode: { type: string; coordinates: [number, number] }; name: string }> = [];
      // Add start waypoint
      waypoints.push(leg.startWaypoint);
      
      // Add intermediate waypoints in order
      if (leg.intermediateWaypoints) {
        const sortedWaypoints = [...leg.intermediateWaypoints].sort((a, b) => a.index - b.index);
        waypoints.push(...sortedWaypoints);
      }
      
      // Add end waypoint if it exists
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

  // Get active leg waypoints for the map (for determining if there's an active leg)
  const getActiveLegWaypoints = () => {
    // Find the active leg (one without an end point)
    const activeLeg = legs.find(leg => leg.startWaypoint !== null && leg.endWaypoint === null);
    
    if (!activeLeg || !activeLeg.startWaypoint) return [];
    
    const waypoints = [];
    // Add start waypoint
    waypoints.push(activeLeg.startWaypoint);
    
    // Add intermediate waypoints in order
    if (activeLeg.intermediateWaypoints) {
      const sortedWaypoints = [...activeLeg.intermediateWaypoints].sort((a, b) => a.index - b.index);
      waypoints.push(...sortedWaypoints);
    }
    
    return waypoints;
  };

  // Check if the active leg has an end point
  const hasActiveLegWithEnd = () => {
    const activeLeg = legs.find(leg => leg.startWaypoint !== null && leg.endWaypoint === null);
    if (!activeLeg && legs.length > 0) {
      const lastLeg = legs[legs.length - 1];
      return lastLeg.endWaypoint !== null;
    }
    return false;
  };

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
            initialCenter={[0, 20]} // Default center (can be updated based on journey/legs data)
            initialZoom={2}
            onMapLoad={handleMapLoad}
            onStartNewLeg={handleStartNewLeg}
            onAddWaypoint={handleAddWaypoint}
            onEndLeg={handleEndLeg}
            hasActiveLegWithoutEnd={legs.some(leg => leg.startWaypoint !== null && leg.endWaypoint === null)}
            activeLegWaypoints={getActiveLegWaypoints()}
            allLegsWaypoints={getAllLegsWaypoints()}
            selectedLegId={selectedLegId}
            onLegClick={(legId) => {
              setSelectedLegId(legId);
              // Scroll to the leg card
              const cardElement = legCardRefs.current.get(legId);
              if (cardElement) {
                cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }}
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

        {/* Left Sidebar - Journey Info - Overlays the map */}
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
                        <button
                          onClick={() => setIsDisclaimerModalOpen(true)}
                          title="AI Generated - Click for disclaimer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-md hover:bg-primary/20 transition-colors cursor-pointer"
                          aria-label="AI Generated - Click for disclaimer"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          AI generated
                        </button>
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
              <div className="flex-1 p-6 overflow-y-auto min-h-0">
                {legs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No legs yet. Click on the map to start a new leg.
                  </p>
                ) : (
                  <div>
                    {legs.map((leg) => (
                      <EditLegCard
                        key={leg.id}
                        startWaypoint={leg.startWaypoint}
                        endWaypoint={leg.endWaypoint}
                        startDate={leg.start_date}
                        endDate={leg.end_date}
                        boatSpeed={boatSpeed}
                        isSelected={selectedLegId === leg.id}
                        cardRef={(el) => {
                          if (el) {
                            legCardRefs.current.set(leg.id, el);
                          } else {
                            legCardRefs.current.delete(leg.id);
                          }
                        }}
                        onClick={() => {
                          setSelectedLegId(leg.id);
                          // Scroll to the leg card
                          const cardElement = legCardRefs.current.get(leg.id);
                          if (cardElement) {
                            cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }
                        }}
                        onEdit={() => {
                          setEditingLegId(leg.id);
                          setIsLegModalOpen(true);
                        }}
                        onDelete={() => {
                          // Open delete confirmation dialog
                          setLegToDelete(leg);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer - Sticky Icon Menu */}
              <div className="sticky bottom-0 border-t border-border bg-card py-2 px-4">
                <div className="flex items-center justify-center gap-2">
                  {/* Edit Journey */}
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="p-1 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                    title="Edit journey"
                    aria-label="Edit journey"
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
                  {/* Legs View (Current) */}
                  <div
                    className="p-1 text-primary rounded bg-primary/10"
                    title="Legs (current)"
                    aria-label="Legs (current)"
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
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                  {/* Registrations View */}
                  <Link
                    href={`/owner/journeys/${journeyId}/registrations`}
                    className="p-1 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                    title="View registrations"
                    aria-label="View registrations"
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </Link>
                  {/* Back to Journeys */}
                  <Link
                    href={`/owner/journeys`}
                    className="p-1 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                    title="Back to journeys"
                    aria-label="Back to journeys"
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

      {/* Journey Edit Modal */}
      {user && journey && (
        <>
          <JourneyFormModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={handleEditSuccess}
            journeyId={journey.id}
            userId={user.id}
          />
          <LegFormModal
            isOpen={isLegModalOpen}
            onClose={() => {
              setIsLegModalOpen(false);
              setEditingLegId(null);
            }}
            onSuccess={() => {
              loadLegs();
            }}
            journeyId={journeyId}
            legId={editingLegId}
          />
        </>
      )}

      {/* AI Generated Disclaimer Modal */}
      {isDisclaimerModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsDisclaimerModalOpen(false)}
        >
          <div
            className="bg-card rounded-lg shadow-xl max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <h2 className="text-2xl font-bold text-card-foreground">AI Generated Journey</h2>
              </div>
              <button
                onClick={() => setIsDisclaimerModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-2">Important Disclaimer</p>
                  <p>
                    This journey and legs are generated automatically by AI. Please note that this does not negate the need for proper navigation and passage planning, weather routing and general good seamanship. Always use proper navigation tools, navigation charts and pilotage etc. for planning the passages.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsDisclaimerModalOpen(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {legToDelete && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setLegToDelete(null)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">
                Delete Leg
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to permanently delete the leg?
              </p>
              <div className="flex gap-3 justify-end pt-4 border-t border-border">
                <button
                  onClick={() => setLegToDelete(null)}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const leg = legToDelete;
                    setLegToDelete(null);
                    
                    // Only delete from database if it's not a temporary leg
                    if (!leg.id.startsWith('temp-')) {
                      const supabase = getSupabaseBrowserClient();
                      const { error } = await supabase
                        .from('legs')
                        .delete()
                        .eq('id', leg.id);
                      
                      if (error) {
                        console.error('Error deleting leg from database:', error);
                        return;
                      }
                    }
                    
                    // Remove from local state
                    setLegs(legs.filter(l => l.id !== leg.id));
                  }}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
