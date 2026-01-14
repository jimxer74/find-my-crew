'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DateRangePicker, DateRange } from '@/app/components/ui/DateRangePicker';
import { formatDateShort } from '@/app/lib/dateFormat';
import { LocationAutocomplete, Location } from '@/app/components/ui/LocationAutocomplete';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type Waypoint = {
  index: number;
  geocode: {
    type: string;
    coordinates: [number, number];
  };
  name?: string;
};

type PublicLeg = {
  id: string;
  journeyId: string;
  journeyName: string;
  name: string;
  waypoints: Waypoint[];
  start_date?: string | null;
  end_date?: string | null;
};

export function BrowseJourneys() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [zoomLevel, setZoomLevel] = useState<number>(2);
  const [publicLegs, setPublicLegs] = useState<PublicLeg[]>([]);
  const datePickerRef = useRef<HTMLDivElement>(null);
  
  // Refs for map elements
  const routeSourcesRef = useRef<Map<string, string>>(new Map());
  const legMarkersRef = useRef<Map<string, mapboxgl.Marker[]>>(new Map());
  const lastViewportBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);
  const isLoadingLegsRef = useRef(false);
  const currentLegsRef = useRef<PublicLeg[]>([]); // Track current legs for comparison

    // Clear all legs from map
    const clearMapLegs = () => {
      if (!map.current) return;

      // Remove route lines
      routeSourcesRef.current.forEach((sourceId, legId) => {
        const layerId = `route-line-layer-${legId}`;
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      routeSourcesRef.current.clear();

      // Remove markers
      legMarkersRef.current.forEach((markers) => {
        markers.forEach(marker => marker.remove());
      });
      legMarkersRef.current.clear();

      setPublicLegs([]);
      currentLegsRef.current = []; // Clear ref as well
    };

  // Check if coordinates are within viewport bounds
  const isWithinViewport = (lng: number, lat: number): boolean => {
    if (!map.current) return false;
    const bounds = map.current.getBounds();
    return bounds.contains([lng, lat]);
  };

  // Check if viewport has changed significantly
  const hasViewportChanged = (): boolean => {
    if (!map.current) return false;
    const currentBounds = map.current.getBounds();
    const lastBounds = lastViewportBoundsRef.current;

    // Always load on first time (no last bounds)
    if (!lastBounds) return true;

    // Check if bounds have changed significantly (more than 10% difference)
    const currentCenter = currentBounds.getCenter();
    const lastCenter = lastBounds.getCenter();
    const currentWidth = currentBounds.getEast() - currentBounds.getWest();
    const lastWidth = lastBounds.getEast() - lastBounds.getWest();
    const currentHeight = currentBounds.getNorth() - currentBounds.getSouth();
    const lastHeight = lastBounds.getNorth() - lastBounds.getSouth();

    const centerDiff = Math.abs(currentCenter.lng - lastCenter.lng) + Math.abs(currentCenter.lat - lastCenter.lat);
    const widthDiff = Math.abs(currentWidth - lastWidth) / Math.max(currentWidth, lastWidth);
    const heightDiff = Math.abs(currentHeight - lastHeight) / Math.max(currentHeight, lastHeight);

    // Consider changed if center moved significantly or viewport size changed by more than 10%
    return centerDiff > 0.01 || widthDiff > 0.1 || heightDiff > 0.1;
  };

  // Load public journeys and legs
  const loadPublicJourneys = async () => {
    if (!map.current || isLoadingLegsRef.current) {
      console.log('loadPublicJourneys: Skipping - no map or already loading');
      return;
    }

    const currentZoom = map.current.getZoom();
    console.log('loadPublicJourneys: Current zoom:', currentZoom);
    
    if (currentZoom <= 3.5) {
      console.log('loadPublicJourneys: Zoom too low, skipping');
      return; // Don't load if zoom is too low
    }

    // Check if viewport has changed significantly before loading
    if (!hasViewportChanged()) {
      console.log('loadPublicJourneys: Viewport has not changed significantly, skipping');
      return; // Skip if viewport hasn't changed enough
    }

    // Prevent concurrent loads
    isLoadingLegsRef.current = true;
    const bounds = map.current.getBounds();
    const supabase = getSupabaseBrowserClient();

    console.log('loadPublicJourneys: Starting to load journeys...');

    try {
      // Get all published journeys
      const { data: journeys, error: journeysError } = await supabase
        .from('journeys')
        .select('id, name')
        .eq('state', 'Published');

      if (journeysError) {
        console.error('Error loading journeys:', journeysError);
        return;
      }

      console.log('loadPublicJourneys: Found journeys:', journeys?.length || 0);

      if (!journeys || journeys.length === 0) {
        console.log('loadPublicJourneys: No journeys found, clearing legs');
        clearMapLegs();
        return;
      }

      const journeyIds = journeys.map(j => j.id);

      // Get all legs for these journeys
      const { data: legs, error: legsError } = await supabase
        .from('legs')
        .select('id, journey_id, name, waypoints, start_date, end_date')
        .in('journey_id', journeyIds);

      if (legsError) {
        console.error('Error loading legs:', legsError);
        return;
      }

      console.log('loadPublicJourneys: Found legs:', legs?.length || 0);

      if (!legs) {
        clearMapLegs();
        return;
      }

      // Filter legs where any waypoint is within viewport
      const filteredLegs: PublicLeg[] = [];
      
      legs.forEach((leg: any) => {
        const waypoints = leg.waypoints || [];
        const hasWaypointInViewport = waypoints.some((wp: any) => {
          if (!wp.geocode || !wp.geocode.coordinates) return false;
          const [lng, lat] = wp.geocode.coordinates;
          return isWithinViewport(lng, lat);
        });

        if (hasWaypointInViewport) {
          const journey = journeys.find(j => j.id === leg.journey_id);
          filteredLegs.push({
            id: leg.id,
            journeyId: leg.journey_id,
            journeyName: journey?.name || 'Unknown Journey',
            name: leg.name || 'Unnamed Leg',
            waypoints: waypoints.map((wp: any) => ({
              index: wp.index,
              geocode: {
                type: wp.geocode.type,
                coordinates: wp.geocode.coordinates,
              },
              name: wp.name,
            })),
            start_date: leg.start_date,
            end_date: leg.end_date,
          });
        }
      });

      console.log('loadPublicJourneys: Filtered legs in viewport:', filteredLegs.length);
      setPublicLegs(filteredLegs);
      updateLegsOnMap(filteredLegs);
      lastViewportBoundsRef.current = bounds;
    } catch (error) {
      console.error('Error loading public journeys:', error);
    } finally {
      isLoadingLegsRef.current = false;
    }
  };

  // Update legs on map - only add/remove what's needed
  const updateLegsOnMap = (newLegs: PublicLeg[]) => {
    console.log('updateLegsOnMap: Called with', newLegs.length, 'legs');
    if (!map.current) {
      console.log('updateLegsOnMap: Skipping - no map.current');
      return;
    }
    
    // Check if map is loaded
    if (!map.current.loaded()) {
      console.log('updateLegsOnMap: Map not loaded yet, waiting...');
      map.current.once('load', () => {
        updateLegsOnMap(newLegs);
      });
      return;
    }

    // Get current leg IDs from ref (more reliable than state)
    const currentLegIds = new Set(currentLegsRef.current.map(leg => leg.id));
    const newLegIds = new Set(newLegs.map(leg => leg.id));

    console.log('updateLegsOnMap: Current legs:', currentLegIds.size, 'New legs:', newLegIds.size);

    // Remove legs that are no longer in viewport
    currentLegIds.forEach(legId => {
      if (!newLegIds.has(legId)) {
        console.log('updateLegsOnMap: Removing leg', legId);
        removeLegFromMap(legId);
      }
    });

    // Add legs that are newly in viewport
    newLegs.forEach((leg) => {
      if (!currentLegIds.has(leg.id)) {
        // New leg - add it
        console.log('updateLegsOnMap: Adding leg', leg.id);
        addLegToMap(leg);
      }
      // If leg already exists, keep it (no need to redraw)
    });

    // Update the ref with new legs
    currentLegsRef.current = newLegs;
  };

  // Remove a single leg from the map
  const removeLegFromMap = (legId: string) => {
    if (!map.current) return;

    // Remove route line
    const sourceId = routeSourcesRef.current.get(legId);
    if (sourceId) {
      const layerId = `route-line-layer-${legId}`;
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
      routeSourcesRef.current.delete(legId);
    }

    // Remove markers
    const markers = legMarkersRef.current.get(legId);
    if (markers) {
      markers.forEach(marker => marker.remove());
      legMarkersRef.current.delete(legId);
    }
  };

  // Add a single leg to the map
  const addLegToMap = (leg: PublicLeg) => {
    if (!map.current || leg.waypoints.length < 2) return;

    // Sort waypoints by index
    const sortedWaypoints = [...leg.waypoints].sort((a, b) => a.index - b.index);
    const startWaypoint = sortedWaypoints[0];
    const endWaypoint = sortedWaypoints[sortedWaypoints.length - 1];

    if (!startWaypoint || !endWaypoint) return;

    // Draw route line using all waypoints
    const coordinates: [number, number][] = sortedWaypoints.map(wp => wp.geocode.coordinates);

    if (coordinates.length < 2) return;

    const sourceId = `route-line-${leg.id}`;
    const layerId = `route-line-layer-${leg.id}`;

    // Add source and layer
    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates,
          },
        },
      });

      // Add layer - grey, thinner, and dotted
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#6b7280', // grey-500
          'line-width': 1.5, // Even thinner
          'line-opacity': 0.8,
          'line-dasharray': [2, 2], // Dotted line
        },
      });

      routeSourcesRef.current.set(leg.id, sourceId);
    }

    // Add markers
    const markers: mapboxgl.Marker[] = [];

    // Start marker with "S" - always on top
    const [startLng, startLat] = startWaypoint.geocode.coordinates;
    const startEl = document.createElement('div');
    startEl.className = 'leg-start-marker';
    startEl.style.width = '24px';
    startEl.style.height = '24px';
    startEl.style.borderRadius = '50%';
    startEl.style.backgroundColor = '#6b7280'; // grey-500
    startEl.style.border = '3px solid white';
    startEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    startEl.style.cursor = 'pointer';
    startEl.style.display = 'flex';
    startEl.style.alignItems = 'center';
    startEl.style.justifyContent = 'center';
    startEl.style.zIndex = '100'; // Always on top
    
    const startText = document.createElement('span');
    startText.textContent = 'S';
    startText.style.color = 'white';
    startText.style.fontSize = '12px';
    startText.style.fontWeight = 'bold';
    startText.style.lineHeight = '1';
    startEl.appendChild(startText);

    const startMarker = new mapboxgl.Marker({ 
      element: startEl, 
      anchor: 'center',
      zIndexOffset: 1000 // Ensure it's always on top
    })
      .setLngLat([startLng, startLat])
      .addTo(map.current!);
    
    markers.push(startMarker);

    // End marker - simple gray waypoint (no letter)
    const [endLng, endLat] = endWaypoint.geocode.coordinates;
    const endEl = document.createElement('div');
    endEl.className = 'leg-end-marker';
    endEl.style.width = '16px';
    endEl.style.height = '16px';
    endEl.style.borderRadius = '50%';
    endEl.style.backgroundColor = '#6b7280'; // grey-500
    endEl.style.border = '2px solid white';
    endEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    endEl.style.cursor = 'pointer';

    const endMarker = new mapboxgl.Marker({ 
      element: endEl, 
      anchor: 'center'
    })
      .setLngLat([endLng, endLat])
      .addTo(map.current!);
    
    markers.push(endMarker);

    legMarkersRef.current.set(leg.id, markers);
  };

  // Draw legs on map (kept for backwards compatibility, but now uses updateLegsOnMap)
  const drawLegsOnMap = (legs: PublicLeg[]) => {
    // Clear all first, then add new ones
    clearMapLegs();
    legs.forEach(leg => addLegToMap(leg));
  };

  // Legacy function - kept for initial load
  const drawLegsOnMapLegacy = (legs: PublicLeg[]) => {
    console.log('drawLegsOnMap: Called with', legs.length, 'legs');
    if (!map.current) {
      console.log('drawLegsOnMap: Skipping - no map.current');
      return;
    }
    
    // Check if map is loaded
    if (!map.current.loaded()) {
      console.log('drawLegsOnMap: Map not loaded yet, waiting...');
      map.current.once('load', () => {
        drawLegsOnMap(legs);
      });
      return;
    }

    // Clear existing legs
    clearMapLegs();

    legs.forEach((leg) => {
      if (leg.waypoints.length < 2) return;

      // Sort waypoints by index
      const sortedWaypoints = [...leg.waypoints].sort((a, b) => a.index - b.index);
      const startWaypoint = sortedWaypoints[0];
      const endWaypoint = sortedWaypoints[sortedWaypoints.length - 1];

      if (!startWaypoint || !endWaypoint) return;

      // Draw route line using all waypoints
      const coordinates: [number, number][] = sortedWaypoints.map(wp => wp.geocode.coordinates);

      if (coordinates.length < 2) return;

      const sourceId = `route-line-${leg.id}`;
      const layerId = `route-line-layer-${leg.id}`;

      // Add source
      if (!map.current?.getSource(sourceId)) {
        map.current?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates,
            },
          },
        });

        // Add layer - grey, thinner, and dotted
        map.current?.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#6b7280', // grey-500
            'line-width': 1.5, // Even thinner
            'line-opacity': 0.8,
            'line-dasharray': [2, 2], // Dotted line
          },
        });

        routeSourcesRef.current.set(leg.id, sourceId);
      }

      // Add markers - only start and end, no intermediate waypoints
      const markers: mapboxgl.Marker[] = [];

      // Start marker with "S" - always on top
      const [startLng, startLat] = startWaypoint.geocode.coordinates;
      const startEl = document.createElement('div');
      startEl.className = 'leg-start-marker';
      startEl.style.width = '24px';
      startEl.style.height = '24px';
      startEl.style.borderRadius = '50%';
      startEl.style.backgroundColor = '#6b7280'; // grey-500
      startEl.style.border = '3px solid white';
      startEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
      startEl.style.cursor = 'pointer';
      startEl.style.display = 'flex';
      startEl.style.alignItems = 'center';
      startEl.style.justifyContent = 'center';
      startEl.style.zIndex = '100'; // Always on top
      
      const startText = document.createElement('span');
      startText.textContent = 'S';
      startText.style.color = 'white';
      startText.style.fontSize = '12px';
      startText.style.fontWeight = 'bold';
      startText.style.lineHeight = '1';
      startEl.appendChild(startText);

      const startMarker = new mapboxgl.Marker({ 
        element: startEl, 
        anchor: 'center',
        zIndexOffset: 1000 // Ensure it's always on top
      })
        .setLngLat([startLng, startLat])
        .addTo(map.current!);
      
      markers.push(startMarker);

      // End marker - simple gray waypoint (no letter)
      const [endLng, endLat] = endWaypoint.geocode.coordinates;
      const endEl = document.createElement('div');
      endEl.className = 'leg-end-marker';
      endEl.style.width = '16px';
      endEl.style.height = '16px';
      endEl.style.borderRadius = '50%';
      endEl.style.backgroundColor = '#6b7280'; // grey-500
      endEl.style.border = '2px solid white';
      endEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      endEl.style.cursor = 'pointer';

      const endMarker = new mapboxgl.Marker({ 
        element: endEl, 
        anchor: 'center'
      })
        .setLngLat([endLng, endLat])
        .addTo(map.current!);
      
      markers.push(endMarker);

      legMarkersRef.current.set(leg.id, markers);
    });
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('MAPBOX_ACCESS_TOKEN is not set. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file');
      return;
    }

    mapboxgl.accessToken = accessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [0, 20], // Default center
      zoom: 2,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Track zoom level - use ref to avoid closure issues
    const updateZoom = () => {
      const currentMap = map.current;
      if (currentMap) {
        try {
          const zoom = currentMap.getZoom();
          setZoomLevel(zoom);
        } catch (error) {
          console.error('Error getting zoom:', error);
        }
      }
    };

    // Handle viewport changes (pan/zoom) - defined before use
    const handleMoveEnd = () => {
      console.log('handleMoveEnd: Called');
      updateZoom();
      const currentZoom = map.current?.getZoom() || 0;
      console.log('handleMoveEnd: Current zoom:', currentZoom);
      
      if (currentZoom <= 3.5) {
        // Clear legs when zoomed out
        console.log('handleMoveEnd: Zoom <= 3.5, clearing legs');
        clearMapLegs();
        lastViewportBoundsRef.current = null;
        return;
      }

      // Always reload when zoom > 3.5 (viewport change check happens inside loadPublicJourneys via hasViewportChanged)
      if (map.current) {
        console.log('handleMoveEnd: Calling loadPublicJourneys');
        loadPublicJourneys();
      }
    };

    // Set up event listeners
    map.current.on('load', () => {
      setMapLoaded(true);
      const initialZoom = map.current?.getZoom() || 2;
      setZoomLevel(initialZoom);
      // Load legs on initial load if zoom > 3.5
      if (initialZoom > 3.5 && map.current) {
        lastViewportBoundsRef.current = map.current.getBounds();
        loadPublicJourneys();
      }
    });

    // Attach zoom event listeners
    map.current.on('zoom', updateZoom);
    map.current.on('zoomend', updateZoom);
    map.current.on('moveend', handleMoveEnd);

    return () => {
      const currentMap = map.current;
      if (currentMap) {
        currentMap.off('zoom', updateZoom);
        currentMap.off('zoomend', updateZoom);
        currentMap.off('moveend', handleMoveEnd);
        clearMapLegs();
        currentMap.remove();
      }
      map.current = null;
    };
  }, []);

  const formatDateRange = (): string => {
    if (!dateRange.start && !dateRange.end) {
      return '';
    }
    if (dateRange.start && dateRange.end) {
      return `${formatDateShort(dateRange.start)} - ${formatDateShort(dateRange.end)}`;
    }
    if (dateRange.start) {
      return formatDateShort(dateRange.start);
    }
    return '';
  };

  const clearDateRange = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDateRange({ start: null, end: null });
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-lg">Loading map...</div>
        </div>
      )}
      
      {/* Debug Info */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-card/90 backdrop-blur-sm border border-border rounded-md px-3 py-2 text-sm text-foreground z-10">
        <div className="font-mono">
          Zoom: {zoomLevel.toFixed(2)}
        </div>
      </div>
      
      {/* Floating Filter Menu */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-transparent p-4 flex items-center gap-3">
          {/* Location Input */}
          <div className="flex-1">
            <LocationAutocomplete
              value={locationInput}
              onChange={(loc) => {
                setLocation(loc);
                setLocationInput(loc.name);
              }}
              onInputChange={(value) => {
                setLocationInput(value);
                if (!value) {
                  setLocation(null);
                }
              }}
              placeholder="Where?"
              className="text-sm"
            />
          </div>

          {/* Availability Date Range */}
          <div className="flex-1">
            <div
              ref={datePickerRef}
              className="relative"
            >
              <div
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-ring text-sm flex items-center justify-between cursor-pointer"
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                <span className={dateRange.start || dateRange.end ? 'text-foreground' : 'text-muted-foreground'}>
                  {formatDateRange() || 'When?'}
                </span>
                <div className="flex items-center gap-2">
                  {(dateRange.start || dateRange.end) && (
                    <div
                      onClick={clearDateRange}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      aria-label="Clear date range"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          clearDateRange(e as any);
                        }
                      }}
                    >
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Date Range Picker Dropdown */}
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-2 z-20">
                  <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    onClose={() => setShowDatePicker(false)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Search Button */}
          <button
            type="button"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
