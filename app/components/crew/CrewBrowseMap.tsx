'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type Leg = {
  leg_id: string;
  leg_name: string;
  journey_name: string;
  start_waypoint: {
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
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const viewportDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);
  const mapLoadedRef = useRef(false);
  const lastLoadedBoundsRef = useRef<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const legsRef = useRef<Leg[]>([]);

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

  // Update markers when legs change (only when legs actually change, not on zoom)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Only show markers if zoom > 3.5
    if (zoomLevel <= 3.5) {
      // Clear markers if zoom is too low
      markersRef.current.forEach((marker) => {
        marker.remove();
      });
      markersRef.current.clear();
      legsRef.current = [];
      return;
    }

    // Check if legs have actually changed
    const legsChanged = 
      legs.length !== legsRef.current.length ||
      legs.some((leg, idx) => {
        const oldLeg = legsRef.current[idx];
        return !oldLeg || leg.leg_id !== oldLeg.leg_id;
      });

    if (!legsChanged) {
      // Legs haven't changed, don't recreate markers
      return;
    }

    // Legs have changed, update markers
    // Remove markers for legs that no longer exist
    const currentLegIds = new Set(legs.map(leg => leg.leg_id));
    markersRef.current.forEach((marker, legId) => {
      if (!currentLegIds.has(legId)) {
        marker.remove();
        markersRef.current.delete(legId);
      }
    });

    // Create or update markers for each leg's start waypoint
    legs.forEach((leg) => {
      if (!leg.start_waypoint) return;

      const { lng, lat } = leg.start_waypoint;

      // Check if marker already exists for this leg
      const existingMarker = markersRef.current.get(leg.leg_id);
      if (existingMarker) {
        // Update existing marker position if needed
        const currentLngLat = existingMarker.getLngLat();
        if (currentLngLat.lng !== lng || currentLngLat.lat !== lat) {
          existingMarker.setLngLat([lng, lat]);
        }
        return;
      }

      // Create new marker element
      const el = document.createElement('div');
      el.className = 'leg-marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#3b82f6'; // Blue marker
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
      el.style.cursor = 'pointer';

      // Create and add marker
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      markersRef.current.set(leg.leg_id, marker);
    });

    // Update ref with current legs
    legsRef.current = legs;
  }, [legs, mapLoaded, zoomLevel]);

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

      // Only load legs when zoom > 3.5
      if (currentZoom > 3.5) {
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
            const bounds = map.current.getBounds();
            if (!bounds) {
              console.log('[CrewBrowseMap] Debounced handler: bounds not available');
              isLoadingRef.current = false;
              setLoading(false);
              return;
            }
            
            const minLng = bounds.getWest();
            const minLat = bounds.getSouth();
            const maxLng = bounds.getEast();
            const maxLat = bounds.getNorth();

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
      } else {
        // Clear legs when zoom <= 3.5
        console.log('[CrewBrowseMap] Zoom <= 3.5, clearing legs');
        setLegs([]);
        lastLoadedBoundsRef.current = null; // Reset bounds so it will reload when zooming back in
      }
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
      // Load legs if zoom > 3.5 on initial load
      if (currentZoom > 3.5) {
        // Trigger viewport change handler to load legs
        setTimeout(() => {
          if (map.current) {
            console.log('[CrewBrowseMap] Triggering initial leg load');
            handleViewportChange();
          }
        }, 500);
      }
    });

    // Cleanup on unmount only
    return () => {
      if (viewportDebounceTimerRef.current) {
        clearTimeout(viewportDebounceTimerRef.current);
      }
      // Remove all markers
      markersRef.current.forEach((marker) => {
        marker.remove();
      });
      markersRef.current.clear();
      if (map.current) {
        // Remove event listeners
        map.current.off('zoom', updateZoom);
        map.current.off('zoomend', handleViewportChange);
        map.current.off('moveend', handleViewportChange);
        map.current.remove();
        map.current = null;
      }
      mapInitializedRef.current = false;
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
    </div>
  );
}
