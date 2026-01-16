'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LegDetailsPanel } from './LegDetailsPanel';

type Leg = {
  leg_id: string;
  leg_name: string;
  leg_description: string | null;
  journey_id: string;
  journey_name: string;
  start_date: string | null;
  end_date: string | null;
  crew_needed: number | null;
  risk_level: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null;
  skills: string[];
  boat_id: string;
  boat_name: string;
  boat_type: string | null;
  boat_image_url: string | null;
  skipper_name: string | null;
  start_waypoint: {
    lng: number;
    lat: number;
    name: string | null;
  } | null;
  end_waypoint: {
    lng: number;
    lat: number;
    name: string | null;
  } | null;
};

type CrewBrowseMapProps = {
  className?: string;
  style?: React.CSSProperties;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
};

export function CrewBrowseMap({
  className = '',
  style,
  initialCenter = [0, 20], // Default to center of world
  initialZoom = 2,
}: CrewBrowseMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapInitializedRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(initialZoom);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLeg, setSelectedLeg] = useState<Leg | null>(null);
  const viewportDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);
  const mapLoadedRef = useRef(false);
  const lastLoadedBoundsRef = useRef<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const sourceAddedRef = useRef(false);

  // Helper function to check if viewport has changed significantly
  const hasViewportChangedSignificantly = (
    newBounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
    lastBounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null
  ): boolean => {
    if (!lastBounds) return true; // First load, always load

    // Calculate area of both bounds
    const oldArea = (lastBounds.maxLng - lastBounds.minLng) * (lastBounds.maxLat - lastBounds.minLat);
    const newArea = (newBounds.maxLng - newBounds.minLng) * (newBounds.maxLat - newBounds.minLat);
    
    // Check if area changed by more than 20%
    const areaChange = Math.abs(newArea - oldArea) / oldArea;
    if (areaChange > 0.2) return true;

    // Check if new bounds extend significantly beyond old bounds (more than 10% on any side)
    const lngExtent = lastBounds.maxLng - lastBounds.minLng;
    const latExtent = lastBounds.maxLat - lastBounds.minLat;
    
    const minLngDiff = lastBounds.minLng - newBounds.minLng;
    const maxLngDiff = newBounds.maxLng - lastBounds.maxLng;
    const minLatDiff = lastBounds.minLat - newBounds.minLat;
    const maxLatDiff = newBounds.maxLat - lastBounds.maxLat;

    if (
      minLngDiff > lngExtent * 0.1 ||
      maxLngDiff > lngExtent * 0.1 ||
      minLatDiff > latExtent * 0.1 ||
      maxLatDiff > latExtent * 0.1
    ) {
      return true;
    }

    return false;
  };

  // Store full leg data in a map for quick lookup
  const legsMapRef = useRef<Map<string, Leg>>(new Map());

  // Update legs map when legs change
  useEffect(() => {
    legsMapRef.current.clear();
    legs.forEach(leg => {
      legsMapRef.current.set(leg.leg_id, leg);
    });
  }, [legs]);

  // Update GeoJSON source when legs change
  useEffect(() => {
    if (!map.current || !mapLoaded || !sourceAddedRef.current) return;

    // Convert legs to GeoJSON format
    const features = legs
      .filter(leg => leg.start_waypoint !== null)
      .map(leg => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [leg.start_waypoint!.lng, leg.start_waypoint!.lat],
        },
        properties: {
          leg_id: leg.leg_id,
        },
      }));

    const geoJsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Update the source data
    const source = map.current.getSource('legs-source') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geoJsonData);
    }
  }, [legs, mapLoaded]);

  useEffect(() => {
    // Only initialize map once
    if (!mapContainer.current || mapInitializedRef.current) return;
    mapInitializedRef.current = true;

    // Initialize map
    // Note: You'll need to set MAPBOX_ACCESS_TOKEN in your .env.local file
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('MAPBOX_ACCESS_TOKEN is not set. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file');
      return;
    }

    mapboxgl.accessToken = accessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: initialZoom,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Handle viewport changes (move, zoom) - load legs when zoom > 3.5
    const handleViewportChange = async () => {
      if (!map.current || !mapLoadedRef.current || isLoadingRef.current) {
        console.log('[CrewBrowseMap] handleViewportChange: map not ready or already loading', {
          hasMap: !!map.current,
          mapLoaded: mapLoadedRef.current,
          isLoading: isLoadingRef.current,
        });
        return;
      }

      // Check if map is loaded by checking if it has bounds
      try {
        map.current.getBounds();
      } catch (e) {
        // Map not ready yet
        console.log('[CrewBrowseMap] handleViewportChange: map bounds not available yet');
        return;
      }

      const currentZoom = map.current.getZoom();
      console.log('[CrewBrowseMap] handleViewportChange:', { zoom: currentZoom });
      setZoomLevel(currentZoom);

      // Clear any existing timer
      if (viewportDebounceTimerRef.current) {
        clearTimeout(viewportDebounceTimerRef.current);
      }
      // Debounce the viewport change
      viewportDebounceTimerRef.current = setTimeout(async () => {
          if (!map.current || isLoadingRef.current) {
            console.log('[CrewBrowseMap] Debounced handler: map not ready or already loading');
            return;
          }
          
          isLoadingRef.current = true;
          setLoading(true);

          try {
            if (!map.current) return;
            
            // Ensure map is fully loaded before getting bounds
            if (!map.current.loaded()) {
              console.log('[CrewBrowseMap] Map not fully loaded yet, skipping bounds request');
              isLoadingRef.current = false;
              setLoading(false);
              return;
            }
            
            // Get bounds with error handling
            let bounds: mapboxgl.LngLatBounds | null = null;
            try {
              bounds = map.current.getBounds();
            } catch (error) {
              console.error('[CrewBrowseMap] Error getting bounds:', error);
              isLoadingRef.current = false;
              setLoading(false);
              return;
            }
            
            if (!bounds) {
              console.log('[CrewBrowseMap] Debounced handler: bounds not available');
              isLoadingRef.current = false;
              setLoading(false);
              return;
            }
            
            // Extract bounds values with error handling
            // Try to get bounds values directly - if bounds is invalid, this will throw
            let minLng: number;
            let minLat: number;
            let maxLng: number;
            let maxLat: number;
            
            try {
              // Attempt to extract bounds values
              // If bounds object is invalid, this will throw an error
              if (!bounds) {
                throw new Error('Bounds is null');
              }
              minLng = bounds.getWest();
              minLat = bounds.getSouth();
              maxLng = bounds.getEast();
              maxLat = bounds.getNorth();
            } catch (error) {
              // If we can't extract bounds values, log error and skip
              console.error('[CrewBrowseMap] Error extracting bounds values:', error);
              console.error('[CrewBrowseMap] Bounds object state:', {
                boundsExists: bounds !== null && bounds !== undefined,
                boundsType: bounds !== null && bounds !== undefined ? typeof bounds : 'null/undefined',
                mapLoaded: map.current?.loaded(),
                mapExists: !!map.current,
              });
              isLoadingRef.current = false;
              setLoading(false);
              return;
            }

            console.log('[CrewBrowseMap] Raw bounds from Mapbox:', {
              minLng: typeof minLng === 'number' ? minLng : 'invalid',
              minLat: typeof minLat === 'number' ? minLat : 'invalid',
              maxLng: typeof maxLng === 'number' ? maxLng : 'invalid',
              maxLat: typeof maxLat === 'number' ? maxLat : 'invalid',
              crossesDateLine: typeof minLng === 'number' && typeof maxLng === 'number' ? minLng > maxLng : false,
            });

            // Check for invalid bounds first
            if (
              typeof minLng !== 'number' || typeof minLat !== 'number' || 
              typeof maxLng !== 'number' || typeof maxLat !== 'number' ||
              isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat) ||
              !isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)
            ) {
              console.error('[CrewBrowseMap] Bounds contain invalid values:', {
                minLng: typeof minLng === 'number' ? minLng : String(minLng),
                minLat: typeof minLat === 'number' ? minLat : String(minLat),
                maxLng: typeof maxLng === 'number' ? maxLng : String(maxLng),
                maxLat: typeof maxLat === 'number' ? maxLat : String(maxLat),
                minLngType: typeof minLng,
                minLatType: typeof minLat,
                maxLngType: typeof maxLng,
                maxLatType: typeof maxLat,
                minLngValid: typeof minLng === 'number' && isFinite(minLng),
                minLatValid: typeof minLat === 'number' && isFinite(minLat),
                maxLngValid: typeof maxLng === 'number' && isFinite(maxLng),
                maxLatValid: typeof maxLat === 'number' && isFinite(maxLat),
              });
              isLoadingRef.current = false;
              setLoading(false);
              return;
            }

            // Handle international date line crossing (when bounds wrap around 180/-180)
            // If the viewport crosses the date line, Mapbox returns bounds where minLng > maxLng
            // For example: minLng = 170, maxLng = -170 means we're viewing from 170°E to 170°W
            if (minLng > maxLng) {
              // This means we're crossing the date line
              // For PostGIS queries, we need to use the full longitude range to include both sides
              console.log('[CrewBrowseMap] Viewport crosses international date line, using full longitude range', {
                originalMinLng: minLng,
                originalMaxLng: maxLng,
              });
              // Use the full longitude range that includes both sides of the date line
              minLng = -180;
              maxLng = 180;
            }

            // Clamp values to valid ranges (after date line handling)
            minLng = Math.max(-180, Math.min(180, minLng));
            minLat = Math.max(-90, Math.min(90, minLat));
            maxLng = Math.max(-180, Math.min(180, maxLng));
            maxLat = Math.max(-90, Math.min(90, maxLat));

            // Final validation - ensure min < max after all adjustments
            const lngValid = minLng < maxLng;
            const latValid = minLat < maxLat;
            
            if (!lngValid || !latValid) {
              const errorDetails = {
                minLng: typeof minLng === 'number' ? minLng : String(minLng),
                minLat: typeof minLat === 'number' ? minLat : String(minLat),
                maxLng: typeof maxLng === 'number' ? maxLng : String(maxLng),
                maxLat: typeof maxLat === 'number' ? maxLat : String(maxLat),
                lngValid,
                latValid,
                lngDiff: typeof maxLng === 'number' && typeof minLng === 'number' ? maxLng - minLng : 'N/A',
                latDiff: typeof maxLat === 'number' && typeof minLat === 'number' ? maxLat - minLat : 'N/A',
              };
              
              console.error('[CrewBrowseMap] Invalid bounds after normalization:', errorDetails);
              console.error('[CrewBrowseMap] Raw values:', {
                minLngRaw: bounds.getWest(),
                minLatRaw: bounds.getSouth(),
                maxLngRaw: bounds.getEast(),
                maxLatRaw: bounds.getNorth(),
              });
              
              isLoadingRef.current = false;
              setLoading(false);
              return;
            }

            // Check if viewport has changed significantly
            const newBounds = { minLng, minLat, maxLng, maxLat };
            if (!hasViewportChangedSignificantly(newBounds, lastLoadedBoundsRef.current)) {
              console.log('[CrewBrowseMap] Viewport has not changed significantly, skipping reload');
              isLoadingRef.current = false;
              setLoading(false);
              return;
            }

            console.log('[CrewBrowseMap] Fetching legs for viewport:', {
              minLng,
              minLat,
              maxLng,
              maxLat,
            });

            const params = new URLSearchParams({
              min_lng: minLng.toString(),
              min_lat: minLat.toString(),
              max_lng: maxLng.toString(),
              max_lat: maxLat.toString(),
            });

            const url = `/api/legs/viewport?${params.toString()}`;
            console.log('[CrewBrowseMap] Fetching from:', url);

            const response = await fetch(url);
            if (!response.ok) {
              const errorText = await response.text();
              console.error('[CrewBrowseMap] API error:', response.status, errorText);
              throw new Error(`Failed to fetch legs: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[CrewBrowseMap] Received data:', { legCount: data.legs?.length || 0, data });
            setLegs(data.legs || []);
            
            // Update last loaded bounds
            lastLoadedBoundsRef.current = newBounds;
          } catch (error) {
            console.error('[CrewBrowseMap] Error loading legs:', error);
          } finally {
            setLoading(false);
            isLoadingRef.current = false;
          }
        }, 300);
    };

    // Update zoom level when zoom changes
    const updateZoom = () => {
      if (map.current) {
        const currentZoom = map.current.getZoom();
        setZoomLevel(currentZoom);
      }
    };

    // Handle map load
    map.current.on('load', () => {
      console.log('[CrewBrowseMap] Map loaded');
      mapLoadedRef.current = true;
      setMapLoaded(true);
      
      if (!map.current) return;
      
      // Set cursor to default pointer
      if (map.current.getCanvasContainer()) {
        map.current.getCanvasContainer().style.cursor = 'default';
      }

      // Add GeoJSON source for legs with clustering
      map.current.addSource('legs-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50, // Radius of each cluster when clustering points
      });

      // Add cluster circles layer
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'legs-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#22276E', // Custom blue for small clusters
            10,
            '#1a1f56', // Darker for medium clusters
            30,
            '#14193d', // Darkest for large clusters
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20, // Small clusters
            10,
            30, // Medium clusters
            30,
            40, // Large clusters
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });

      // Add cluster count labels
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'legs-source',
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

      // Add unclustered point layer (individual leg markers)
      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'legs-source',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#22276E',
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });

      // Handle cluster clicks - zoom in
      map.current.on('click', 'clusters', (e) => {
        const features = map.current!.queryRenderedFeatures(e.point, {
          layers: ['clusters'],
        });
        const clusterId = features[0].properties!.cluster_id;
        const source = map.current!.getSource('legs-source') as mapboxgl.GeoJSONSource;
        
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !zoom) return;
          
          map.current!.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: zoom,
          });
        });
      });

      // Change cursor on hover for clusters
      map.current.on('mouseenter', 'clusters', () => {
        if (map.current && map.current.getCanvasContainer()) {
          map.current.getCanvasContainer().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'clusters', () => {
        if (map.current && map.current.getCanvasContainer()) {
          map.current.getCanvasContainer().style.cursor = '';
        }
      });

      // Handle clicks on unclustered points - select leg
      const handlePointClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const features = map.current!.queryRenderedFeatures(e.point, {
          layers: ['unclustered-point'],
        });
        
        if (features.length > 0) {
          const legId = features[0].properties!.leg_id;
          // Find the leg in our legs map
          const leg = legsMapRef.current.get(legId);
          if (leg) {
            setSelectedLeg(leg);
            // Optionally fly to the leg location
            if (leg.start_waypoint) {
              map.current!.flyTo({
                center: [leg.start_waypoint.lng, leg.start_waypoint.lat],
                zoom: Math.max(map.current!.getZoom(), 10),
                duration: 1000,
              });
            }
          }
        }
      };

      map.current.on('click', 'unclustered-point', handlePointClick);

      // Change cursor on hover for unclustered points
      map.current.on('mouseenter', 'unclustered-point', () => {
        if (map.current && map.current.getCanvasContainer()) {
          map.current.getCanvasContainer().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'unclustered-point', () => {
        if (map.current && map.current.getCanvasContainer()) {
          map.current.getCanvasContainer().style.cursor = '';
        }
      });

      sourceAddedRef.current = true;
      
      // Attach viewport handlers now that map is loaded
      if (map.current) {
        map.current.on('zoom', updateZoom);
        map.current.on('zoomend', handleViewportChange);
        map.current.on('moveend', handleViewportChange);
      }
      
      // Set initial zoom level
      const currentZoom = map.current.getZoom();
      setZoomLevel(currentZoom);
      console.log('[CrewBrowseMap] Initial zoom:', currentZoom);
      
      // Trigger initial leg load
      setTimeout(() => {
        if (map.current) {
          console.log('[CrewBrowseMap] Triggering initial leg load');
          handleViewportChange();
        }
      }, 500);
    });

    // Cleanup on unmount only
    return () => {
      if (viewportDebounceTimerRef.current) {
        clearTimeout(viewportDebounceTimerRef.current);
      }
      if (map.current) {
        // Remove layers and source
        try {
          if (map.current.getLayer('clusters')) {
            map.current.removeLayer('clusters');
          }
          if (map.current.getLayer('cluster-count')) {
            map.current.removeLayer('cluster-count');
          }
          if (map.current.getLayer('unclustered-point')) {
            map.current.removeLayer('unclustered-point');
          }
          if (map.current.getSource('legs-source')) {
            map.current.removeSource('legs-source');
          }
        } catch (error) {
          // Layers/source may not exist if map wasn't fully loaded
          console.log('[CrewBrowseMap] Error removing layers/source:', error);
        }
        
        // Remove event listeners
        map.current.off('zoom', updateZoom);
        map.current.off('zoomend', handleViewportChange);
        map.current.off('moveend', handleViewportChange);
        // Note: We can't easily remove the click handler without storing a reference
        // but it will be cleaned up when the map is removed
        map.current.remove();
        map.current = null;
      }
      mapInitializedRef.current = false;
      sourceAddedRef.current = false;
    };
  }, []); // Empty deps - only run once on mount

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full relative ${className}`}
      style={{ minHeight: '400px', cursor: 'default', ...(style || {}) }}
    >
      {/* Debug: Zoom level */}
      <div className="absolute top-4 right-4 bg-card border border-border rounded-lg shadow-lg px-4 py-2 z-10">
        <div className="text-sm text-foreground font-mono space-y-1">
          <div>Zoom: {zoomLevel.toFixed(2)}</div>
          {legs.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {legs.length} {legs.length === 1 ? 'leg' : 'legs'}
            </div>
          )}
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-4 left-4 bg-card border border-border rounded-lg shadow-lg px-4 py-2 z-10">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-foreground">Loading legs...</span>
          </div>
        </div>
      )}

      {/* Leg Details Panel - Left Side */}
      {selectedLeg && (
        <LegDetailsPanel
          leg={selectedLeg}
          isOpen={!!selectedLeg}
          onClose={() => setSelectedLeg(null)}
        />
      )}
    </div>
  );
}
