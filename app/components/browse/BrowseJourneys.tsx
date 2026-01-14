'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DateRangePicker, DateRange } from '@/app/components/ui/DateRangePicker';
import { formatDateShort } from '@/app/lib/dateFormat';
import { LocationAutocomplete, Location } from '@/app/components/ui/LocationAutocomplete';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LegDetailsCard } from './LegDetailsCard';

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
  boat_speed?: number | null;
  boat_image_url?: string | null;
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
  const [selectedLegDetails, setSelectedLegDetails] = useState<PublicLeg | null>(null);
  const [journeyLegs, setJourneyLegs] = useState<PublicLeg[]>([]); // All legs in the current journey
  const datePickerRef = useRef<HTMLDivElement>(null);
  
  // Debug: Log when selectedLegDetails changes
  useEffect(() => {
    console.log('selectedLegDetails state changed:', selectedLegDetails);
  }, [selectedLegDetails]);
  
  // Refs for map elements
  const lastViewportBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);
  const isLoadingLegsRef = useRef(false);
  const currentLegsRef = useRef<PublicLeg[]>([]); // Track current legs for comparison
  const legStartWaypointsSourceId = 'leg-start-waypoints-clusters';
  const displayedJourneyIdRef = useRef<string | null>(null); // Track currently displayed journey
  const journeyRouteSourcesRef = useRef<Map<string, string>>(new Map()); // Track journey route sources
  const journeyEndMarkersSourceId = 'journey-end-markers';
  const legMarkerHandlersSetupRef = useRef(false); // Track if click handlers are set up
  const selectedLegIdRef = useRef<string | null>(null); // Track currently selected leg

    // Clear displayed journey route
    const clearDisplayedJourney = () => {
      if (!map.current) return;

      // Reset selected leg styling before clearing
      if (selectedLegIdRef.current) {
        resetLegStyling(selectedLegIdRef.current);
        updateMarkerColor(selectedLegIdRef.current, false);
      }
      
      // Hide leg details card
      setSelectedLegDetails(null);

      // Remove journey route lines
      journeyRouteSourcesRef.current.forEach((sourceId, legId) => {
        const layerId = `journey-route-${legId}`;
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      journeyRouteSourcesRef.current.clear();

      // Remove end markers
      if (map.current.getSource(journeyEndMarkersSourceId)) {
        if (map.current.getLayer('journey-end-markers-layer')) {
          map.current.removeLayer('journey-end-markers-layer');
        }
        map.current.removeSource(journeyEndMarkersSourceId);
      }

      displayedJourneyIdRef.current = null;
      selectedLegIdRef.current = null; // Reset selected leg when clearing journey
    };

    // Clear all legs from map
    const clearMapLegs = () => {
      if (!map.current) return;

      // Clear displayed journey first
      clearDisplayedJourney();

      // Remove clustering source and layers
      if (map.current.getSource(legStartWaypointsSourceId)) {
        if (map.current.getLayer('leg-clusters')) {
          map.current.removeLayer('leg-clusters');
        }
        if (map.current.getLayer('leg-cluster-count')) {
          map.current.removeLayer('leg-cluster-count');
        }
        if (map.current.getLayer('leg-unclustered-point')) {
          map.current.removeLayer('leg-unclustered-point');
        }
        map.current.removeSource(legStartWaypointsSourceId);
      }

      setPublicLegs([]);
      currentLegsRef.current = []; // Clear ref as well
    };

  // Check if coordinates are within viewport bounds
  const isWithinViewport = (lng: number, lat: number): boolean => {
    if (!map.current) return false;
    const bounds = map.current.getBounds();
    if (!bounds) return false;
    return bounds.contains([lng, lat]);
  };

  // Check if viewport has changed significantly
  const hasViewportChanged = (): boolean => {
    if (!map.current) return false;
    const currentBounds = map.current.getBounds();
    if (!currentBounds) return false;
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

      const journeyIds = journeys.map(j => j.id).filter(id => id); // Filter out any null/undefined IDs
      
      // Validate journeyIds before querying
      if (!journeyIds || journeyIds.length === 0) {
        console.log('No valid journey IDs to query, clearing map');
        clearMapLegs();
        return;
      }
      
      console.log('Querying legs for', journeyIds.length, 'journeys');
      console.log('Journey IDs:', journeyIds);

      // Get all legs for these journeys
      // Use a try-catch to handle potential query errors
      let legs, legsError;
      try {
        const result = await supabase
          .from('legs')
          .select('id, journey_id, name, waypoints, start_date, end_date')
          .in('journey_id', journeyIds);
        legs = result.data;
        legsError = result.error;
      } catch (queryError) {
        console.error('Exception querying legs:', queryError);
        legsError = queryError as any;
        legs = null;
      }

      // Handle errors - log details for debugging
      if (legsError) {
        const errorStr = JSON.stringify(legsError);
        const isEmptyError = errorStr === '{}' || Object.keys(legsError).length === 0;
        
        if (isEmptyError) {
          // Empty error object - ignore it, likely a false positive
          console.log('Empty error object ignored (false positive)');
        } else {
          // Real error - log full details
          console.error('Error loading legs:', legsError);
          console.error('Error message:', (legsError as any)?.message);
          console.error('Error code:', (legsError as any)?.code);
          console.error('Error details:', (legsError as any)?.details);
          console.error('Error hint:', (legsError as any)?.hint);
          
          // If it's a 400 error, it might be a query issue - try to continue if we have data
          if ((legsError as any)?.code === 'PGRST116' || (legsError as any)?.code === '22P02') {
            console.warn('Query syntax error detected, but continuing if data available');
          }
        }
      }
      
      // Always use data if available, regardless of error status
      if (!legs || legs.length === 0) {
        console.log('No legs data available, clearing map');
        clearMapLegs();
        return;
      }
      
      console.log('Using legs data:', legs.length, 'legs found');

      console.log('loadPublicJourneys: Found legs:', legs.length);

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
            boat_speed: null, // boat_speed column doesn't exist in legs table
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

  // Load and display full journey route
  const displayJourneyRoute = async (journeyId: string): Promise<void> => {
    if (!map.current) {
      console.error('displayJourneyRoute: map.current is null');
      return Promise.resolve();
    }

    console.log('displayJourneyRoute called:', journeyId, 'current:', displayedJourneyIdRef.current);

    // Clear previous journey if displayed
    if (displayedJourneyIdRef.current && displayedJourneyIdRef.current !== journeyId) {
      console.log('Clearing previous journey:', displayedJourneyIdRef.current);
      clearDisplayedJourney();
      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // If clicking the same journey, toggle it off
    if (displayedJourneyIdRef.current === journeyId) {
      clearDisplayedJourney();
      return Promise.resolve();
    }

    const supabase = getSupabaseBrowserClient();

    try {
      // Get all legs for this journey
      const { data: legs, error } = await supabase
        .from('legs')
        .select('id, journey_id, name, waypoints')
        .eq('journey_id', journeyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading journey legs:', error);
        return Promise.resolve();
      }

      if (!legs || legs.length === 0) {
        console.log('No legs found for journey:', journeyId);
        displayedJourneyIdRef.current = journeyId; // Set this even if no legs
        return Promise.resolve();
      }

      console.log('Displaying', legs.length, 'legs for journey:', journeyId);

      // Track which leg IDs were actually created
      const createdLegIds: string[] = [];

      // Draw route lines for all legs
      legs.forEach((leg: any) => {
        if (!map.current) return;
        if (!leg.waypoints || leg.waypoints.length < 2) {
          console.log('Skipping leg (insufficient waypoints):', leg.id, 'waypoints:', leg.waypoints?.length);
          return;
        }

        const sortedWaypoints = [...leg.waypoints].sort((a: any, b: any) => a.index - b.index);
        const coordinates: [number, number][] = sortedWaypoints.map((wp: any) => wp.geocode.coordinates);

        // Add route line
        const sourceId = `journey-route-${leg.id}`;
        const layerId = `journey-route-${leg.id}`;
        
        // Remove existing source/layer if it exists (to ensure clean state)
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }

        try {
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

          map.current.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#6b7280',
              'line-width': 4,
              'line-opacity': 0.8,
              'line-dasharray': [2, 2],
            },
          });

          journeyRouteSourcesRef.current.set(leg.id, sourceId);
          createdLegIds.push(leg.id);
          console.log('Added route layer:', layerId, 'for leg:', leg.id);
        } catch (layerError) {
          console.error('Error adding layer for leg:', leg.id, layerError);
        }
      });

      console.log('Created layers for leg IDs:', createdLegIds);
      console.log('journeyRouteSourcesRef now contains:', Array.from(journeyRouteSourcesRef.current.keys()));

      // Set displayed journey ID BEFORE waiting for idle
      displayedJourneyIdRef.current = journeyId;

      // Wait for map to finish rendering all new layers
      await new Promise<void>((resolve) => {
        if (!map.current) {
          resolve();
          return;
        }
        // Wait for map to be idle (all layers rendered)
        map.current.once('idle', () => {
          console.log('Map is idle after adding journey routes');
          resolve();
        });
        // Fallback timeout
        setTimeout(() => {
          console.log('Timeout waiting for map idle');
          resolve();
        }, 1000);
      });

      // Verify layers exist
      const verifiedLayers: string[] = [];
      createdLegIds.forEach(legId => {
        const layerId = `journey-route-${legId}`;
        if (map.current?.getLayer(layerId)) {
          verifiedLayers.push(legId);
        }
      });
      console.log('Verified layers exist:', verifiedLayers);

      console.log('Journey route display complete:', journeyId);
    } catch (error) {
      console.error('Error displaying journey route:', error);
      displayedJourneyIdRef.current = journeyId; // Set this even on error
    }
  };

  // Reset leg styling to default (gray, dashed)
  const resetLegStyling = (legId: string) => {
    if (!map.current) return;
    const layerId = `journey-route-${legId}`;
    if (map.current.getLayer(layerId)) {
      console.log('Resetting leg styling:', legId);
      map.current.setPaintProperty(layerId, 'line-color', '#6b7280');
      map.current.setPaintProperty(layerId, 'line-width', 4);
      map.current.setPaintProperty(layerId, 'line-dasharray', [2, 2]);
    } else {
      console.log('Layer not found for reset:', layerId);
    }
  };

  // Highlight leg styling (dark blue, solid, thicker)
  const highlightLegStyling = (legId: string) => {
    if (!map.current) return;
    const layerId = `journey-route-${legId}`;
    if (map.current.getLayer(layerId)) {
      console.log('Highlighting leg styling:', legId);
      map.current.setPaintProperty(layerId, 'line-color', '#22276E'); // dark blue
      map.current.setPaintProperty(layerId, 'line-width', 4); // Make it thicker
      // Remove dasharray to make it solid - empty array makes it solid
      (map.current as any).setPaintProperty(layerId, 'line-dasharray', []); // solid line
    } else {
      console.log('Layer not found for highlight:', layerId);
    }
  };


  // Update marker color (green or gray) by updating source data with selected property
  const updateMarkerColor = (legId: string, isSelected: boolean) => {
    if (!map.current) return;

    const source = map.current.getSource(legStartWaypointsSourceId) as mapboxgl.GeoJSONSource;
    if (!source) return;

    // Get current data from the source
    const currentData = (source as any)._data as any;
    if (!currentData || !currentData.features) return;

    // Update the feature's selected property
    const updatedFeatures = currentData.features.map((f: any) => {
      if (f.properties?.legId === legId) {
        return {
          ...f,
          properties: {
            ...f.properties,
            selected: isSelected,
          },
        };
      }
      // Reset other features
      if (f.properties?.selected && f.properties?.legId !== legId) {
        return {
          ...f,
          properties: {
            ...f.properties,
            selected: false,
          },
        };
      }
      return f;
    });

    // Update source data - this will trigger the layer to re-render with new icon based on 'selected' property
    source.setData({
      type: 'FeatureCollection',
      features: updatedFeatures,
    });
  };

  // Handle leg start marker click - highlight that leg
  const handleLegMarkerClick = async (legId: string, journeyId: string) => {
    console.log('handleLegMarkerClick called with:', { legId, journeyId });
    
    if (!map.current) {
      console.error('handleLegMarkerClick: map.current is null');
      return;
    }
    
    // Check if map is loaded - but don't block if it's not fully loaded yet
    // The map can still be functional even if not fully loaded
    let isMapLoaded = true;
    try {
      isMapLoaded = map.current.loaded();
    } catch (error) {
      console.warn('Error checking map.loaded(), proceeding anyway:', error);
      // If we can't check, proceed anyway
      isMapLoaded = true;
    }
    
    if (!isMapLoaded) {
      console.warn('handleLegMarkerClick: map is not fully loaded yet, but proceeding');
      // Don't return - proceed anyway as the map might still be functional
    }

    console.log('handleLegMarkerClick:', { legId, journeyId, currentSelected: selectedLegIdRef.current, currentJourney: displayedJourneyIdRef.current });

    // If clicking the same leg, toggle it off
    if (selectedLegIdRef.current === legId) {
      resetLegStyling(legId);
      updateMarkerColor(legId, false);
      selectedLegIdRef.current = null;
      setSelectedLegDetails(null); // Hide details card
      return;
    }

    // Reset previous leg styling if another leg was selected
    if (selectedLegIdRef.current) {
      console.log('Resetting previous leg:', selectedLegIdRef.current);
      resetLegStyling(selectedLegIdRef.current);
      updateMarkerColor(selectedLegIdRef.current, false);
    }

    // Ensure journey route is displayed
    const wasDifferentJourney = displayedJourneyIdRef.current !== journeyId;
    if (wasDifferentJourney) {
      console.log('Displaying new journey route:', journeyId, 'previous:', displayedJourneyIdRef.current);
      await displayJourneyRoute(journeyId);
      console.log('After displayJourneyRoute, displayedJourneyIdRef.current:', displayedJourneyIdRef.current);
    }

    // Wait a bit more to ensure everything is rendered, especially if switching journeys
    await new Promise(resolve => setTimeout(resolve, wasDifferentJourney ? 200 : 100));

    // Highlight the clicked leg
    console.log('Highlighting leg:', legId);
    const layerId = `journey-route-${legId}`;
    const availableLegIds = Array.from(journeyRouteSourcesRef.current.keys());
    console.log('Available leg IDs in journeyRouteSourcesRef:', availableLegIds);
    console.log('Looking for layer:', layerId);
    console.log('Current displayed journey:', displayedJourneyIdRef.current);
    
    // Always update marker color (even if route doesn't exist)
    updateMarkerColor(legId, true);
    selectedLegIdRef.current = legId;
    
    // Fetch and display leg details
    console.log('=== Fetching leg details for legId:', legId, '===');
    console.log('Available publicLegs count:', publicLegs.length);
    console.log('publicLegs IDs:', publicLegs.map(l => l.id));
    
    // First, try to use data from publicLegs (we know it exists since the marker was created from it)
    const legFromPublicLegs = publicLegs.find(l => l.id === legId);
    console.log('Leg found in publicLegs:', !!legFromPublicLegs);
    
    if (legFromPublicLegs) {
      console.log('Using leg from publicLegs:', legFromPublicLegs);
      
      // Fetch boat image and speed from journey -> boat relationship
      let legDetails: PublicLeg = { 
        ...legFromPublicLegs,
        boat_speed: null,
        boat_image_url: null,
      };
      
      // Fetch boat info through journey
      try {
        const supabase = getSupabaseBrowserClient();
        console.log('Fetching boat info for journeyId:', legFromPublicLegs.journeyId);
        
        // First get journey with boat_id
        const { data: journeyData, error: journeyError } = await supabase
          .from('journeys')
          .select('boat_id')
          .eq('id', legFromPublicLegs.journeyId)
          .single();
        
        console.log('Journey data:', journeyData, 'error:', journeyError);
        
        if (!journeyError && journeyData && journeyData.boat_id) {
          const boatId = journeyData.boat_id;
          console.log('Found boat_id:', boatId);
          
          // Get boat speed and images from boats table
          const { data: boatData, error: boatError } = await supabase
            .from('boats')
            .select('average_speed_knots, images')
            .eq('id', boatId)
            .single();
          
          console.log('Boat data:', boatData, 'error:', boatError);
          
          if (!boatError && boatData) {
            legDetails.boat_speed = boatData.average_speed_knots || null;
            console.log('Set boat_speed:', legDetails.boat_speed);
            
            // Get first image from images array
            if (boatData.images && Array.isArray(boatData.images) && boatData.images.length > 0) {
              legDetails.boat_image_url = boatData.images[0];
              console.log('Set boat_image_url from database:', legDetails.boat_image_url);
            } else {
              console.log('No images in boat.images array');
            }
          }
        } else {
          console.log('No journey data or boat_id found');
        }
      } catch (error) {
        console.error('Exception fetching boat info:', error);
      }
      
      // Fetch all legs for this journey to enable navigation
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: allLegsData, error: allLegsError } = await supabase
          .from('legs')
          .select('id, journey_id, name, waypoints, start_date, end_date')
          .eq('journey_id', legFromPublicLegs.journeyId)
          .order('start_date', { ascending: true, nullsFirst: false });
        
        if (!allLegsError && allLegsData) {
          // Map to PublicLeg format
          const journeyLegsList: PublicLeg[] = allLegsData.map((leg: any) => ({
            id: leg.id,
            journeyId: leg.journey_id,
            journeyName: legFromPublicLegs.journeyName,
            name: leg.name || 'Unnamed Leg',
            waypoints: leg.waypoints || [],
            start_date: leg.start_date,
            end_date: leg.end_date,
            boat_speed: null,
            boat_image_url: null,
          }));
          
          setJourneyLegs(journeyLegsList);
          console.log('Loaded journey legs for navigation:', journeyLegsList.length);
        }
      } catch (error) {
        console.error('Error loading journey legs:', error);
      }
      
      console.log('=== Setting leg details state ===');
      console.log('Leg details object:', legDetails);
      console.log('Calling setSelectedLegDetails...');
      
      setSelectedLegDetails(legDetails);
      
      console.log('setSelectedLegDetails called successfully');
      
      // Verify state was set after a short delay
      setTimeout(() => {
        console.log('State check after timeout - selectedLegDetails should be set now');
      }, 200);
    } else {
      console.warn('Leg not found in publicLegs, fetching from database as fallback, legId:', legId);
      
      // Fallback: fetch from database
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: legData, error } = await supabase
          .from('legs')
          .select('id, journey_id, name, waypoints, start_date, end_date')
          .eq('id', legId)
          .single();
        
        if (!error && legData) {
          // Fetch journey name
          const { data: journeyData } = await supabase
            .from('journeys')
            .select('name')
            .eq('id', legData.journey_id)
            .single();
          
          // Fetch boat info
          let boatSpeed = null;
          let boatImageUrl = null;
          
          try {
            console.log('Fetching boat info for journeyId (fallback):', legData.journey_id);
            
            // Get journey with boat_id
            const { data: journeyWithBoat, error: journeyError } = await supabase
              .from('journeys')
              .select('boat_id')
              .eq('id', legData.journey_id)
              .single();
            
            console.log('Journey data (fallback):', journeyWithBoat, 'error:', journeyError);
            
            if (!journeyError && journeyWithBoat && journeyWithBoat.boat_id) {
              const boatId = journeyWithBoat.boat_id;
              
              // Get boat speed and images from boats table
              const { data: boatData, error: boatError } = await supabase
                .from('boats')
                .select('average_speed_knots, images')
                .eq('id', boatId)
                .single();
              
              console.log('Boat data (fallback):', boatData, 'error:', boatError);
              
              if (!boatError && boatData) {
                boatSpeed = boatData.average_speed_knots || null;
                
                // Get first image from images array
                if (boatData.images && Array.isArray(boatData.images) && boatData.images.length > 0) {
                  boatImageUrl = boatData.images[0];
                  console.log('Set boat_image_url (fallback):', boatImageUrl);
                } else {
                  console.log('No images in boat.images array (fallback)');
                }
              }
            }
          } catch (error) {
            console.error('Error fetching boat info (fallback):', error);
          }
          
          const legDetails: PublicLeg = {
            id: legData.id,
            journeyId: legData.journey_id,
            journeyName: journeyData?.name || 'Unknown Journey',
            name: legData.name || 'Unnamed Leg',
            waypoints: legData.waypoints || [],
            start_date: legData.start_date,
            end_date: legData.end_date,
            boat_speed: boatSpeed,
            boat_image_url: boatImageUrl,
          };
          
          // Fetch all legs for this journey to enable navigation
          try {
            const { data: allLegsData, error: allLegsError } = await supabase
              .from('legs')
              .select('id, journey_id, name, waypoints, start_date, end_date')
              .eq('journey_id', legData.journey_id)
              .order('start_date', { ascending: true, nullsFirst: false });
            
            if (!allLegsError && allLegsData) {
              // Map to PublicLeg format
              const journeyLegsList: PublicLeg[] = allLegsData.map((leg: any) => ({
                id: leg.id,
                journeyId: leg.journey_id,
                journeyName: journeyData?.name || 'Unknown Journey',
                name: leg.name || 'Unnamed Leg',
                waypoints: leg.waypoints || [],
                start_date: leg.start_date,
                end_date: leg.end_date,
                boat_speed: null,
                boat_image_url: null,
              }));
              
              setJourneyLegs(journeyLegsList);
              console.log('Loaded journey legs for navigation (fallback):', journeyLegsList.length);
            }
          } catch (error) {
            console.error('Error loading journey legs (fallback):', error);
          }
          
          console.log('Fetched leg from database:', legDetails);
          setSelectedLegDetails(legDetails);
        } else {
          console.error('Failed to fetch leg from database:', error);
        }
      } catch (error) {
        console.error('Exception fetching leg from database:', error);
      }
    }
    
    // Check if layer exists - retry more times if switching journeys
    let layerExists = map.current?.getLayer(layerId);
    let retryCount = 0;
    const maxRetries = wasDifferentJourney ? 10 : 5; // More retries when switching journeys
    
    console.log(`Initial layer check: ${layerExists ? 'FOUND' : 'NOT FOUND'}, will retry up to ${maxRetries} times`);
    
    while (!layerExists && retryCount < maxRetries) {
      // Verify we're still on the correct journey
      if (displayedJourneyIdRef.current !== journeyId) {
        console.log('Journey changed during retry, stopping');
        break;
      }
      
      console.log(`Layer not found, retry ${retryCount + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 150));
      layerExists = map.current?.getLayer(layerId);
      
      if (layerExists) {
        console.log(`Layer found on retry ${retryCount + 1}!`);
        break;
      }
      
      retryCount++;
    }
    
    if (layerExists) {
      // Leg has a route - highlight it
      highlightLegStyling(legId);
      console.log('Successfully highlighted leg route:', legId);
    } else {
      // Leg doesn't have a route layer (might have insufficient waypoints)
      // Just highlight the marker, which we already did above
      console.log('Leg has no route layer after all retries, highlighting marker only:', legId);
      console.log('Available leg IDs with routes:', availableLegIds);
      console.log('Current displayed journey:', displayedJourneyIdRef.current);
      console.log('Expected journey:', journeyId);
      
      // Still try to highlight route after a longer delay in case it's still loading
      setTimeout(() => {
        if (displayedJourneyIdRef.current === journeyId) {
          const retryLayerExists = map.current?.getLayer(layerId);
          if (retryLayerExists) {
            highlightLegStyling(legId);
            console.log('Successfully highlighted leg route on final retry:', legId);
          } else {
            console.log('Final retry failed - layer still not found:', layerId);
            console.log('All available layers:', map.current?.getStyle().layers?.map(l => l.id).filter(id => id.startsWith('journey-route-')));
          }
        }
      }, 1000);
    }
  };

  // Update leg start waypoints clustering source
  const updateLegStartWaypointsClusters = (legs: PublicLeg[]) => {
    if (!map.current || !map.current.loaded()) return;

    // Create GeoJSON features for leg start waypoints
    // Preserve selected state for currently selected leg
    const currentlySelectedLegId = selectedLegIdRef.current;
    const features = legs
      .filter(leg => leg.waypoints.length > 0)
      .map(leg => {
        const sortedWaypoints = [...leg.waypoints].sort((a, b) => a.index - b.index);
        const startWaypoint = sortedWaypoints[0];
        if (!startWaypoint) return null;
        
        const [lng, lat] = startWaypoint.geocode.coordinates;
        return {
          type: 'Feature' as const,
          properties: {
            legId: leg.id,
            journeyId: leg.journeyId,
            legName: leg.name,
            journeyName: leg.journeyName,
            selected: leg.id === currentlySelectedLegId, // Preserve selected state
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [lng, lat],
          },
        };
      })
      .filter(f => f !== null);

    const geojson = {
      type: 'FeatureCollection' as const,
      features: features,
    };

    // Helper function to add marker layer
    const addMarkerLayer = () => {
      if (!map.current) return;
      
      // Remove layer if it exists (to ensure clean state)
      if (map.current.getLayer('leg-unclustered-point')) {
        map.current.removeLayer('leg-unclustered-point');
      }
      
      // Only add layer if icons are loaded
      if (!map.current.hasImage('mapbox-marker') || !map.current.hasImage('mapbox-marker-green')) {
        console.log('addMarkerLayer: Icons not loaded yet, skipping');
        return;
      }
      
      map.current.addLayer({
        id: 'leg-unclustered-point',
        type: 'symbol',
        source: legStartWaypointsSourceId,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': [
            'case',
            ['get', 'selected'],
            'mapbox-marker-green',
            'mapbox-marker'
          ],
          'icon-size': 1,
          'icon-anchor': 'bottom',
        },
      });
      
      console.log('addMarkerLayer: Layer added successfully');
      
      // Set up click handlers after layer is added (if not already set up)
      if (!legMarkerHandlersSetupRef.current) {
        setupLegMarkerClickHandlers();
      }
    };
    
    // Set up leg marker click handlers
    const setupLegMarkerClickHandlers = () => {
      if (!map.current || legMarkerHandlersSetupRef.current) {
        console.log('setupLegMarkerClickHandlers: Skipping - already set up or no map');
        return;
      }
      
      console.log('Setting up leg marker click handlers - map.current exists:', !!map.current);
      console.log('Layer exists:', !!map.current.getLayer('leg-unclustered-point'));
      
      // Handle leg start marker clicks - highlight leg
      map.current.on('click', 'leg-unclustered-point', async (e) => {
        console.log('=== Leg marker clicked! ===', e);
        console.log('Click point:', e.point);
        console.log('LngLat:', e.lngLat);
        
        try {
          const features = map.current!.queryRenderedFeatures(e.point, {
            layers: ['leg-unclustered-point'],
          });
          
          console.log('Features found:', features.length);
          if (features.length > 0) {
            console.log('Feature properties:', features[0].properties);
            console.log('Full feature:', features[0]);
          }
          
          if (features.length > 0 && features[0].properties) {
            const legId = features[0].properties.legId;
            const journeyId = features[0].properties.journeyId;
            
            console.log('Extracted:', { legId, journeyId });
            
            if (legId && journeyId) {
              console.log('Calling handleLegMarkerClick with:', { legId, journeyId });
              await handleLegMarkerClick(legId, journeyId);
            } else {
              console.error('Missing legId or journeyId in properties:', features[0].properties);
            }
          } else {
            console.warn('No features or properties found');
            // Try querying all layers at this point
            const allFeatures = map.current!.queryRenderedFeatures(e.point);
            console.log('All features at click point:', allFeatures.length, allFeatures);
          }
        } catch (error) {
          console.error('Error in click handler:', error);
        }
      });
      
      console.log('Leg marker click handler registered successfully');
      
      // Change cursor on hover for leg markers
      map.current.on('mouseenter', 'leg-unclustered-point', () => {
        console.log('Mouse entered leg marker');
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      map.current.on('mouseleave', 'leg-unclustered-point', () => {
        console.log('Mouse left leg marker');
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
      
      legMarkerHandlersSetupRef.current = true;
      console.log('Leg marker handlers setup complete, flag set to true');
    };

    // Helper function to load icons and ensure layer exists
    const ensureIconsAndLayer = () => {
      if (!map.current) return;

      const grayMarkerSvg = `
        <svg width="27" height="41" viewBox="0 0 27 41" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.5 0C6.04 0 0 6.04 0 13.5C0 23.58 13.5 41 13.5 41C13.5 41 27 23.58 27 13.5C27 6.04 20.96 0 13.5 0Z" fill="#6b7280"/>
          <circle cx="13.5" cy="13.5" r="6" fill="#fff"/>
        </svg>
      `;

      const greenMarkerSvg = `
        <svg width="27" height="41" viewBox="0 0 27 41" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.5 0C6.04 0 0 6.04 0 13.5C0 23.58 13.5 41 13.5 41C13.5 41 27 23.58 27 13.5C27 6.04 20.96 0 13.5 0Z" fill="#22276E"/>
          <circle cx="13.5" cy="13.5" r="6" fill="#fff"/>
        </svg>
      `;

      let iconsLoaded = 0;
      const totalIcons = 2;

      const checkAndAddLayer = () => {
        iconsLoaded++;
        console.log(`checkAndAddLayer: Icons loaded ${iconsLoaded}/${totalIcons}`);
        if (iconsLoaded >= totalIcons && map.current) {
          if (map.current.hasImage('mapbox-marker') && map.current.hasImage('mapbox-marker-green')) {
            console.log('checkAndAddLayer: Both icons loaded, adding layer');
            addMarkerLayer();
          } else {
            console.log('checkAndAddLayer: Icons not found in map:', {
              hasGray: map.current.hasImage('mapbox-marker'),
              hasGreen: map.current.hasImage('mapbox-marker-green')
            });
          }
        }
      };

      // Load gray marker
      if (!map.current.hasImage('mapbox-marker')) {
        const grayMarkerImage = new Image(27, 41);
        grayMarkerImage.onload = () => {
          if (map.current && !map.current.hasImage('mapbox-marker')) {
            map.current.addImage('mapbox-marker', grayMarkerImage);
            console.log('Loaded gray marker icon');
          }
          checkAndAddLayer();
        };
        grayMarkerImage.onerror = (err) => {
          console.error('Error loading gray marker:', err);
          checkAndAddLayer();
        };
        grayMarkerImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(grayMarkerSvg);
      } else {
        console.log('Gray marker already loaded');
        checkAndAddLayer();
      }

      // Load green marker
      if (!map.current.hasImage('mapbox-marker-green')) {
        const greenMarkerImage = new Image(27, 41);
        greenMarkerImage.onload = () => {
          if (map.current && !map.current.hasImage('mapbox-marker-green')) {
            map.current.addImage('mapbox-marker-green', greenMarkerImage);
            console.log('Loaded green marker icon');
          }
          checkAndAddLayer();
        };
        greenMarkerImage.onerror = (err) => {
          console.error('Error loading green marker:', err);
          checkAndAddLayer();
        };
        greenMarkerImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(greenMarkerSvg);
      } else {
        console.log('Green marker already loaded');
        checkAndAddLayer();
      }
    };

    console.log('updateLegStartWaypointsClusters: Processing', features.length, 'features');
    
    // Update or create the clustering source
    const source = map.current.getSource(legStartWaypointsSourceId) as mapboxgl.GeoJSONSource;
    if (source) {
      console.log('updateLegStartWaypointsClusters: Updating existing source');
      console.log('Preserving selected state for leg:', currentlySelectedLegId);
      source.setData(geojson);
      
      // After updating data, ensure selected marker is still highlighted
      // Use requestAnimationFrame to ensure the data update is complete
      if (currentlySelectedLegId) {
        requestAnimationFrame(() => {
          // Verify the selected state is preserved, if not re-apply it
          const currentData = (source as any)._data as any;
          if (currentData && currentData.features) {
            const selectedFeature = currentData.features.find((f: any) => f.properties?.legId === currentlySelectedLegId);
            if (selectedFeature) {
              if (!selectedFeature.properties.selected) {
                console.log('Re-applying selected state after source update');
                updateMarkerColor(currentlySelectedLegId, true);
              } else {
                console.log('Selected state preserved correctly');
              }
            } else {
              console.log('Selected leg not found in updated data, may have been filtered out');
            }
          }
        });
      }
      // Ensure icons and layer exist even when updating existing source
      ensureIconsAndLayer();
    } else {
      console.log('updateLegStartWaypointsClusters: Creating new source');
      map.current.addSource(legStartWaypointsSourceId, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Add cluster circles layer
      map.current.addLayer({
        id: 'leg-clusters',
        type: 'circle',
        source: legStartWaypointsSourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#6b7280',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            30,
            40,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });

      // Add cluster count labels
      map.current.addLayer({
        id: 'leg-cluster-count',
        type: 'symbol',
        source: legStartWaypointsSourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#fff',
        },
      });

      // Load icons and add marker layer
      // Use setTimeout to ensure source is fully initialized
      setTimeout(() => {
        ensureIconsAndLayer();
      }, 100);
    }
    
    // Also ensure layer exists after a short delay (in case icons load asynchronously)
    setTimeout(() => {
      if (map.current && 
          map.current.getSource(legStartWaypointsSourceId) &&
          map.current.hasImage('mapbox-marker') && 
          map.current.hasImage('mapbox-marker-green') &&
          !map.current.getLayer('leg-unclustered-point')) {
        console.log('Delayed: Adding marker layer');
        addMarkerLayer();
      }
    }, 500);

    // Set up event handlers (only once, regardless of source creation)
    if (!legMarkerHandlersSetupRef.current) {
      console.log('Setting up leg marker click handlers');
      
      // Handle cluster clicks - zoom in
      map.current.on('click', 'leg-clusters', (e) => {
        const features = map.current!.queryRenderedFeatures(e.point, {
          layers: ['leg-clusters'],
        });
        if (features.length > 0) {
          const clusterId = features[0].properties?.cluster_id;
          const source = map.current!.getSource(legStartWaypointsSourceId) as mapboxgl.GeoJSONSource;
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.current!.easeTo({
              center: (e.lngLat as any),
              zoom: zoom as number,
            });
          });
        }
      });

      // Change cursor on hover for clusters
      map.current.on('mouseenter', 'leg-clusters', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      map.current.on('mouseleave', 'leg-clusters', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });

      // Note: Leg marker click handlers are set up in addMarkerLayer() 
      // after the layer is created to ensure the layer exists
    }
  };

  // Update legs on map - update clustering
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

    // Update the ref with new legs
    currentLegsRef.current = newLegs;
    
    // Update clustering
    updateLegStartWaypointsClusters(newLegs);
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
      
      // Reload legs (viewport change check happens inside loadPublicJourneys via hasViewportChanged)
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
      // Load legs on initial load
      if (map.current) {
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
    setDateRange({ start: null, end: null });
  };

  // Navigation functions for leg card
  const navigateToLeg = async (legId: string) => {
    if (!map.current) return;
    
    // Find the leg in journeyLegs or publicLegs
    const leg = journeyLegs.find(l => l.id === legId) || publicLegs.find(l => l.id === legId);
    if (!leg) {
      console.error('Leg not found for navigation:', legId);
      return;
    }

    // Call handleLegMarkerClick to select the leg
    await handleLegMarkerClick(legId, leg.journeyId);
  };

  const handlePrevLeg = async () => {
    if (!selectedLegDetails) return;
    
    const currentIndex = journeyLegs.findIndex(l => l.id === selectedLegDetails.id);
    if (currentIndex > 0) {
      const prevLeg = journeyLegs[currentIndex - 1];
      await navigateToLeg(prevLeg.id);
    }
  };

  const handleNextLeg = async () => {
    if (!selectedLegDetails) return;
    
    const currentIndex = journeyLegs.findIndex(l => l.id === selectedLegDetails.id);
    if (currentIndex >= 0 && currentIndex < journeyLegs.length - 1) {
      const nextLeg = journeyLegs[currentIndex + 1];
      await navigateToLeg(nextLeg.id);
    }
  };

  const getHasPrev = (): boolean => {
    if (!selectedLegDetails || journeyLegs.length === 0) return false;
    const currentIndex = journeyLegs.findIndex(l => l.id === selectedLegDetails.id);
    return currentIndex > 0;
  };

  const getHasNext = (): boolean => {
    if (!selectedLegDetails || journeyLegs.length === 0) return false;
    const currentIndex = journeyLegs.findIndex(l => l.id === selectedLegDetails.id);
    return currentIndex >= 0 && currentIndex < journeyLegs.length - 1;
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-lg">Loading map...</div>
        </div>
      )}
      
      {/* Leg Details Card - Debug */}
      {/* Test div to verify conditional rendering */}
      {selectedLegDetails && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-auto">
          <LegDetailsCard
            startWaypoint={selectedLegDetails.waypoints?.length > 0 
              ? (selectedLegDetails.waypoints.find(wp => wp.index === 0) || selectedLegDetails.waypoints[0])
              : null}
            endWaypoint={(() => {
              if (!selectedLegDetails.waypoints || selectedLegDetails.waypoints.length === 0) {
                return null;
              }
              const sorted = [...selectedLegDetails.waypoints].sort((a, b) => b.index - a.index);
              return sorted[0] && sorted[0].index > 0 ? sorted[0] : null;
            })()}
            startDate={selectedLegDetails.start_date}
            endDate={selectedLegDetails.end_date}
            boatSpeed={selectedLegDetails.boat_speed || null}
            boatImageUrl={selectedLegDetails.boat_image_url || null}
            legName={selectedLegDetails.name}
            journeyName={selectedLegDetails.journeyName}
            onClose={() => {
              setSelectedLegDetails(null);
              setJourneyLegs([]);
              if (selectedLegIdRef.current) {
                resetLegStyling(selectedLegIdRef.current);
                updateMarkerColor(selectedLegIdRef.current, false);
                selectedLegIdRef.current = null;
              }
            }}
            onPrev={handlePrevLeg}
            onNext={handleNextLeg}
            hasPrev={getHasPrev()}
            hasNext={getHasNext()}
          />
        </div>
      )}
      
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
