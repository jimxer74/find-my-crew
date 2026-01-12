'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && journeyId) {
      loadJourney();
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

  const handleMapLoad = (map: any) => {
    // TODO: Add legs markers and routes to the map
    console.log('Map loaded:', map);
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

  const handleEndLeg = (lng: number, lat: number, name: string) => {
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
    
    // Update the leg with the end waypoint
    const updatedLegs = [...legs];
    updatedLegs[activeLegIndex] = {
      ...activeLeg,
      endWaypoint: endWaypoint,
    };
    
    setLegs(updatedLegs);
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
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 flex overflow-hidden relative">
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
                        onEdit={() => {
                          // TODO: Implement edit functionality
                          console.log('Edit leg:', leg.id);
                        }}
                        onSave={() => {
                          // TODO: Implement save functionality
                          console.log('Save leg:', leg.id);
                        }}
                        onDelete={() => {
                          setLegs(legs.filter(l => l.id !== leg.id));
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
    </div>
  );
}
