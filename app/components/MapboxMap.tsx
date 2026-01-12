'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type MapboxMapProps = {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onContextMenu?: (lng: number, lat: number) => void;
  className?: string;
};

export function MapboxMap({
  initialCenter = [-74.5, 40], // Default to New York area
  initialZoom = 2,
  onMapLoad,
  onContextMenu,
  className = '',
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

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

    // Handle map load
    map.current.on('load', () => {
      setMapLoaded(true);
      if (onMapLoad && map.current) {
        onMapLoad(map.current);
      }
    });

    // Handle right-click context menu
    const handleContextMenu = (e: mapboxgl.MapMouseEvent) => {
      e.preventDefault();
      if (map.current && mapContainer.current) {
        const { lng, lat } = e.lngLat;
        const rect = mapContainer.current.getBoundingClientRect();
        setContextMenu({
          x: e.point.x,
          y: e.point.y,
          lng,
          lat,
        });
        if (onContextMenu) {
          onContextMenu(lng, lat);
        }
      }
    };

    map.current.on('contextmenu', handleContextMenu);

    // Close context menu on map click
    const handleMapClick = () => {
      setContextMenu(null);
    };
    map.current.on('click', handleMapClick);

    // Cleanup
    return () => {
      if (map.current) {
        map.current.off('contextmenu', handleContextMenu);
        map.current.off('click', handleMapClick);
        // Remove all markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        map.current.remove();
        map.current = null;
      }
    };
  }, [initialCenter, initialZoom, onMapLoad, onContextMenu]);

  const handleStartNewLeg = () => {
    if (!map.current || !contextMenu || !mapLoaded) {
      console.log('Cannot add marker:', { map: !!map.current, contextMenu: !!contextMenu, mapLoaded });
      return;
    }

    try {
      // Create a green marker element
      const el = document.createElement('div');
      el.className = 'green-marker';
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#22c55e'; // green-500
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'grab';

      // Create and add draggable marker to map
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        draggable: true,
      })
        .setLngLat([contextMenu.lng, contextMenu.lat])
        .addTo(map.current);

      // Change cursor when dragging starts
      marker.on('dragstart', () => {
        el.style.cursor = 'grabbing';
      });

      // Change cursor back when dragging ends
      marker.on('dragend', () => {
        el.style.cursor = 'grab';
        const lngLat = marker.getLngLat();
        console.log('Marker moved to:', lngLat.lng, lngLat.lat);
      });

      // Store marker reference for cleanup
      markersRef.current.push(marker);

      console.log('Marker added at:', contextMenu.lng, contextMenu.lat);
      setContextMenu(null);
    } catch (error) {
      console.error('Error adding marker:', error);
    }
  };

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full relative ${className}`}
      style={{ minHeight: '400px' }}
    >
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="absolute bg-card border border-border rounded-md shadow-lg z-50 min-w-[160px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <button
            onClick={handleStartNewLeg}
            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
          >
            Start new leg
          </button>
        </div>
      )}
    </div>
  );
}
