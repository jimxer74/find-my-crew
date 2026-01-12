'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { MapboxMap } from '@/app/components/MapboxMap';
import { JourneyFormModal } from '@/app/components/JourneyFormModal';
import { LegCard } from '@/app/components/LegCard';
import { toGeocode } from '@/app/lib/IGeoCode';

type Journey = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaneOpen, setIsPaneOpen] = useState(true);
  const [legs, setLegs] = useState<Leg[]>([]);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [legToDelete, setLegToDelete] = useState<Leg | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
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
      .select('id, name, start_date, end_date')
      .eq('id', journeyId)
      .single();

    if (error) {
      console.error('Error loading journey:', error);
    } else {
      setJourney(data);
    }
    setLoading(false);
  };

  const loadLegs = async () => {
    if (!user || !journeyId) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('legs')
      .select('id, name, waypoints')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading legs:', error);
    } else if (data) {
      // Convert database format to component format
      const convertedLegs: Leg[] = data.map((leg: any) => {
        const waypoints = leg.waypoints || [];
        const sortedWaypoints = [...waypoints].sort((a: any, b: any) => a.index - b.index);
        
        const startWaypoint = sortedWaypoints.find((w: any) => w.index === 0) || null;
        const endWaypoint = sortedWaypoints.find((w: any, idx: number, arr: any[]) => 
          idx === arr.length - 1 && w.index > 0
        ) || null;
        const intermediateWaypoints = sortedWaypoints.filter((w: any) => 
          w.index > 0 && w !== endWaypoint
        );

        return {
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
          intermediateWaypoints: intermediateWaypoints.map((w: any) => ({
            index: w.index,
            geocode: {
              type: w.geocode.type,
              coordinates: w.geocode.coordinates,
            },
            name: w.name || '',
          })),
        };
      });
      
      setLegs(convertedLegs);
      
      // Fit map to show all legs if map is loaded
      if (convertedLegs.length > 0 && mapRef.current && mapLoaded) {
        // Use setTimeout to ensure map is fully ready
        setTimeout(() => {
          fitMapToLegs(mapRef.current, convertedLegs);
        }, 200);
      }
    }
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
      const { data, error } = await supabase
        .from('legs')
        .insert({
          journey_id: journeyId,
          name: legName,
          waypoints: allWaypoints,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving leg to database:', error);
        return;
      }
      
      // Update local state with database ID
      const updatedLegs = [...legs];
      updatedLegs[activeLegIndex] = {
        id: data.id,
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
      const { error } = await supabase
        .from('legs')
        .update({
          name: legName,
          waypoints: allWaypoints,
        })
        .eq('id', activeLeg.id);
      
      if (error) {
        console.error('Error updating leg in database:', error);
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

      <main className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Toggle Button */}
        <button
          onClick={() => setIsPaneOpen(!isPaneOpen)}
          className={`absolute top-4 z-10 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all ${
            isPaneOpen ? 'left-[320px]' : 'left-4'
          }`}
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

        {/* Left Sidebar - Journey Info */}
        <div
          className={`${
            isPaneOpen ? 'w-80' : 'w-0'
          } border-r border-border bg-card flex flex-col transition-all duration-300 overflow-hidden`}
        >
          {isPaneOpen && (
            <>
              <div className="p-6 border-b border-border">
                {journey && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-lg font-semibold text-card-foreground">
                          {journey.name}
                        </h2>
                        <button
                          onClick={() => setIsEditModalOpen(true)}
                          title="Edit journey details"
                          className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          aria-label="Edit journey details"
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
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {journey.start_date && (
                          <p>
                            <span className="font-medium">Start:</span>{' '}
                            {new Date(journey.start_date).toLocaleDateString()}
                          </p>
                        )}
                        {journey.end_date && (
                          <p>
                            <span className="font-medium">End:</span>{' '}
                            {new Date(journey.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                {legs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No legs yet. Click on the map to start a new leg.
                  </p>
                ) : (
                  <div>
                    {legs.map((leg) => (
                      <LegCard
                        key={leg.id}
                        startWaypoint={leg.startWaypoint}
                        endWaypoint={leg.endWaypoint}
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
                          // TODO: Implement edit functionality
                          console.log('Edit leg:', leg.id);
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
            </>
          )}
        </div>

        {/* Right Side - Map Container */}
        <div className="flex-1 relative">
          <MapboxMap
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
            className="absolute inset-0"
          />
        </div>
      </main>

      {/* Journey Edit Modal */}
      {user && journey && (
        <JourneyFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
          journeyId={journey.id}
          userId={user.id}
        />
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
                  className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent font-medium transition-colors"
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
