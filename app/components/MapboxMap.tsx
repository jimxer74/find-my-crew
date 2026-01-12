'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type MapboxMapProps = {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  onMapLoad?: (map: mapboxgl.Map) => void;
  className?: string;
};

export function MapboxMap({
  initialCenter = [-74.5, 40], // Default to New York area
  initialZoom = 2,
  onMapLoad,
  className = '',
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [initialCenter, initialZoom, onMapLoad]);

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full ${className}`}
      style={{ minHeight: '400px' }}
    />
  );
}
