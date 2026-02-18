'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/app/contexts/ThemeContext';
import { splitLineAtAntimeridian } from '@/app/lib/postgis-helpers';

type Waypoint = {
  index: number;
  geocode: {
    type: string;
    coordinates: [number, number];
  };
  name?: string;
};

type LegWaypoints = {
  waypoints: Waypoint[];
  legId: string;
  isComplete: boolean;
};

type EditJourneyMapProps = {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onStartNewLeg?: (lng: number, lat: number, name: string) => void;
  onAddWaypoint?: (lng: number, lat: number, name: string) => void;
  onEndLeg?: (lng: number, lat: number, name: string) => void;
  hasActiveLegWithoutEnd?: boolean; // True if there's a leg with start but no end point
  activeLegWaypoints?: Waypoint[]; // Waypoints for the active leg (for determining color)
  allLegsWaypoints?: LegWaypoints[]; // All legs' waypoints for drawing all route lines
  onDeleteLeg?: (legId: string) => void; // Callback to delete markers for a leg
  selectedLegId?: string | null; // ID of the currently selected leg
  onLegClick?: (legId: string) => void; // Callback when a leg route or marker is clicked
  className?: string;
  legMarkerLabels?: Map<string, string>; // Optional custom labels for leg start markers (legId -> label text)
  disableStartNewLeg?: boolean; // Disable the "Start new leg" functionality
};

type LocationInfo = {
  lng: number;
  lat: number;
  name: string;
};

