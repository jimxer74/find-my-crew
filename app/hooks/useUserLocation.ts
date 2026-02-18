'use client';

import { useState, useEffect } from 'react';

export type UserLocationState = {
  lat: number | null;
  lng: number | null;
  loading: boolean;
  error: string | null;
  permissionState: PermissionState | null;
};

// Default fallback location (Mediterranean - popular sailing area)
const DEFAULT_LOCATION = {
  lat: 41.9028, // Rome, Italy area
  lng: 12.4964,
};

/**
 * Hook to get user's current location via browser Geolocation API
 * Falls back to a default location (Mediterranean) if permission denied
 */
export function useUserLocation(): UserLocationState {
  const [state, setState] = useState<UserLocationState>({
    lat: null,
    lng: null,
    loading: true,
    error: null,
    permissionState: null,
  });

  useEffect(() => {
    // Check if geolocation is available
    if (!navigator.geolocation) {
      setState({
        lat: DEFAULT_LOCATION.lat,
        lng: DEFAULT_LOCATION.lng,
        loading: false,
        error: 'Geolocation is not supported by this browser',
        permissionState: null,
      });
      return;
    }

    // Check permission state if available
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          setState((prev) => ({ ...prev, permissionState: result.state }));

          // Listen for permission changes
          result.onchange = () => {
            setState((prev) => ({ ...prev, permissionState: result.state }));
            if (result.state === 'granted') {
              requestLocation();
            }
          };
        })
        .catch((error) => {
          console.error('Error querying geolocation permission:', error);
          // Continue without permission state
        });
    }

    // Request location
    requestLocation();

    function requestLocation() {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            loading: false,
            error: null,
            permissionState: 'granted',
          });
        },
        (error) => {
          let errorMessage = 'Unknown error';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }

          // Fall back to default location
          setState({
            lat: DEFAULT_LOCATION.lat,
            lng: DEFAULT_LOCATION.lng,
            loading: false,
            error: errorMessage,
            permissionState: error.code === error.PERMISSION_DENIED ? 'denied' : null,
          });
        },
        {
          enableHighAccuracy: false, // Don't need high accuracy for region sorting
          timeout: 10000, // 10 second timeout
          maximumAge: 300000, // Cache for 5 minutes
        }
      );
    }
  }, []);

  return state;
}
