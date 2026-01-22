'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LegDetailsPanel } from './LegDetailsPanel';
import { LegMobileCard } from './LegMobileCard';
import { useAuth } from '@/app/contexts/AuthContext';
import { useFilters } from '@/app/contexts/FilterContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { calculateMatchPercentage, checkExperienceLevelMatch } from '@/app/lib/skillMatching';

type Leg = {
  leg_id: string;
  leg_name: string;
  leg_description: string | null;
  journey_id: string;
  journey_name: string;
  start_date: string | null;
  end_date: string | null;
  crew_needed: number | null;
  leg_risk_level: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null;
  journey_risk_level: ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[] | null;
  skills: string[];
  boat_id: string;
  boat_name: string;
  boat_type: string | null;
  boat_image_url: string | null;
  boat_average_speed_knots: number | null;
  boat_make: string | null;
  boat_model: string | null;
  owner_name: string | null;
  owner_image_url: string | null;
  min_experience_level: number | null;
  skill_match_percentage?: number; // Calculated on frontend, not from API
  experience_level_matches?: boolean; // Whether user's experience level meets requirement
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
  const [showFullPanelOnMobile, setShowFullPanelOnMobile] = useState(false);
  const [legWaypoints, setLegWaypoints] = useState<Array<{
    id: string;
    index: number;
    name: string | null;
    coordinates: [number, number] | null;
  }>>([]);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [userExperienceLevel, setUserExperienceLevel] = useState<number | null>(null);
  const [userRegistrations, setUserRegistrations] = useState<Map<string, 'Approved' | 'Pending approval'>>(new Map()); // leg_id -> status
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const { user } = useAuth();
  const { filters } = useFilters();
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
  const routeSourceAddedRef = useRef(false);
  const isFittingBoundsRef = useRef(false);
  const userSkillsRef = useRef<string[]>([]);
  const userExperienceLevelRef = useRef<number | null>(null);
  const iconsLoadedRef = useRef(false);
  const approvedLegsWaypointsRef = useRef<Map<string, Array<{
    id: string;
    index: number;
    name: string | null;
    coordinates: [number, number] | null;
  }>>>(new Map());

  // Function to create Mapbox-style pin marker icon with text
  const createPinMarkerIcon = (color: string, text: string): string => {
    // Create SVG for Mapbox-style pin marker with text inside and shadow
    const svg = `
      <svg width="27" height="41" viewBox="0 0 27 41" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <path d="M13.5 0C6.04 0 0 6.04 0 13.5C0 23.58 13.5 41 13.5 41C13.5 41 27 23.58 27 13.5C27 6.04 20.96 0 13.5 0Z" fill="${color}" stroke="#fff" stroke-width="1.5" filter="url(#shadow)"/>
        <text x="13.5" y="18" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="middle">${text}</text>
      </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  };

  // Function to create CREW. marker styled like LogoWithText
  const createCrewMarkerIcon = (): string => {
    // Create SVG marker with CREW. text styled like LogoWithText
    // Slightly smaller font size than LogoWithText (LogoWithText uses larger, this uses 18px)
    // Shape mimics the border-radius: '50% 0% 50% 50% / 120%' from LogoWithText
    // This creates a rounded shape with one sharp corner (top-right)
    // Using a unique filter ID to avoid conflicts
    const filterId = `crew-shadow-${Math.random().toString(36).substring(7)}`;
    const svg = `
      <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <!-- Shape that mimics border-radius: 50% 0% 50% 50% / 120% -->
        <!-- Top-left: 50% radius (30px), Top-right: 0% (sharp), Bottom-right: 50%, Bottom-left: 50% -->
        <!-- Vertical radius: 120% of horizontal (36px vertical) -->
        <path 
          d="M 0 36 Q 0 0 30 0 L 60 0 L 60 30 Q 60 60 30 60 Q 0 60 0 30 Z" 
          fill="#22276E" 
          filter="url(#${filterId})"
        />
        <text 
          x="30" 
          y="35" 
          font-family="Cascadia Code, monospace" 
          font-size="18" 
          font-weight="600" 
          fill="#fff" 
          text-anchor="middle" 
          dominant-baseline="middle"
        >CREW.</text>
      </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  };

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

  // Load user's skills and experience level from profile
  useEffect(() => {
    if (!user) {
      setUserSkills([]);
      userSkillsRef.current = [];
      setUserExperienceLevel(null);
      userExperienceLevelRef.current = null;
      return;
    }

    const loadUserProfile = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('skills, sailing_experience')
        .eq('id', user.id)
        .single();

      if (error) {
        // Profile doesn't exist (PGRST116) - this is expected for users without profiles
        if (error.code === 'PGRST116') {
          // User doesn't have a profile yet - set empty values
          setUserSkills([]);
          userSkillsRef.current = [];
          setUserExperienceLevel(null);
          userExperienceLevelRef.current = null;
          return;
        }
        // Other errors should be logged
        console.error('[CrewBrowseMap] Error loading user profile:', error);
        setUserSkills([]);
        userSkillsRef.current = [];
        setUserExperienceLevel(null);
        userExperienceLevelRef.current = null;
        return;
      }

      // Load skills - keep in canonical format for matching
      if (data?.skills && Array.isArray(data.skills)) {
        // Parse skills from JSON strings to extract skill_name
        // Skills are stored as: ['{"skill_name": "first_aid", "description": "..."}', ...]
        const { normalizeSkillNames } = await import('@/app/lib/skillUtils');
        const parsedSkills = normalizeSkillNames(data.skills);
        console.log('[CrewBrowseMap] User skills loaded (canonical):', parsedSkills);
        setUserSkills(parsedSkills);
        userSkillsRef.current = parsedSkills;
      } else {
        setUserSkills([]);
        userSkillsRef.current = [];
      }

      // Load experience level
      if (data?.sailing_experience !== null && data?.sailing_experience !== undefined) {
        const experienceLevel = data.sailing_experience as number;
        console.log('[CrewBrowseMap] User experience level loaded:', experienceLevel);
        setUserExperienceLevel(experienceLevel);
        userExperienceLevelRef.current = experienceLevel;
      } else {
        setUserExperienceLevel(null);
        userExperienceLevelRef.current = null;
      }
    };

    const loadUserRegistrations = async () => {
      if (!user) {
        setUserRegistrations(new Map());
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('registrations')
          .select('leg_id, status')
          .eq('user_id', user.id)
          .in('status', ['Approved', 'Pending approval']);

        if (error) {
          console.error('[CrewBrowseMap] Error loading registrations:', error);
          setUserRegistrations(new Map());
          return;
        }

        // Create map of leg_id -> status
        const registrationsMap = new Map<string, 'Approved' | 'Pending approval'>();
        (data || []).forEach((reg: { leg_id: string; status: string }) => {
          if (reg.status === 'Approved' || reg.status === 'Pending approval') {
            registrationsMap.set(reg.leg_id, reg.status as 'Approved' | 'Pending approval');
          }
        });

        console.log('[CrewBrowseMap] User registrations loaded:', registrationsMap);
        setUserRegistrations(registrationsMap);
      } catch (error) {
        console.error('[CrewBrowseMap] Error loading registrations:', error);
        setUserRegistrations(new Map());
      }
    };

    loadUserProfile();
    loadUserRegistrations();
  }, [user]);

  // Reload legs when filters change
  useEffect(() => {
    // Trigger reload when filters change
    if (map.current && mapLoadedRef.current) {
      // Trigger a moveend event to reload legs with new filter
      setTimeout(() => {
        if (map.current && mapLoadedRef.current) {
          map.current.fire('moveend');
        }
      }, 100);
    }
  }, [filters.experienceLevel, filters.riskLevel, filters.location, filters.dateRange]);

  // Update GeoJSON source when legs change
  useEffect(() => {
    if (!map.current || !mapLoaded || !sourceAddedRef.current) return;

    // Separate approved legs from others to prevent clustering
    const approvedLegIds = new Set(
      Array.from(userRegistrations.entries())
        .filter(([_, status]) => status === 'Approved')
        .map(([legId]) => legId)
    );

    // Convert legs to GeoJSON format, excluding approved legs from clustering source
    const features = legs
      .filter(leg => 
        leg.start_waypoint !== null && 
        !approvedLegIds.has(leg.leg_id) // Exclude approved legs from clustering
      )
      .map(leg => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [leg.start_waypoint!.lng, leg.start_waypoint!.lat],
        },
        properties: {
          leg_id: leg.leg_id,
          match_percentage: leg.skill_match_percentage ?? 100, // Default to 100 if not calculated
          experience_matches: leg.experience_level_matches ?? true, // Whether experience level matches
          registration_status: userRegistrations.get(leg.leg_id) || null, // 'Pending approval', or null (Approved excluded)
        },
      }));

    const geoJsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Update the source data (clustered source - excludes approved legs)
    const source = map.current.getSource('legs-source') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geoJsonData);
    }

    // Update approved legs source (non-clustered, always visible)
    const approvedFeatures = legs
      .filter(leg => 
        leg.start_waypoint !== null && 
        approvedLegIds.has(leg.leg_id)
      )
      .map(leg => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [leg.start_waypoint!.lng, leg.start_waypoint!.lat],
        },
        properties: {
          leg_id: leg.leg_id,
          match_percentage: leg.skill_match_percentage ?? 100,
          experience_matches: leg.experience_level_matches ?? true,
          registration_status: 'Approved' as const,
        },
      }));

    const approvedGeoJsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: approvedFeatures,
    };

    const approvedSource = map.current.getSource('approved-legs-source') as mapboxgl.GeoJSONSource;
    if (approvedSource) {
      approvedSource.setData(approvedGeoJsonData);
    }

    // Fetch waypoints for approved legs and update routes
    const approvedLegs = legs.filter(leg => 
      userRegistrations.get(leg.leg_id) === 'Approved' &&
      leg.start_waypoint !== null &&
      leg.end_waypoint !== null
    );

    // Fetch waypoints for all approved legs
    const fetchApprovedLegsWaypoints = async () => {
      const waypointsMap = new Map<string, Array<{
        id: string;
        index: number;
        name: string | null;
        coordinates: [number, number] | null;
      }>>();

      // Fetch waypoints for each approved leg
      const waypointPromises = approvedLegs.map(async (leg) => {
        try {
          const response = await fetch(`/api/legs/${leg.leg_id}/waypoints`);
          if (response.ok) {
            const data = await response.json();
            waypointsMap.set(leg.leg_id, data.waypoints || []);
          } else {
            console.warn(`[CrewBrowseMap] Failed to fetch waypoints for leg ${leg.leg_id}`);
            waypointsMap.set(leg.leg_id, []);
          }
        } catch (error) {
          console.error(`[CrewBrowseMap] Error fetching waypoints for leg ${leg.leg_id}:`, error);
          waypointsMap.set(leg.leg_id, []);
        }
      });

      await Promise.all(waypointPromises);
      approvedLegsWaypointsRef.current = waypointsMap;

      // Create route features with all waypoints
      const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = approvedLegs.map(leg => {
        const waypoints = waypointsMap.get(leg.leg_id) || [];
        
        // Filter waypoints with valid coordinates and sort by index
        const validWaypoints = waypoints
          .filter(wp => wp.coordinates !== null)
          .sort((a, b) => a.index - b.index);

        // If we have waypoints, use them; otherwise fall back to start/end
        let coordinates: [number, number][];
        if (validWaypoints.length >= 2) {
          coordinates = validWaypoints.map(wp => wp.coordinates!);
        } else {
          // Fallback to start and end waypoints if waypoints aren't loaded yet
          coordinates = [
            [leg.start_waypoint!.lng, leg.start_waypoint!.lat],
            [leg.end_waypoint!.lng, leg.end_waypoint!.lat],
          ];
        }

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates,
          },
          properties: {
            leg_id: leg.leg_id,
          },
        };
      });

      const approvedRoutesData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: routeFeatures,
      };

      // Update approved routes source if it exists (only after routeSourceAddedRef is true)
      if (routeSourceAddedRef.current && map.current) {
        const approvedRoutesSource = map.current.getSource('approved-legs-routes-source') as mapboxgl.GeoJSONSource;
        if (approvedRoutesSource) {
          approvedRoutesSource.setData(approvedRoutesData);
        }
      }
    };

    // Fetch waypoints and update routes
    if (approvedLegs.length > 0 && routeSourceAddedRef.current) {
      fetchApprovedLegsWaypoints();
    } else if (routeSourceAddedRef.current && map.current) {
      // Clear routes if no approved legs
      const approvedRoutesSource = map.current.getSource('approved-legs-routes-source') as mapboxgl.GeoJSONSource;
      if (approvedRoutesSource) {
        approvedRoutesSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, [legs, mapLoaded, userRegistrations]);

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
      style: 'mapbox://styles/mapbox/light-v11', // Less colorful, muted style
      center: initialCenter,
      zoom: initialZoom,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Handle viewport changes (move, zoom) - load legs when zoom > 3.5
      // Note: This function captures state at mount time, but we'll use refs for dynamic values
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

            // Add experience level filter if set
            if (filters.experienceLevel !== null) {
              params.append('min_experience_level', filters.experienceLevel.toString());
            }

            // Add risk level filter if set (multi-select)
            if (filters.riskLevel && filters.riskLevel.length > 0) {
              params.append('risk_levels', filters.riskLevel.join(','));
            }

            // Add date range filter if set
            if (filters.dateRange.start) {
              params.append('start_date', filters.dateRange.start.toISOString().split('T')[0]);
            }
            if (filters.dateRange.end) {
              params.append('end_date', filters.dateRange.end.toISOString().split('T')[0]);
            }

            // Note: We no longer filter by skills in the API
            // Instead, we fetch all legs and filter by match percentage on the frontend
            // This allows us to show match percentages for all legs
            console.log('[CrewBrowseMap] Fetching legs with filters:', {
              experienceLevel: filters.experienceLevel,
              riskLevel: filters.riskLevel,
              dateRange: filters.dateRange,
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
            
            // Calculate match percentage and experience level match for each leg
            let legsWithMatch = (data.legs || []).map((leg: Leg) => {
              const experienceMatches = checkExperienceLevelMatch(
                userExperienceLevelRef.current,
                leg.min_experience_level
              );
              
              const matchPercentage = calculateMatchPercentage(
                userSkillsRef.current,
                leg.skills || [],
                userExperienceLevelRef.current,
                leg.min_experience_level
              );
              
              return {
                ...leg,
                skill_match_percentage: matchPercentage,
                experience_level_matches: experienceMatches,
              };
            });
            
            // Note: Experience level and risk level filtering are now done in SQL (backend)
            // The API already returns filtered results based on filters.experienceLevel and filters.riskLevel
            
            console.log('[CrewBrowseMap] Legs with match percentages:', legsWithMatch.map((l: Leg) => ({
              leg_name: l.leg_name,
              match_percentage: l.skill_match_percentage,
              experience_matches: l.experience_level_matches,
              min_experience_level: l.min_experience_level,
              skills: l.skills,
            })));
            
            setLegs(legsWithMatch);
            
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


    // Handle map load
    map.current.on('load', async () => {
      console.log('[CrewBrowseMap] Map loaded');
      mapLoadedRef.current = true;
      setMapLoaded(true);
      
      if (!map.current) return;
      
      // Set cursor to default pointer
      if (map.current.getCanvasContainer()) {
        map.current.getCanvasContainer().style.cursor = 'default';
      }

      // Load custom pin marker icons for registered legs
      if (!iconsLoadedRef.current && map.current) {
        try {
          // Load approved boat icon from public folder
          const approvedIcon = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => {
              console.error('[CrewBrowseMap] Error loading boat_approved2.png:', err);
              reject(err);
            };
            img.src = '/boat_approved2.png';
          });
          map.current.addImage('pin-marker-approved', approvedIcon);

          // Create pending pin marker with yellow color and "P" text
          const pendingIcon = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = createPinMarkerIcon('#eab308', 'P'); // yellow-500
          });
          map.current.addImage('pin-marker-pending', pendingIcon);

          iconsLoadedRef.current = true;
          console.log('[CrewBrowseMap] Custom pin marker icons loaded');
        } catch (error) {
          console.error('[CrewBrowseMap] Error loading custom pin marker icons:', error);
        }
      }

      // Add GeoJSON source for legs with clustering (excludes approved legs)
      map.current.addSource('legs-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50, // Radius of each cluster when clustering points
        clusterMinPoints: 4, // Only cluster if there are more than 4 waypoints (5 or more)
      });

      // Add separate non-clustered source for approved legs (always visible, never clustered)
      map.current.addSource('approved-legs-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
        cluster: false, // No clustering for approved legs
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
            '#d1d5db', // Light gray for small clusters
            10,
            '#9ca3af', // Medium gray for medium clusters
            30,
            '#6b7280', // Darker gray for large clusters
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
          'text-size': 14,
          'text-allow-overlap': true, // Always show text even if overlapping
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': '#000',
          'text-halo-width': 1,
          'text-halo-blur': 1,
        },
      });

      // Add icon layers for registered legs (approved and pending)
      // These will be added after icons are loaded, but we define them here
      // Approved registrations - boat_approved.png icon (larger than normal markers)
      // Uses separate non-clustered source so approved legs always show individually
      map.current.addLayer({
        id: 'registered-approved',
        type: 'symbol',
        source: 'approved-legs-source', // Use separate non-clustered source
        layout: {
          'icon-image': 'pin-marker-approved',
          'icon-size': 0.2,
          'icon-anchor': 'center',
          'icon-allow-overlap': true,
        },
      });

      // Pending registrations - orange pin marker with "P"
      map.current.addLayer({
        id: 'registered-pending',
        type: 'symbol',
        source: 'legs-source',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['==', ['get', 'registration_status'], 'Pending approval'],
        ],
        layout: {
          'icon-image': 'pin-marker-pending',
          'icon-size': 0.8, // Pin marker size
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
        },
      });

      // Add unclustered point layer (individual leg markers for non-registered legs)
      // Color based on match percentage: green (80+), yellow (50-79), orange (25-49), red (<25)
      // Always show red if experience level doesn't match
      // Only show circles for legs without registrations
      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'legs-source',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['==', ['get', 'registration_status'], null], // Only show circles for non-registered legs
        ],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'experience_matches'], false],
            '#ef4444', // red-500 - always red if experience level doesn't match
            ['>=', ['get', 'match_percentage'], 80],
            '#22c55e', // green-500
            ['>=', ['get', 'match_percentage'], 50],
            '#eab308', // yellow-500
            ['>=', ['get', 'match_percentage'], 25],
            '#f97316', // orange-500
            '#ef4444', // red-500
          ],
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

      // Handle clicks on unclustered points and registered icons - select leg
      const handlePointClick = async (e: mapboxgl.MapLayerMouseEvent) => {
        const features = map.current!.queryRenderedFeatures(e.point, {
          layers: ['unclustered-point', 'registered-approved', 'registered-pending'],
        });
        
        if (features.length > 0) {
          const legId = features[0].properties!.leg_id;
          // Find the leg in our legs map
          const leg = legsMapRef.current.get(legId);
          if (leg) {
            console.log('[CrewBrowseMap] Leg selected:', legId);
            
            // Clear previous selection first to prevent focusing on old leg
            setSelectedLeg(null);
            setLegWaypoints([]);
            setShowFullPanelOnMobile(false);
            
            // Small delay to ensure state is cleared
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Set new leg and fetch waypoints
            setSelectedLeg(leg);
            
            // Fetch waypoints for this leg
            try {
              console.log('[CrewBrowseMap] Fetching waypoints for leg:', legId);
              const waypointsUrl = `/api/legs/${legId}/waypoints`;
              console.log('[CrewBrowseMap] Waypoints URL:', waypointsUrl);
              const response = await fetch(waypointsUrl);
              if (response.ok) {
                const data = await response.json();
                console.log('[CrewBrowseMap] Waypoints received:', data);
                setLegWaypoints(data.waypoints || []);
              } else {
                const errorText = await response.text();
                console.error('[CrewBrowseMap] Failed to fetch waypoints:', response.status, errorText);
                setLegWaypoints([]);
              }
            } catch (error) {
              console.error('[CrewBrowseMap] Error fetching waypoints:', error);
              setLegWaypoints([]);
            }
          }
        }
      };

      if (map.current) {
        map.current.on('click', 'unclustered-point', handlePointClick);
        map.current.on('click', 'registered-approved', handlePointClick);
        map.current.on('click', 'registered-pending', handlePointClick);
      }

      // Change cursor on hover for unclustered points
      const handleMouseEnter = () => {
        if (map.current && map.current.getCanvasContainer()) {
          map.current.getCanvasContainer().style.cursor = 'pointer';
        }
      };

      const handleMouseLeave = () => {
        if (map.current && map.current.getCanvasContainer()) {
          map.current.getCanvasContainer().style.cursor = '';
        }
      };

      // Tooltip handlers for registered markers
      const handleRegisteredMouseEnter = (e: mapboxgl.MapLayerMouseEvent) => {
        if (!map.current) return;
        
        const canvasContainer = map.current.getCanvasContainer();
        if (canvasContainer) {
          canvasContainer.style.cursor = 'pointer';
        }
        
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: ['registered-approved', 'registered-pending'],
        });
        
        if (features.length > 0) {
          const feature = features[0];
          const status = feature.properties?.registration_status as string;
          const statusText = status === 'Approved' ? 'Approved' : 'Pending approval';
          
          // Get mouse coordinates relative to map container
          const container = map.current.getCanvasContainer();
          if (!container) return;
          const rect = container.getBoundingClientRect();
          
          setTooltip({
            text: `Status: ${statusText}`,
            x: e.point.x,
            y: e.point.y - 10, // Offset above the marker
          });
        }
      };

      const handleRegisteredMouseLeave = () => {
        if (map.current && map.current.getCanvasContainer()) {
          map.current.getCanvasContainer().style.cursor = '';
        }
        setTooltip(null);
      };

      const handleRegisteredMouseMove = (e: mapboxgl.MapLayerMouseEvent) => {
        if (tooltip) {
          setTooltip({
            ...tooltip,
            x: e.point.x,
            y: e.point.y - 10,
          });
        }
      };

      map.current.on('mouseenter', 'unclustered-point', handleMouseEnter);
      map.current.on('mouseleave', 'unclustered-point', handleMouseLeave);
      map.current.on('mouseenter', 'registered-approved', handleRegisteredMouseEnter);
      map.current.on('mouseleave', 'registered-approved', handleRegisteredMouseLeave);
      map.current.on('mousemove', 'registered-approved', handleRegisteredMouseMove);
      map.current.on('mouseenter', 'registered-pending', handleRegisteredMouseEnter);
      map.current.on('mouseleave', 'registered-pending', handleRegisteredMouseLeave);
      map.current.on('mousemove', 'registered-pending', handleRegisteredMouseMove);

      sourceAddedRef.current = true;
      
      // Add route source for leg routes (initially empty)
      map.current.addSource('leg-route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Add route line layer with gradient to show direction
      // Option 1: Gradient from start (lighter) to end (darker) - shows direction
      map.current.addLayer({
        id: 'leg-route-line',
        type: 'line',
        source: 'leg-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#22276E',
          'line-width': 4,
          'line-opacity': 0.9,
          // Note: Mapbox doesn't support true gradients, but we can use a gradient-like effect
          // by using line-gradient with a color expression, or use multiple layers
        },
      }, 'unclustered-point'); // Insert before unclustered-point layer

      // Add source for approved leg routes
      map.current.addSource('approved-legs-routes-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Add dashed route line layer for approved legs
      map.current.addLayer({
        id: 'approved-legs-routes-line',
        type: 'line',
        source: 'approved-legs-routes-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#22276E',
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [2, 2], // Dashed line pattern
        },
      }, 'unclustered-point'); // Insert before unclustered-point layer
      


      routeSourceAddedRef.current = true;
      
      // Attach viewport handlers now that map is loaded
      if (map.current) {
        map.current.on('zoomend', handleViewportChange);
        map.current.on('moveend', handleViewportChange);
      }
      
      const currentZoom = map.current.getZoom();
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
          if (map.current.getLayer('registered-approved')) {
            map.current.removeLayer('registered-approved');
          }
          if (map.current.getLayer('registered-pending')) {
            map.current.removeLayer('registered-pending');
          }
          if (map.current.getLayer('leg-route-line')) {
            map.current.removeLayer('leg-route-line');
          }
          if (map.current.getLayer('approved-legs-routes-line')) {
            map.current.removeLayer('approved-legs-routes-line');
          }
          // Remove icons
          if (map.current.hasImage('pin-marker-approved')) {
            map.current.removeImage('pin-marker-approved');
          }
          if (map.current.hasImage('pin-marker-pending')) {
            map.current.removeImage('pin-marker-pending');
          }
          // Arrow layer removed - no longer needed
          if (map.current.getSource('legs-source')) {
            map.current.removeSource('legs-source');
          }
          if (map.current.getSource('approved-legs-source')) {
            map.current.removeSource('approved-legs-source');
          }
          if (map.current.getSource('leg-route-source')) {
            map.current.removeSource('leg-route-source');
          }
          if (map.current.getSource('approved-legs-routes-source')) {
            map.current.removeSource('approved-legs-routes-source');
          }
          // Arrow layer removed - no longer needed
        } catch (error) {
          // Layers/source may not exist if map wasn't fully loaded
          console.log('[CrewBrowseMap] Error removing layers/source:', error);
        }
        
        
        // Remove event listeners
        map.current.off('zoomend', handleViewportChange);
        map.current.off('moveend', handleViewportChange);
        // Note: We can't easily remove the click handler without storing a reference
        // but it will be cleaned up when the map is removed
        map.current.remove();
        map.current = null;
      }
      mapInitializedRef.current = false;
      sourceAddedRef.current = false;
      routeSourceAddedRef.current = false;
    };
  }, []); // Empty deps - only run once on mount

  // Handle leg selection and waypoint display
  useEffect(() => {
    console.log('[CrewBrowseMap] Route display effect triggered:', {
      hasMap: !!map.current,
      mapLoaded,
      routeSourceAdded: routeSourceAddedRef.current,
      selectedLeg: !!selectedLeg,
      waypointsCount: legWaypoints.length,
    });

    if (!map.current || !mapLoaded || !routeSourceAddedRef.current) {
      console.log('[CrewBrowseMap] Route display skipped - map not ready');
      return;
    }

    // Clear previous route
    const routeSource = map.current.getSource('leg-route-source') as mapboxgl.GeoJSONSource;
    if (routeSource) {
      routeSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }

    // If no leg selected or no waypoints, return
    if (!selectedLeg || legWaypoints.length === 0) {
      console.log('[CrewBrowseMap] Route display skipped - no leg or waypoints');
      return;
    }

    // Filter waypoints with valid coordinates
    const validWaypoints = legWaypoints.filter(wp => wp.coordinates !== null);
    console.log('[CrewBrowseMap] Valid waypoints:', validWaypoints.length, 'out of', legWaypoints.length);
    
    if (validWaypoints.length < 2) {
      console.log('[CrewBrowseMap] Route display skipped - need at least 2 waypoints');
      return; // Need at least start and end
    }

    // Create route line from all waypoints
    const coordinates = validWaypoints.map(wp => wp.coordinates!);
    console.log('[CrewBrowseMap] Creating route with coordinates:', coordinates);
    
    const routeFeature: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
      properties: {},
    };

    // Update route source (reuse the routeSource variable from above)
    if (routeSource) {
      console.log('[CrewBrowseMap] Updating route source with feature');
      routeSource.setData({
        type: 'FeatureCollection',
        features: [routeFeature],
      });
      
    } else {
      console.error('[CrewBrowseMap] Route source not found!');
    }


    // Calculate bounds to fit entire route
    const lngs = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);
    
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Add padding
    const padding = 0.1; // 10% padding
    const lngDiff = maxLng - minLng;
    const latDiff = maxLat - minLat;
    
    // Handle edge case where all waypoints are at the same location
    const finalLngDiff = lngDiff === 0 ? 0.01 : lngDiff;
    const finalLatDiff = latDiff === 0 ? 0.01 : latDiff;
    
    const bounds = new mapboxgl.LngLatBounds(
      [minLng - finalLngDiff * padding, minLat - finalLatDiff * padding],
      [maxLng + finalLngDiff * padding, maxLat + finalLatDiff * padding]
    );

    console.log('[CrewBrowseMap] Fitting bounds:', { minLng, maxLng, minLat, maxLat });

    // Prevent double focusing
    if (isFittingBoundsRef.current) {
      console.log('[CrewBrowseMap] Already fitting bounds, skipping');
      return;
    }

    isFittingBoundsRef.current = true;

    // Fit map to bounds
    map.current.fitBounds(bounds, {
      padding: 50, // Additional padding in pixels
      duration: 1000,
      maxZoom: 12, // Don't zoom in too much
      essential: true, // This is essential, don't interrupt
    });

    // Reset flag after animation completes
    setTimeout(() => {
      isFittingBoundsRef.current = false;
    }, 1100); // Slightly longer than animation duration
  }, [selectedLeg, legWaypoints, mapLoaded]);

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full relative ${className}`}
      style={{ minHeight: '400px', cursor: 'default', ...(style || {}) }}
    >

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-4 left-4 bg-card border border-border rounded-lg shadow-lg px-4 py-2 z-10">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-foreground">Loading legs...</span>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-20"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Mobile Card - Bottom Center (Mobile only, when not showing full panel) */}
      {selectedLeg && !showFullPanelOnMobile && (
        <LegMobileCard
          leg={selectedLeg}
          onClose={() => setSelectedLeg(null)}
          onClick={() => {
            // Open full panel on mobile when card is clicked
            setShowFullPanelOnMobile(true);
          }}
        />
      )}

      {/* Leg Details Panel - Full screen on mobile, side panel on desktop */}
      {selectedLeg && (
        <>
          {/* Mobile: Full screen panel */}
          {showFullPanelOnMobile && (
            <div className="md:hidden">
              <LegDetailsPanel
                leg={selectedLeg}
                isOpen={true}
                onClose={() => {
                  setShowFullPanelOnMobile(false);
                  setSelectedLeg(null);
                }}
                userSkills={userSkills}
                userExperienceLevel={userExperienceLevel}
                onRegistrationChange={() => {
                  // Could refresh data or show notification here
                  console.log('Registration status changed');
                }}
              />
            </div>
          )}
          
          {/* Desktop: Side panel */}
          <div className="hidden md:block">
            <LegDetailsPanel
              leg={selectedLeg}
              isOpen={!!selectedLeg}
              onClose={() => setSelectedLeg(null)}
              userSkills={userSkills}
              userExperienceLevel={userExperienceLevel}
              onRegistrationChange={() => {
                // Could refresh data or show notification here
                console.log('Registration status changed');
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