export function EditJourneyMap({
  initialCenter = [-74.5, 40], // Default to New York area
  initialZoom = 2,
  onMapLoad,
  onStartNewLeg,
  onAddWaypoint,
  onEndLeg,
  hasActiveLegWithoutEnd = false,
  activeLegWaypoints = [],
  allLegsWaypoints = [],
  selectedLegId = null,
  onLegClick,
  className = '',
  legMarkerLabels,
  disableStartNewLeg = false,
}: EditJourneyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const legStartMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map()); // Map legId to start marker
  const legEndMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map()); // Map legId to end marker
  const legWaypointMarkersRef = useRef<Map<string, mapboxgl.Marker[]>>(new Map()); // Map legId to array of waypoint markers
  const startMarkerListenersRef = useRef<Map<string, (e: Event) => void>>(new Map()); // Store start marker click listeners
  const endMarkerListenersRef = useRef<Map<string, (e: Event) => void>>(new Map()); // Store end marker click listeners
  const waypointMarkerListenersRef = useRef<Map<string, Map<number, (e: Event) => void>>>(new Map()); // Store waypoint marker listeners
  const routeSourcesRef = useRef<Map<string, string>>(new Map()); // Map legId to sourceId
  const routeLayerListenersRef = useRef<Set<string>>(new Set()); // Track which layers have listeners
  const routeLineClickedRef = useRef(false); // Flag to track if route line was clicked
  const mapInitializedRef = useRef(false);
  const currentLegIdRef = useRef<string | null>(null); // Track the current leg being created
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const theme = useTheme();
  const mapStyle = theme.resolvedTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';


  useEffect(() => {
    // Only initialize map once
    if (!mapContainer.current || mapInitializedRef.current) return;
    mapInitializedRef.current = true;

    // Initialize map
    // Note: You'll need to set MAPBOX_ACCESS_TOKEN in your .env.local file
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!accessToken) {
      logger.error('MAPBOX_ACCESS_TOKEN is not set. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file');
      return;
    }  
  
    mapboxgl.accessToken = accessToken;
  
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle, // Less colorful, muted style
      center: initialCenter,
      zoom: initialZoom,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Function to add gray waypoint marker (temporary, shown when dialog is open)
    const addWaypointMarker = (lng: number, lat: number) => {
      if (!map.current) return;

      // Remove existing temporary marker if any
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      // Create a gray marker element
      const el = document.createElement('div');
      el.className = 'waypoint-marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#6b7280'; // gray-500
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'grab';

      // Create and add marker to map (temporary marker, not draggable yet)
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        draggable: false, // Temporary marker is not draggable
      })
        .setLngLat([lng, lat]);
      
      if (map.current) {
        marker.addTo(map.current);
        markerRef.current = marker;
      }
    };


    // Handle map load
    map.current.on('load', () => {
      setMapLoaded(true);
      // Set cursor to default pointer
      if (map.current && map.current.getCanvasContainer()) {
        map.current.getCanvasContainer().style.cursor = 'default';
      }
      
      // Route lines will be added dynamically for each leg
      
      // Call onMapLoad callback if provided (using a ref to avoid dependency issues)
      if (onMapLoad && map.current) {
        onMapLoad(map.current);
      }
    });

    // Handle map click
    const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
      if (!map.current) return;

      // If start new leg is disabled, don't handle map clicks
      if (disableStartNewLeg) {
        return;
      }

      // Check if a route line was clicked (using flag set by route line click handler)
      if (routeLineClickedRef.current) {
        return;
      }

      // Also check if the click was on a route line layer by querying features
      const clickedFeatures = map.current.queryRenderedFeatures(e.point);
      const clickedRouteLine = clickedFeatures.some(feature => {
        const layerId = feature.layer?.id || '';
        return layerId.startsWith('route-line-layer-');
      });

      // If a route line was clicked, don't open the dialog
      if (clickedRouteLine) {
        return;
      }

      const { lng, lat } = e.lngLat;
      setIsLoadingLocation(true);

      // Add gray marker at clicked location
      addWaypointMarker(lng, lat);

      // Reverse geocode to get location name
      try {
        const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (accessToken) {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${accessToken}`
          );
          const data = await response.json();
          
          // Extract city/town and country from the response
          let locationName = 'Unknown location';
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const context = feature.context || [];
            
            // Find city/town and country from context
            let city = '';
            let country = '';
            
            for (const item of context) {
              if (item.id && item.id.startsWith('place')) {
                city = item.text || '';
              }
              if (item.id && item.id.startsWith('country')) {
                country = item.text || '';
              }
            }
            
            // If no city found in context, try the main text
            if (!city && feature.text) {
              city = feature.text;
            }
            
            // Build location name
            if (city && country) {
              locationName = `${city}, ${country}`;
            } else if (city) {
              locationName = city;
            } else if (country) {
              locationName = country;
            } else {
              locationName = feature.place_name || feature.text || 'Unknown location';
            }
          }

          setLocationInfo({ lng, lat, name: locationName });
        } else {
          setLocationInfo({ lng, lat, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        }
      } catch (error) {
        logger.error('Error fetching location name:', error);
        setLocationInfo({ lng, lat, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      } finally {
        setIsLoadingLocation(false);
      }
    };

    map.current.on('click', handleMapClick);

    // Cleanup on unmount only
    return () => {
      if (map.current) {
        map.current.off('click', handleMapClick);
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        // Clean up leg start markers and their listeners
        legStartMarkersRef.current.forEach((marker, legId) => {
          const el = marker.getElement();
          if (el) {
            const listener = startMarkerListenersRef.current.get(legId);
            if (listener) {
              el.removeEventListener('click', listener);
            }
          }
          marker.remove();
        });
        legStartMarkersRef.current.clear();
        startMarkerListenersRef.current.clear();
        // Clean up leg end markers and their listeners
        legEndMarkersRef.current.forEach((marker, legId) => {
          const el = marker.getElement();
          if (el) {
            const listener = endMarkerListenersRef.current.get(legId);
            if (listener) {
              el.removeEventListener('click', listener);
            }
          }
          marker.remove();
        });
        legEndMarkersRef.current.clear();
        endMarkerListenersRef.current.clear();
        // Clean up waypoint markers and their listeners
        legWaypointMarkersRef.current.forEach((markers, legId) => {
          const legListeners = waypointMarkerListenersRef.current.get(legId);
          markers.forEach((marker, index) => {
            const el = marker.getElement();
            if (el && legListeners) {
              const listener = legListeners.get(index);
              if (listener) {
                el.removeEventListener('click', listener);
              }
            }
            marker.remove();
          });
        });
        legWaypointMarkersRef.current.clear();
        waypointMarkerListenersRef.current.clear();
        // Remove all route line layers and sources
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
        routeLayerListenersRef.current.clear();
        // Remove the map
        map.current.remove();
        map.current = null;
      }
      mapInitializedRef.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  const handleCloseModal = () => {
    // Remove marker when dialog is closed
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    setLocationInfo(null);
  };

  const addPermanentWaypointMarker = (lng: number, lat: number, legId: string) => {
    if (!map.current) return;

    // Determine color and z-index based on selection
    const isSelected = selectedLegId === legId;
    const backgroundColor = isSelected ? '#22c55e' : '#6b7280'; // green-500 if selected, gray-500 otherwise
    const zIndex = isSelected ? '5' : '1'; // Higher z-index when selected, but always below dialogs

    // Create a waypoint marker (permanent, for intermediate waypoints)
    const el = document.createElement('div');
    el.className = 'waypoint-marker-permanent';
    el.style.width = '16px';
    el.style.height = '16px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = backgroundColor;
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    el.style.cursor = 'pointer';
    el.style.zIndex = zIndex;

    // Create and add marker to map
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
    })
      .setLngLat([lng, lat]);

    if (map.current) {
      marker.addTo(map.current);
      // Store marker by legId
      if (!legWaypointMarkersRef.current.has(legId)) {
        legWaypointMarkersRef.current.set(legId, []);
        waypointMarkerListenersRef.current.set(legId, new Map());
      }
      const markers = legWaypointMarkersRef.current.get(legId)!;
      const markerIndex = markers.length;
      markers.push(marker);

      // Add and store click handler to marker (for cleanup)
      if (onLegClick) {
        const handleClick = (e: Event) => {
          e.stopPropagation();
          onLegClick(legId);
        };
        el.addEventListener('click', handleClick);
        waypointMarkerListenersRef.current.get(legId)!.set(markerIndex, handleClick);
      }
    }
  };

  const addEndMarker = (lng: number, lat: number, legId: string) => {
    if (!map.current) return;

    // Remove existing end marker for this leg if any
    const existingEndMarker = legEndMarkersRef.current.get(legId);
    if (existingEndMarker) {
      const el = existingEndMarker.getElement();
      if (el) {
        const listener = endMarkerListenersRef.current.get(legId);
        if (listener) {
          el.removeEventListener('click', listener);
        }
      }
      existingEndMarker.remove();
      legEndMarkersRef.current.delete(legId);
      endMarkerListenersRef.current.delete(legId);
    }

    // Determine color and z-index based on selection
    const isSelected = selectedLegId === legId;
    const backgroundColor = isSelected ? '#22c55e' : '#6b7280'; // green-500 if selected, gray-500 otherwise
    // End markers always on top, but even higher when selected
    const zIndex = isSelected ? '10' : '5';

    const el = document.createElement('div');
    el.className = 'leg-end-marker';
    el.style.width = '24px';
    el.style.height = '24px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = backgroundColor;
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    el.style.cursor = 'pointer';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.zIndex = zIndex;

    // Add "E" text
    const text = document.createElement('span');
    text.textContent = 'E';
    text.style.color = 'white';
    text.style.fontSize = '12px';
    text.style.fontWeight = 'bold';
    text.style.lineHeight = '1';
    el.appendChild(text);

    // Create and add permanent marker to map
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
    })
      .setLngLat([lng, lat]);

    if (map.current) {
      marker.addTo(map.current);
      legEndMarkersRef.current.set(legId, marker);

      // Add and store click handler to marker (for cleanup)
      if (onLegClick) {
        const handleClick = (e: Event) => {
          e.stopPropagation();
          onLegClick(legId);
        };
        el.addEventListener('click', handleClick);
        endMarkerListenersRef.current.set(legId, handleClick);
      }
    }
  };

  // Update route lines for all legs when waypoints change or map loads
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // Track which leg sources we've created
    const existingSourceIds = new Set<string>();
    
    // Process all legs and create/update route lines
    allLegsWaypoints.forEach((legData) => {
      const { waypoints, legId, isComplete } = legData;
      
      if (waypoints.length < 2) return; // Need at least 2 points for a line
      
      // Build coordinates array from waypoints
      const coordinates: [number, number][] = [];
      waypoints.forEach((waypoint: Waypoint) => {
        if (waypoint && waypoint.geocode && waypoint.geocode.coordinates) {
          // Ensure coordinates are in [lng, lat] format and use exact values
          const [lng, lat] = waypoint.geocode.coordinates;
          coordinates.push([lng, lat]);
        }
      });

      if (coordinates.length < 2) return;

      const sourceId = `route-line-${legId}`;
      const layerId = `route-line-layer-${legId}`;
      existingSourceIds.add(sourceId);

      // Check if source already exists
      let source = map.current?.getSource(sourceId) as mapboxgl.GeoJSONSource;
      
      if (!source) {
        // Create new source for this leg
        // Use splitLineAtAntimeridian to handle routes crossing the 180° longitude
        const geometry = splitLineAtAntimeridian(coordinates);
        map.current?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry,
          },
        });

        // Create layer for this leg's route line
        const isSelected = selectedLegId === legId;
        map.current?.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isSelected ? '#22c55e' : '#6b7280', // green if selected, gray otherwise
            'line-width': isSelected ? 4 : 3, // Slightly thicker when selected
            'line-opacity': 0.8,
          },
        });
        
        // Make route line clickable (only add listeners once per layer)
        if (onLegClick && map.current && !routeLayerListenersRef.current.has(layerId)) {
          const handleClick = (e: any) => {
            // Set flag to prevent map click handler from opening dialog
            routeLineClickedRef.current = true;
            // Reset flag after a short delay
            setTimeout(() => {
              routeLineClickedRef.current = false;
            }, 100);
            onLegClick(legId);
          };
          
          const handleMouseEnter = () => {
            if (map.current) {
              map.current.getCanvas().style.cursor = 'pointer';
            }
          };
          
          const handleMouseLeave = () => {
            if (map.current) {
              map.current.getCanvas().style.cursor = 'default';
            }
          };
          
          map.current.on('click', layerId, handleClick);
          map.current.on('mouseenter', layerId, handleMouseEnter);
          map.current.on('mouseleave', layerId, handleMouseLeave);
          
          routeLayerListenersRef.current.add(layerId);
        }

        routeSourcesRef.current.set(legId, sourceId);
      } else {
        // Update existing source
        // Use splitLineAtAntimeridian to handle routes crossing the 180° longitude
        const geometry = splitLineAtAntimeridian(coordinates);
        source.setData({
          type: 'Feature',
          properties: {},
          geometry,
        });

        // Update line color and width based on selection
        const isSelected = selectedLegId === legId;
        const layer = map.current?.getLayer(layerId);
        if (layer) {
          map.current?.setPaintProperty(layerId, 'line-color', isSelected ? '#22c55e' : '#6b7280');
          map.current?.setPaintProperty(layerId, 'line-width', isSelected ? 4 : 3);
        }
      }
    });

    // Remove sources and layers for legs that no longer exist
    routeSourcesRef.current.forEach((sourceId: string, legId: string) => {
      if (!existingSourceIds.has(sourceId)) {
        const layerId = `route-line-layer-${legId}`;
        // Remove layer (event listeners are automatically cleaned up when layer is removed)
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
        routeSourcesRef.current.delete(legId);
        routeLayerListenersRef.current.delete(layerId);
      }
    });
  }, [allLegsWaypoints, mapLoaded, selectedLegId, onLegClick]);

  // Function to remove all markers for a specific leg
  const removeLegMarkers = (legId: string) => {
    // Remove start marker and its listener
    const startMarker = legStartMarkersRef.current.get(legId);
    if (startMarker) {
      const el = startMarker.getElement();
      if (el) {
        const listener = startMarkerListenersRef.current.get(legId);
        if (listener) {
          el.removeEventListener('click', listener);
        }
      }
      startMarker.remove();
      legStartMarkersRef.current.delete(legId);
      startMarkerListenersRef.current.delete(legId);
    }

    // Remove end marker and its listener
    const endMarker = legEndMarkersRef.current.get(legId);
    if (endMarker) {
      const el = endMarker.getElement();
      if (el) {
        const listener = endMarkerListenersRef.current.get(legId);
        if (listener) {
          el.removeEventListener('click', listener);
        }
      }
      endMarker.remove();
      legEndMarkersRef.current.delete(legId);
      endMarkerListenersRef.current.delete(legId);
    }

    // Remove waypoint markers and their listeners
    const waypointMarkers = legWaypointMarkersRef.current.get(legId);
    if (waypointMarkers) {
      const legListeners = waypointMarkerListenersRef.current.get(legId);
      waypointMarkers.forEach((marker, index) => {
        const el = marker.getElement();
        if (el && legListeners) {
          const listener = legListeners.get(index);
          if (listener) {
            el.removeEventListener('click', listener);
          }
        }
        marker.remove();
      });
      legWaypointMarkersRef.current.delete(legId);
      waypointMarkerListenersRef.current.delete(legId);
    }
  };

  // Marker deletion is handled by syncing with allLegsWaypoints
  // When a leg is removed from allLegsWaypoints, its markers are automatically removed

  // Sync markers with allLegsWaypoints - create/update/remove markers based on leg data
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const existingLegIds = new Set<string>();
    
    // Process all legs and ensure markers exist
    allLegsWaypoints.forEach((legData) => {
      const { waypoints, legId, isComplete } = legData;
      existingLegIds.add(legId);
      
      if (waypoints.length === 0) return;
      
        // Ensure start marker exists
        const startWaypoint = waypoints[0];
        if (startWaypoint && startWaypoint.geocode && startWaypoint.geocode.coordinates) {
          const [lng, lat] = startWaypoint.geocode.coordinates;
          const existingStartMarker = legStartMarkersRef.current.get(legId);
          
          // Determine color and z-index based on selection
          const isSelected = selectedLegId === legId;
          const backgroundColor = isSelected ? '#22c55e' : '#6b7280'; // green-500 if selected, gray-500 otherwise
          // Start markers always on top, but even higher when selected, but always below dialogs
          const zIndex = isSelected ? '10' : '5';
          
          if (!existingStartMarker) {
            // Create start marker with custom label or "S"
            const customLabel = legMarkerLabels?.get(legId);
            const markerSize = customLabel ? '32px' : '24px'; // Larger marker for longer text
            const el = document.createElement('div');
            el.className = 'leg-start-marker';
            el.style.width = markerSize;
            el.style.height = markerSize;
            el.style.borderRadius = '50%';
            el.style.backgroundColor = backgroundColor;
            el.style.border = '3px solid white';
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
            el.style.cursor = 'pointer';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.zIndex = zIndex;
            
            // Add label text (custom label or default "S")
            const text = document.createElement('span');
            text.textContent = customLabel || 'S';
            text.style.color = 'white';
            text.style.fontSize = customLabel ? '9px' : '12px'; // Smaller font for longer text
            text.style.fontWeight = 'bold';
            text.style.lineHeight = '1';
            text.style.textAlign = 'center';
            el.appendChild(text);
            
            const marker = new mapboxgl.Marker({
              element: el,
              anchor: 'center',
            }).setLngLat([lng, lat]);

            if (map.current) {
              marker.addTo(map.current);
              legStartMarkersRef.current.set(legId, marker);

              // Add and store click handler to marker (for cleanup)
              if (onLegClick) {
                const handleClick = (e: Event) => {
                  e.stopPropagation();
                  onLegClick(legId);
                };
                el.addEventListener('click', handleClick);
                startMarkerListenersRef.current.set(legId, handleClick);
              }
            }
          } else {
            // Update existing marker color, z-index, and label
            const markerEl = existingStartMarker.getElement();
            if (markerEl) {
              markerEl.style.backgroundColor = backgroundColor;
              markerEl.style.zIndex = zIndex;
              // Update label text if custom labels are provided
              const textElement = markerEl.querySelector('span');
              if (textElement) {
                const customLabel = legMarkerLabels?.get(legId);
                if (customLabel) {
                  textElement.textContent = customLabel;
                  textElement.style.fontSize = '9px'; // Smaller font for longer text
                  // Update marker size if needed for longer text
                  markerEl.style.width = '32px';
                  markerEl.style.height = '32px';
                } else {
                  textElement.textContent = 'S';
                  textElement.style.fontSize = '12px';
                  // Reset to default size
                  markerEl.style.width = '24px';
                  markerEl.style.height = '24px';
                }
              }
            }
          }
        }
      
      // Ensure end marker exists if leg is complete
      if (isComplete && waypoints.length > 1 && map.current) {
        const endWaypoint = waypoints[waypoints.length - 1];
        if (endWaypoint && endWaypoint.geocode && endWaypoint.geocode.coordinates) {
          const [lng, lat] = endWaypoint.geocode.coordinates;
          const existingEndMarker = legEndMarkersRef.current.get(legId);
          
          if (!existingEndMarker) {
            addEndMarker(lng, lat, legId);
          } else {
            // Update existing marker color and z-index based on selection
            const isSelected = selectedLegId === legId;
            const backgroundColor = isSelected ? '#22c55e' : '#6b7280';
            const zIndex = isSelected ? '10' : '5';
            const markerEl = existingEndMarker.getElement();
            if (markerEl) {
              markerEl.style.backgroundColor = backgroundColor;
              markerEl.style.zIndex = zIndex;
            }
          }
        }
      }
      
      // Ensure waypoint markers exist for intermediate waypoints
      if (waypoints.length > 2) {
        // Intermediate waypoints (excluding first and last)
        const intermediateWaypoints = waypoints.slice(1, -1);
        const existingWaypoints = legWaypointMarkersRef.current.get(legId) || [];
        
        intermediateWaypoints.forEach((waypoint, index) => {
          if (waypoint && waypoint.geocode && waypoint.geocode.coordinates) {
            const [lng, lat] = waypoint.geocode.coordinates;
            // Check if marker already exists at this position (simple check)
            const existingMarker = existingWaypoints.find(marker => {
              const pos = marker.getLngLat();
              return Math.abs(pos.lng - lng) < 0.0001 && Math.abs(pos.lat - lat) < 0.0001;
            });
            
            if (existingMarker) {
              // Update existing marker color and z-index based on selection
              const isSelected = selectedLegId === legId;
              const backgroundColor = isSelected ? '#22c55e' : '#6b7280';
              const zIndex = isSelected ? '5' : '1';
              const markerEl = existingMarker.getElement();
              if (markerEl) {
                markerEl.style.backgroundColor = backgroundColor;
                markerEl.style.zIndex = zIndex;
              }
            } else if (index >= existingWaypoints.length) {
              addPermanentWaypointMarker(lng, lat, legId);
            }
          }
        });
      }
    });

    // Remove markers for legs that no longer exist
    legStartMarkersRef.current.forEach((marker, legId) => {
      if (!existingLegIds.has(legId)) {
        removeLegMarkers(legId);
      }
    });
    legEndMarkersRef.current.forEach((marker, legId) => {
      if (!existingLegIds.has(legId)) {
        removeLegMarkers(legId);
      }
    });
    legWaypointMarkersRef.current.forEach((markers, legId) => {
      if (!existingLegIds.has(legId)) {
        removeLegMarkers(legId);
      }
    });
  }, [allLegsWaypoints, mapLoaded, selectedLegId, onLegClick, legMarkerLabels]);

  const handleStartNewLeg = (lng: number, lat: number, legId: string) => {
    if (!map.current) {
      logger.error('Map not available in handleStartNewLeg');
      return;
    }

    // If we have a temporary marker, replace it with a new permanent green one
    // This avoids position shift issues when resizing the DOM element
    if (markerRef.current) {
      // Get the marker's current position BEFORE removing it
      const currentLngLat = markerRef.current.getLngLat();
      
      // Remove the temporary marker completely
      markerRef.current.remove();
      markerRef.current = null;
      
      // Remove existing start marker for this leg if any
      const existingStartMarker = legStartMarkersRef.current.get(legId);
      if (existingStartMarker) {
        existingStartMarker.remove();
      }
      
      // Determine color and z-index based on selection
      const isSelected = selectedLegId === legId;
      const backgroundColor = isSelected ? '#22c55e' : '#6b7280'; // green-500 if selected, gray-500 otherwise
      const zIndex = isSelected ? '10' : '5'; // Start markers always on top, but even higher when selected, but always below dialogs
      
      // Create a new marker element with the correct size from the start
      const customLabel = legMarkerLabels?.get(legId);
      const markerSize = customLabel ? '32px' : '24px'; // Larger marker for longer text
      const el = document.createElement('div');
      el.className = 'leg-start-marker';
      el.style.width = markerSize;
      el.style.height = markerSize;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = backgroundColor;
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.zIndex = zIndex;
      
      // Add label text (custom label or default "S")
      const text = document.createElement('span');
      text.textContent = customLabel || 'S';
      text.style.color = 'white';
      text.style.fontSize = customLabel ? '9px' : '12px'; // Smaller font for longer text
      text.style.fontWeight = 'bold';
      text.style.lineHeight = '1';
      text.style.textAlign = 'center';
      el.appendChild(text);

      // Create new marker at the EXACT same position as the temporary one
      const newMarker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([currentLngLat.lng, currentLngLat.lat]);

      if (map.current) {
        newMarker.addTo(map.current);
        legStartMarkersRef.current.set(legId, newMarker);

        // Add and store click handler to marker (for cleanup)
        if (onLegClick) {
          const handleClick = (e: Event) => {
            e.stopPropagation();
            onLegClick(legId);
          };
          el.addEventListener('click', handleClick);
          startMarkerListenersRef.current.set(legId, handleClick);
        }

        logger.debug('Replaced temporary marker with start marker at', currentLngLat);
      }
    } else {
      logger.warn('No temporary marker found, creating new gray marker');
      // If no temporary marker exists, create a new marker with custom label or "S"
      // Determine color and z-index based on selection
      const isSelected = selectedLegId === legId;
      const backgroundColor = isSelected ? '#22c55e' : '#6b7280'; // green-500 if selected, gray-500 otherwise
      const zIndex = isSelected ? '10' : '5'; // Start markers always on top, but even higher when selected, but always below dialogs
      
      const customLabel = legMarkerLabels?.get(legId);
      const markerSize = customLabel ? '32px' : '24px'; // Larger marker for longer text
      const el = document.createElement('div');
      el.className = 'leg-start-marker';
      el.style.width = markerSize;
      el.style.height = markerSize;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = backgroundColor;
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.zIndex = zIndex;
      
      // Add label text (custom label or default "S")
      const text = document.createElement('span');
      text.textContent = customLabel || 'S';
      text.style.color = 'white';
      text.style.fontSize = customLabel ? '9px' : '12px'; // Smaller font for longer text
      text.style.fontWeight = 'bold';
      text.style.lineHeight = '1';
      text.style.textAlign = 'center';
      el.appendChild(text);

      // Create and add permanent marker to map with exact coordinates
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([lng, lat]);

      if (map.current) {
        marker.addTo(map.current);
        legStartMarkersRef.current.set(legId, marker);

        // Add and store click handler to marker (for cleanup)
        if (onLegClick) {
          const handleClick = (e: Event) => {
            e.stopPropagation();
            onLegClick(legId);
          };
          el.addEventListener('click', handleClick);
          startMarkerListenersRef.current.set(legId, handleClick);
        }

        logger.debug('Created new gray marker at', lng, lat);
      }
    }
  };

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full relative ${className}`}
      style={{ minHeight: '400px', cursor: 'default' }}
    >
      {/* Location Modal */}
      {locationInfo && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div
            className="bg-card border border-border rounded-lg shadow-xl max-w-xs w-full mx-4 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-card-foreground">
                  {isLoadingLocation ? 'Loading...' : locationInfo.name}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-4"
                  aria-label="Close"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="mt-4">
                {hasActiveLegWithoutEnd ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (locationInfo) {
                          // Find the active leg (one without an end point) to get its ID
                          const activeLeg = allLegsWaypoints.find(leg => !leg.isComplete);
                          const activeLegId = activeLeg?.legId;
                          
                          if (!activeLegId) {
                            logger.error('No active leg found to add waypoint to');
                            return;
                          }
                          
                          // Convert the temporary gray marker to a permanent waypoint marker
                          if (markerRef.current) {
                            const currentLngLat = markerRef.current.getLngLat();
                            markerRef.current.remove();
                            markerRef.current = null;
                            addPermanentWaypointMarker(currentLngLat.lng, currentLngLat.lat, activeLegId);
                          } else {
                            addPermanentWaypointMarker(locationInfo.lng, locationInfo.lat, activeLegId);
                          }
                          
                          // Call the callback to add waypoint to the leg
                          if (onAddWaypoint) {
                            onAddWaypoint(locationInfo.lng, locationInfo.lat, locationInfo.name);
                          }
                          
                          // Close the dialog
                          setLocationInfo(null);
                        }
                      }}
                      className="flex-1 px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      Add waypoint
                    </button>
                    <button
                      onClick={() => {
                        if (locationInfo) {
                          // Find the active leg (one without an end point) to get its ID
                          const activeLeg = allLegsWaypoints.find(leg => !leg.isComplete);
                          const activeLegId = activeLeg?.legId;
                          
                          if (!activeLegId) {
                            logger.error('No active leg found to end');
                            return;
                          }
                          
                          // Get the exact marker coordinates
                          let finalLng = locationInfo.lng;
                          let finalLat = locationInfo.lat;
                          
                          if (markerRef.current) {
                            const markerLngLat = markerRef.current.getLngLat();
                            finalLng = markerLngLat.lng;
                            finalLat = markerLngLat.lat;
                            markerRef.current.remove();
                            markerRef.current = null;
                          }
                          
                          // Convert the temporary gray marker to a permanent red end marker
                          addEndMarker(finalLng, finalLat, activeLegId);
                          
                          // Call the callback to end the leg with exact coordinates
                          if (onEndLeg) {
                            onEndLeg(finalLng, finalLat, locationInfo.name);
                          }
                          
                          // Close the dialog and reset state
                          setLocationInfo(null);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      End leg
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (locationInfo && markerRef.current) {
                        // Get the EXACT marker coordinates - this is the source of truth
                        // The marker position is what we see on the map, so use that
                        const markerLngLat = markerRef.current.getLngLat();
                        const finalLng = markerLngLat.lng;
                        const finalLat = markerLngLat.lat;
                        
                        // Call the callback first to create the leg
                        // The marker will be created by the sync effect when allLegsWaypoints updates
                        if (onStartNewLeg) {
                          onStartNewLeg(finalLng, finalLat, locationInfo.name);
                        }
                        
                        // Close the dialog without removing the marker
                        // The sync effect will convert it to a permanent marker
                        setLocationInfo(null);
                      }
                    }}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Start new leg
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
