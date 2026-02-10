'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LegDetailsPanel } from './LegDetailsPanel';
import { LegMobileCard } from './LegMobileCard';
import { BottomSheet, SnapPoint } from '../ui/BottomSheet';
import { LegList } from './LegList';
import { LegBrowsePane } from './LegBrowsePane';
import { useAuth } from '@/app/contexts/AuthContext';
import { useFilters } from '@/app/contexts/FilterContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { calculateMatchPercentage, checkExperienceLevelMatch, getMatchBorderColorForMap, getMatchColorForMap } from '@/app/lib/skillMatching';
import { splitLineAtAntimeridian, calculateBoundsWithAntimeridian } from '@/app/lib/postgis-helpers';
import { CostModel } from '@/app/types/cost-models';

    
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
  cost_model: CostModel | null;
  journey_images: string[];
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
  initialBounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number }; // Fit map to bounds
  initialLegId?: string | null; // Pre-select a leg by ID
  initialOpenRegistration?: boolean; // Auto-open registration form when leg is loaded
};

/**
 * Extract coordinates from a PostGIS geometry response
 */
function extractCoordinatesFromLocation(location: any): { lng: number; lat: number } | null {
  try {
    if (typeof location === 'string') {
      if (location.startsWith('{')) {
        const geoJson = JSON.parse(location);
        if (geoJson.coordinates) {
          return { lng: geoJson.coordinates[0], lat: geoJson.coordinates[1] };
        }
      }
    } else if (location?.coordinates) {
      return { lng: location.coordinates[0], lat: location.coordinates[1] };
    } else if (location?.x !== undefined && location?.y !== undefined) {
      return { lng: location.x, lat: location.y };
    }
  } catch (e) {
    console.error('[CrewBrowseMap] Failed to extract coordinates:', e);
  }
  return null;
}

export function CrewBrowseMap({
  className = '',
  style,
  initialCenter = [0, 20], // Default to center of world
  initialZoom = 2,
  initialBounds,
  initialLegId,
  initialOpenRegistration = false,
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
  const [showMobileLegCard, setShowMobileLegCard] = useState(false); // Track when MobileLegCard is shown from map click
  const [bottomSheetSnapPoint, setBottomSheetSnapPoint] = useState<SnapPoint>('collapsed');
  const [legWaypoints, setLegWaypoints] = useState<Array<{
    id: string;
    index: number;
    name: string | null;
    coordinates: [number, number] | null;
  }>>([]);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [userExperienceLevel, setUserExperienceLevel] = useState<number | null>(null);
  const [userRiskLevel, setUserRiskLevel] = useState<('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[] | null>(null);
  const [userRegistrations, setUserRegistrations] = useState<Map<string, 'Approved' | 'Pending approval'>>(new Map()); // leg_id -> status
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [visibleBounds, setVisibleBounds] = useState<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const [isLegsPaneMinimized, setIsLegsPaneMinimized] = useState(false);
  const { user } = useAuth();
  const { filters, lastUpdated } = useFilters();
  const filtersRef = useRef(filters);
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
  const isLocationFocusingRef = useRef(false); // Skip data reload while focusing on location filter
  const prevLocationRef = useRef<{ departure: typeof filters.location; arrival: typeof filters.arrivalLocation } | null>(null);
  const userSkillsRef = useRef<string[]>([]);
  const userExperienceLevelRef = useRef<number | null>(null);
  const userRiskLevelRef = useRef<('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[] | null>(null);
  const iconsLoadedRef = useRef(false);
  const approvedLegsWaypointsRef = useRef<Map<string, Array<{
    id: string;
    index: number;
    name: string | null;
    coordinates: [number, number] | null;
  }>>>(new Map());


  const approvedIconSize = 12;
  const pendingIconSize = 12;
  const unregisteredIconSize = 10;
  const approvedTextColor = '#01B000';
  const pendingTextColor = '#AEB000';
  const unregisteredTextColor = '#22276E';
  const initialLegIdProcessedRef = useRef<string | null>(null);

  // Helper function to select a leg and fetch its waypoints for route display
  const selectLegWithWaypoints = useCallback(async (leg: Leg) => {
    // Clear previous selection
    setSelectedLeg(null);
    setLegWaypoints([]);

    // Small delay to ensure state is cleared
    await new Promise(resolve => setTimeout(resolve, 50));

    // Set new leg
    setSelectedLeg(leg);

    // Fetch waypoints for route display
    try {
      console.log('[CrewBrowseMap] Fetching waypoints for leg:', leg.leg_id);
      const response = await fetch(`/api/legs/${leg.leg_id}/waypoints`);
      if (response.ok) {
        const data = await response.json();
        console.log('[CrewBrowseMap] Waypoints received:', data);
        setLegWaypoints(data.waypoints || []);
      } else {
        console.error('[CrewBrowseMap] Failed to fetch waypoints:', response.status);
        setLegWaypoints([]);
      }
    } catch (error) {
      console.error('[CrewBrowseMap] Error fetching waypoints:', error);
      setLegWaypoints([]);
    }
  }, []);

  // Helper function to get bottom sheet height in pixels based on snap point
  const getBottomSheetPixelHeight = useCallback((snapPoint: SnapPoint): number => {
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const headerHeight = 64; // 4rem

    switch (snapPoint) {
      case 'collapsed':
        return 80;
      case 'half':
        return viewportHeight * 0.5;
      case 'expanded':
        return viewportHeight - headerHeight;
      default:
        return 80;
    }
  }, []);

  // Helper function to calculate visible map bounds (excluding UI overlays)
  const calculateVisibleBounds = useCallback(() => {
    if (!map.current || !mapLoaded) return null;

    const container = map.current.getContainer();
    const rect = container.getBoundingClientRect();
    const { width, height } = rect;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    let visibleLeft = 0;
    const visibleTop = 0;
    const visibleRight = width;
    const visibleBottom = height;

    if (isMobile) {
      // For mobile, always use full screen height for filtering legs
      // This shows all legs visible on the full screen, even if waypoints might be under the bottom sheet
      // No adjustment needed - use full height
    } else {
      // Account for left pane (400px when visible)
      // Pane is visible when: no leg selected AND pane not minimized
      // OR when leg is selected (detail pane is shown)
      if (!isLegsPaneMinimized && !selectedLeg) {
        visibleLeft = 400;
      } else if (selectedLeg) {
        // Detail pane is always 400px when a leg is selected
        visibleLeft = 400;
      }
    }

    // Ensure we have valid bounds
    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) {
      return null;
    }

    try {
      // Convert pixel corners to geographic coordinates
      const sw = map.current.unproject([visibleLeft, visibleBottom]);
      const ne = map.current.unproject([visibleRight, visibleTop]);

      return {
        minLng: Math.min(sw.lng, ne.lng),
        minLat: Math.min(sw.lat, ne.lat),
        maxLng: Math.max(sw.lng, ne.lng),
        maxLat: Math.max(sw.lat, ne.lat)
      };
    } catch (error) {
      console.error('[CrewBrowseMap] Error calculating visible bounds:', error);
      return null;
    }
  }, [mapLoaded, isLegsPaneMinimized, selectedLeg]);

  // Update visible bounds (debounced via caller)
  const updateVisibleBounds = useCallback(() => {
    const bounds = calculateVisibleBounds();
    if (bounds) {
      setVisibleBounds(bounds);
    }
  }, [calculateVisibleBounds]);

  // Memoized filtered legs based on visible bounds
  // When only arrival filter is set, filter by end_waypoint; otherwise by start_waypoint
  const visibleLegs = useMemo(() => {
    if (!visibleBounds) return legs;

    // Determine which waypoint to use based on filters
    const showEndWaypoints = !filters.location && !!filters.arrivalLocation;

    return legs.filter(leg => {
      const wp = showEndWaypoints ? leg.end_waypoint : leg.start_waypoint;
      if (!wp) return false;

      return (
        wp.lng >= visibleBounds.minLng &&
        wp.lng <= visibleBounds.maxLng &&
        wp.lat >= visibleBounds.minLat &&
        wp.lat <= visibleBounds.maxLat
      );
    });
  }, [legs, visibleBounds, filters.location, filters.arrivalLocation]);

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
        .select('skills, sailing_experience, risk_level')
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
          setUserRiskLevel(null);
          userRiskLevelRef.current = null;
          return;
        }
        // Other errors should be logged
        console.error('[CrewBrowseMap] Error loading user profile:', error);
        setUserSkills([]);
        userSkillsRef.current = [];
        setUserExperienceLevel(null);
        userExperienceLevelRef.current = null;
        setUserRiskLevel(null);
        userRiskLevelRef.current = null;
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

      // Load risk level
      if (data?.risk_level && Array.isArray(data.risk_level)) {
        const parsedRiskLevel = data.risk_level;
        setUserRiskLevel(parsedRiskLevel);
        userRiskLevelRef.current = parsedRiskLevel;
      } else {
        setUserRiskLevel(null);
        userRiskLevelRef.current = null;
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

  // Update filters ref whenever filters change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Function to trigger reload
  const triggerDataReload = useCallback(() => {
    // Reset last loaded bounds to force reload
    lastLoadedBoundsRef.current = null;
    
    // Wait for map to be ready, with retries (max 10 retries = ~2 seconds)
    let retryCount = 0;
    const maxRetries = 10;
    const attemptReload = () => {
      if (map.current && mapLoadedRef.current) {
        // Trigger a moveend event to reload legs with new filter
        console.log('[CrewBrowseMap] Triggering reload due to filter change');
        map.current.fire('moveend');
      } else if (retryCount < maxRetries) {
        // If map not ready yet, retry after a short delay
        retryCount++;
        setTimeout(attemptReload, 200);
      } else {
        console.warn('[CrewBrowseMap] Map not ready after max retries, reload may not happen');
      }
    };
    
    // Start the reload process
    setTimeout(attemptReload, 100);
  }, []);

  // Listen for custom filter update event
  useEffect(() => {
    const handleFiltersUpdated = () => {
      console.log('[CrewBrowseMap] Received filtersUpdated event');
      triggerDataReload();
    };

    window.addEventListener('filtersUpdated', handleFiltersUpdated);
    return () => {
      window.removeEventListener('filtersUpdated', handleFiltersUpdated);
    };
  }, [triggerDataReload]);

  // Reload legs when filters change or when lastUpdated timestamp changes
  useEffect(() => {
    // Check if location filter is set - if so, the focus effect will handle map movement
    // and trigger the reload after animation completes
    const hasLocationFilter = !!(filters.location?.lat || filters.arrivalLocation?.lat);
    const prevHadLocation = !!(prevLocationRef.current?.departure?.lat || prevLocationRef.current?.arrival?.lat);
    const locationFilterChanged =
      filters.location?.lat !== prevLocationRef.current?.departure?.lat ||
      filters.location?.lng !== prevLocationRef.current?.departure?.lng ||
      filters.arrivalLocation?.lat !== prevLocationRef.current?.arrival?.lat ||
      filters.arrivalLocation?.lng !== prevLocationRef.current?.arrival?.lng;

    console.log('[CrewBrowseMap] Filters changed', {
      experienceLevel: filters.experienceLevel,
      riskLevel: filters.riskLevel,
      location: filters.location,
      arrivalLocation: filters.arrivalLocation,
      dateRange: filters.dateRange,
      lastUpdated,
      hasLocationFilter,
      locationFilterChanged,
    });

    // If location filter is set AND changed, skip reload here
    // The focus effect will handle the map animation and trigger reload after
    if (hasLocationFilter && locationFilterChanged) {
      console.log('[CrewBrowseMap] Skipping reload - focus effect will handle location change');
      return;
    }

    // If location was cleared, or other filters changed, trigger reload
    triggerDataReload();
  }, [filters.experienceLevel, filters.riskLevel, filters.location, filters.arrivalLocation, filters.dateRange, lastUpdated, triggerDataReload]);

  // Focus map on location filter bounding box when location filters change
  // Priority: departure location > arrival location (if both set, focus on departure)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Check if location filters actually changed (not just other filters)
    const prevDeparture = prevLocationRef.current?.departure;
    const prevArrival = prevLocationRef.current?.arrival;
    const departureChanged = filters.location?.lat !== prevDeparture?.lat || filters.location?.lng !== prevDeparture?.lng;
    const arrivalChanged = filters.arrivalLocation?.lat !== prevArrival?.lat || filters.arrivalLocation?.lng !== prevArrival?.lng;

    // Update ref for next comparison
    prevLocationRef.current = { departure: filters.location, arrival: filters.arrivalLocation };

    // Only focus if location actually changed
    if (!departureChanged && !arrivalChanged) return;

    // Determine which location to focus on
    // If departure is set, always focus on departure (even if arrival is also set)
    // If only arrival is set, focus on arrival
    const focusLocation = filters.location || filters.arrivalLocation;

    if (!focusLocation?.lat || !focusLocation?.lng) return;

    // Use predefined bbox for cruising regions, otherwise calculate from center point
    let bounds: mapboxgl.LngLatBounds;
    const isCruisingRegion = !!focusLocation.bbox;

    if (focusLocation.bbox) {
      // Cruising region with predefined bounding box - use it directly
      bounds = new mapboxgl.LngLatBounds(
        [focusLocation.bbox.minLng, focusLocation.bbox.minLat],
        [focusLocation.bbox.maxLng, focusLocation.bbox.maxLat]
      );
    } else {
      // Regular location - calculate bbox from center with margin
      const LOCATION_MARGIN_DEGREES = 1.0; // ~111km margin
      bounds = new mapboxgl.LngLatBounds(
        [focusLocation.lng - LOCATION_MARGIN_DEGREES, focusLocation.lat - LOCATION_MARGIN_DEGREES],
        [focusLocation.lng + LOCATION_MARGIN_DEGREES, focusLocation.lat + LOCATION_MARGIN_DEGREES]
      );
    }

    const locationName = filters.location ? 'departure' : 'arrival';
    console.log(`[CrewBrowseMap] Focusing map on ${locationName} location:`, {
      ...focusLocation,
      isCruisingRegion,
      bounds: bounds.toArray(),
    });

    // Set flag to prevent filter change effect from triggering premature data reload
    isLocationFocusingRef.current = true;

    // Fit map to the bounding box with padding for UI elements
    // For cruising regions, use larger padding to ensure the whole region is visible
    const isMobile = window.innerWidth < 768;
    const animationDuration = 1500;

    map.current.fitBounds(bounds, {
      padding: isMobile
        ? { top: 60, bottom: 200, left: 40, right: 40 } // Mobile: account for bottom sheet
        : { top: 60, bottom: 60, left: 460, right: 60 }, // Desktop: account for left pane (400px + buffer)
      duration: animationDuration,
      maxZoom: isCruisingRegion ? 8 : 10, // Lower max zoom for large cruising regions
    });

    // After animation completes, clear flag and trigger data reload for new viewport
    // Wait a bit longer (500ms) after animation to let map settle and avoid debounce conflicts
    setTimeout(() => {
      console.log('[CrewBrowseMap] Location focus animation complete, triggering reload', {
        mapExists: !!map.current,
        mapLoaded: mapLoadedRef.current,
        isLoading: isLoadingRef.current,
      });

      isLocationFocusingRef.current = false;
      lastLoadedBoundsRef.current = null;

      // Reset loading state in case it got stuck
      isLoadingRef.current = false;

      // Clear any pending debounce timers to avoid conflicts
      if (viewportDebounceTimerRef.current) {
        clearTimeout(viewportDebounceTimerRef.current);
        viewportDebounceTimerRef.current = null;
      }

      // Directly trigger reload
      triggerDataReload();
    }, animationDuration + 500); // Wait 500ms after animation to let map settle

  }, [filters.location, filters.arrivalLocation, mapLoaded, triggerDataReload]);

  // Handle initialLegId - fetch and select the leg when provided or changed
  useEffect(() => {
    // Skip if no initialLegId
    if (!initialLegId) return;

    // Skip if we already processed this exact legId
    if (initialLegIdProcessedRef.current === initialLegId) return;

    // Wait for map to be ready
    if (!mapLoaded) return;

    const fetchAndSelectLeg = async () => {
      // Track which legId we're processing (not just boolean)
      initialLegIdProcessedRef.current = initialLegId;
      console.log('[CrewBrowseMap] Fetching initial leg:', initialLegId);

      try {
        // Fetch leg details from API - now returns data in Leg format directly
        const response = await fetch(`/api/legs/${initialLegId}`);
        if (!response.ok) {
          console.error('[CrewBrowseMap] Failed to fetch initial leg:', response.status);
          return;
        }

        const legData = await response.json();
        console.log('[CrewBrowseMap] Initial leg data received:', legData);

        if (!legData) return;

        // Calculate match percentage and experience level match
        const experienceMatches = checkExperienceLevelMatch(
          userExperienceLevelRef.current,
          legData.min_experience_level
        );

        const matchPercentage = calculateMatchPercentage(
          userSkillsRef.current,
          legData.skills || [],
          userRiskLevelRef.current as string[] | null,
          legData.leg_risk_level as string | null,
          legData.journey_risk_level as string[] | null || [],
          userExperienceLevelRef.current,
          legData.min_experience_level
        );

        // API now returns data in the correct Leg format
        const leg: Leg = {
          leg_id: legData.leg_id,
          leg_name: legData.leg_name,
          leg_description: legData.leg_description,
          journey_id: legData.journey_id,
          journey_name: legData.journey_name,
          start_date: legData.start_date,
          end_date: legData.end_date,
          crew_needed: legData.crew_needed,
          leg_risk_level: legData.leg_risk_level,
          journey_risk_level: legData.journey_risk_level,
          cost_model: legData.cost_model || null,
          journey_images: legData.journey_images || [],
          skills: legData.skills || [],
          boat_id: legData.boat_id,
          boat_name: legData.boat_name,
          boat_type: legData.boat_type,
          boat_image_url: legData.boat_image_url,
          boat_average_speed_knots: legData.boat_average_speed_knots,
          boat_make: legData.boat_make,
          boat_model: legData.boat_model,
          owner_name: legData.owner_name,
          owner_image_url: legData.owner_image_url,
          min_experience_level: legData.min_experience_level,
          start_waypoint: legData.start_waypoint,
          end_waypoint: legData.end_waypoint,
          skill_match_percentage: matchPercentage,
          experience_level_matches: experienceMatches,
        };

        // Set the selected leg
        setSelectedLeg(leg);

        // Show MobileLegCard on mobile when leg is pre-selected via URL
        setShowMobileLegCard(true);

        // Fetch waypoints for the route display
        const waypointsResponse = await fetch(`/api/legs/${initialLegId}/waypoints`);
        if (waypointsResponse.ok) {
          const waypointsData = await waypointsResponse.json();
          setLegWaypoints(waypointsData.waypoints || []);
        }

        // Fly to the leg location if we have coordinates
        if (leg.start_waypoint && map.current) {
          map.current.flyTo({
            center: [leg.start_waypoint.lng, leg.start_waypoint.lat],
            zoom: 8,
            duration: 1500,
          });
        }
      } catch (error) {
        console.error('[CrewBrowseMap] Error fetching initial leg:', error);
      }
    };

    fetchAndSelectLeg();
  }, [initialLegId, mapLoaded]);

  // Update GeoJSON source when legs change
  useEffect(() => {
    if (!map.current || !mapLoaded || !sourceAddedRef.current) return;

    // Determine which waypoint to show based on filters:
    // - If only arrival location is set (no departure), show end waypoints
    // - Otherwise, show start waypoints
    const showEndWaypoints = !filters.location && !!filters.arrivalLocation;

    // Separate approved legs from others to prevent clustering
    const approvedLegIds = new Set(
      Array.from(userRegistrations.entries())
        .filter(([_, status]) => status === 'Approved')
        .map(([legId]) => legId)
    );

    // Convert legs to GeoJSON format, excluding approved legs from clustering source
    // When no user is logged in, don't include match data (markers will be dark blue)
    const hasUser = !!user;
    const features = legs
      .filter(leg => {
        const waypoint = showEndWaypoints ? leg.end_waypoint : leg.start_waypoint;
        return waypoint !== null && !approvedLegIds.has(leg.leg_id);
      })
      .map(leg => {
        const waypoint = showEndWaypoints ? leg.end_waypoint! : leg.start_waypoint!;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [waypoint.lng, waypoint.lat],
          },
          properties: {
            leg_id: leg.leg_id,
            has_user: hasUser, // Whether a user is logged in
            match_percentage: hasUser ? (leg.skill_match_percentage ?? 100) : null, // null when no user
            experience_matches: hasUser ? (leg.experience_level_matches ?? true) : null, // null when no user
            registration_status: userRegistrations.get(leg.leg_id) || null, // 'Pending approval', or null (Approved excluded)
          },
        };
      });

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
      .filter(leg => {
        const waypoint = showEndWaypoints ? leg.end_waypoint : leg.start_waypoint;
        return waypoint !== null && approvedLegIds.has(leg.leg_id);
      })
      .map(leg => {
        const waypoint = showEndWaypoints ? leg.end_waypoint! : leg.start_waypoint!;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [waypoint.lng, waypoint.lat],
          },
          properties: {
            leg_id: leg.leg_id,
            has_user: hasUser, // Whether a user is logged in
            match_percentage: hasUser ? (leg.skill_match_percentage ?? 100) : null,
            experience_matches: hasUser ? (leg.experience_level_matches ?? true) : null,
            registration_status: 'Approved' as const,
          },
        };
      });

    const approvedGeoJsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: approvedFeatures,
    };

    const approvedSource = map.current.getSource('approved-legs-source') as mapboxgl.GeoJSONSource;
    if (approvedSource) {
      approvedSource.setData(approvedGeoJsonData);
    }
  }, [legs, mapLoaded, userRegistrations, filters.location, filters.arrivalLocation, user]);

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
      console.error('MAPBOX_ACCESS_TOKEN is not set. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file');
      return;
    }

    mapboxgl.accessToken = accessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle, // Less colorful, muted style
      center: initialCenter,
      zoom: initialZoom,
      projection: 'mercator', // Use 2D Mercator projection instead of globe view
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
          console.log('[CrewBrowseMap] Debounced handler starting', {
            hasMap: !!map.current,
            isLoading: isLoadingRef.current,
            lastLoadedBounds: lastLoadedBoundsRef.current,
          });

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
            // If lastLoadedBoundsRef is null, it means filters changed and we should force reload
            const newBounds = { minLng, minLat, maxLng, maxLat };
            if (lastLoadedBoundsRef.current !== null && !hasViewportChangedSignificantly(newBounds, lastLoadedBoundsRef.current)) {
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

            // Use filters from ref to ensure we always have the latest values
            const currentFilters = filtersRef.current;
            
            // Add experience level filter if set
            if (currentFilters.experienceLevel !== null) {
              params.append('min_experience_level', currentFilters.experienceLevel.toString());
            }

            // Add risk level filter if set (multi-select)
            if (currentFilters.riskLevel && currentFilters.riskLevel.length > 0) {
              params.append('risk_levels', currentFilters.riskLevel.join(','));
            }

            // Add date range filter if set
            if (currentFilters.dateRange.start) {
              params.append('start_date', currentFilters.dateRange.start.toISOString().split('T')[0]);
            }
            if (currentFilters.dateRange.end) {
              params.append('end_date', currentFilters.dateRange.end.toISOString().split('T')[0]);
            }

            // Add departure location filter if set
            // Use direct bbox for cruising regions, center point for regular locations
            if (currentFilters.location?.lat && currentFilters.location?.lng) {
              if (currentFilters.location.bbox) {
                // Cruising region with predefined bounding box
                params.append('departure_min_lng', currentFilters.location.bbox.minLng.toString());
                params.append('departure_min_lat', currentFilters.location.bbox.minLat.toString());
                params.append('departure_max_lng', currentFilters.location.bbox.maxLng.toString());
                params.append('departure_max_lat', currentFilters.location.bbox.maxLat.toString());
              } else {
                // Regular location - API will calculate bbox from center
                params.append('departure_lat', currentFilters.location.lat.toString());
                params.append('departure_lng', currentFilters.location.lng.toString());
              }
            }

            // Add arrival location filter if set
            // Use direct bbox for cruising regions, center point for regular locations
            if (currentFilters.arrivalLocation?.lat && currentFilters.arrivalLocation?.lng) {
              if (currentFilters.arrivalLocation.bbox) {
                // Cruising region with predefined bounding box
                params.append('arrival_min_lng', currentFilters.arrivalLocation.bbox.minLng.toString());
                params.append('arrival_min_lat', currentFilters.arrivalLocation.bbox.minLat.toString());
                params.append('arrival_max_lng', currentFilters.arrivalLocation.bbox.maxLng.toString());
                params.append('arrival_max_lat', currentFilters.arrivalLocation.bbox.maxLat.toString());
              } else {
                // Regular location - API will calculate bbox from center
                params.append('arrival_lat', currentFilters.arrivalLocation.lat.toString());
                params.append('arrival_lng', currentFilters.arrivalLocation.lng.toString());
              }
            }

            // Note: We no longer filter by skills in the API
            // Instead, we fetch all legs and filter by match percentage on the frontend
            // This allows us to show match percentages for all legs
            console.log('[CrewBrowseMap] Fetching legs with filters:', {
              experienceLevel: currentFilters.experienceLevel,
              riskLevel: currentFilters.riskLevel,
              dateRange: currentFilters.dateRange,
              departureLocation: currentFilters.location,
              arrivalLocation: currentFilters.arrivalLocation,
            });

            const url = `/api/legs/viewport?${params.toString()}`;
            console.log('[CrewBrowseMap] Fetching from URL:', url);
            console.log('[CrewBrowseMap] All params:', Object.fromEntries(params.entries()));

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
                userRiskLevelRef.current as string[] | null,
                leg.leg_risk_level as string | null,
                leg.journey_risk_level as string[] | null || [],
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

      // Fit to initial bounds if provided (e.g., from cruising region link)
      if (initialBounds) {
        map.current.fitBounds(
          [
            [initialBounds.minLng, initialBounds.minLat],
            [initialBounds.maxLng, initialBounds.maxLat],
          ],
          { padding: 50, duration: 0 }
        );
      }

      // Set cursor to default pointer
      if (map.current.getCanvasContainer()) {
        map.current.getCanvasContainer().style.cursor = 'default';
      }

      // Load custom pin marker icons for registered legs
      if (!iconsLoadedRef.current && map.current) {
        try {

          map.current.loadImage('/marker_approved_tp.png',(error, image) => {
            if (error) {
              console.error('[CrewBrowseMap] Error loading marker_approved.png:', error);
            } else {
              map.current?.addImage?.('marker-approved', image as any);
              console.log('[CrewBrowseMap] Approved icon loaded:', image);
            }
          });

          map.current.loadImage('/marker_pending.png',(error, image) => {
            if (error) {
              console.error('[CrewBrowseMap] Error loading marker_pending.png:', error);
            } else {
              map.current?.addImage?.('marker-pending', image as any);
              console.log('[CrewBrowseMap] Pending icon loaded:', image);
            }
          });

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
        clusterMinPoints: 2, // Only cluster if there are more than 4 waypoints (5 or more)
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
          'circle-color': '#0E1D34',
          /*
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#264E8C', //'#d1d5db', // Light gray for small clusters
            5,
            '#173057', // Medium gray for medium clusters
            10,
            '#0E1D34', // Darker gray for large clusters
          ],*/
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
          'icon-image': 'marker-approved',
          'icon-size': 0.09, // Pin marker size
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
        },
      });
      // Add approved text layer
      map.current.addLayer({
        id: 'registered-approved-text',
        type: 'symbol',
        source: 'approved-legs-source', // Use separate non-clustered source
        layout: {
          'text-field': 'Approved',
          'text-font': ['Open Sans Bold'],          // fixed text
          'text-size': 12,
          'text-offset': [0, -4.5],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': approvedTextColor, // green text
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
        /*
        paint: {
          'circle-color': pendingTextColor,
          'circle-radius': pendingIconSize,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },*/
        layout: {
          'icon-image': 'marker-pending',
          'icon-size': 0.09, // Pin marker size
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
        },
      });

      // Add pending text
      map.current.addLayer({
        id: 'registered-pending-text',
        type: 'symbol',
        source: 'legs-source', // Use separate non-clustered source
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['==', ['get', 'registration_status'], 'Pending approval'],
        ],
        layout: {
          'text-field': 'Pending approval',
          'text-font': ['Open Sans Bold'],          // fixed text
          'text-size': 12,
          'text-offset': [0, -4.5],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': pendingTextColor, 
        },
      });


      // Add unclustered point layer (individual leg markers for non-registered legs)
      // When user is logged in: Color based on match percentage: green (80+), yellow (50-79), orange (25-49), red (<25)
      // When no user logged in: Use brand dark blue (#22276E) for all markers
      // Always show red if experience level doesn't match (only when user is logged in)
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
            // When no user is logged in, use brand dark blue
            ['==', ['get', 'has_user'], false],
            '#22276E', // brand dark blue
            ['==', ['get', 'experience_matches'], false],
            '#ef4444', // red-500 - always red if experience level doesn't match
            ['>=', ['get', 'match_percentage'], 80],
            '#22c55e', // green-500
            ['>=', ['get', 'match_percentage'], 50],
            '#fde047', // yellow-500
            ['>=', ['get', 'match_percentage'], 25],
            '#fdba74', // orange-500
            '#ef4444', // red-500
          ],
          'circle-radius': [
            'case',
            // When no user is logged in, use consistent size
            ['==', ['get', 'has_user'], false],
            10, // brand dark blue size
            ['==', ['get', 'experience_matches'], false],
            10, // red always small
            ['>=', ['get', 'match_percentage'], 80],
            12, // green-500
            ['>=', ['get', 'match_percentage'], 50],
            10, // yellow-500
            ['>=', ['get', 'match_percentage'], 25],
            10, // orange-500
            10, // red-500
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            // When no user is logged in, use white stroke for visibility in dark mode
            ['==', ['get', 'has_user'], false],
            '#ffffff', // white stroke for dark blue markers
            ['==', ['get', 'experience_matches'], false],
            '#dc2626', // red-500 - always red if experience level doesn't match
            ['>=', ['get', 'match_percentage'], 80],
            '#16a34a', // green-500
            ['>=', ['get', 'match_percentage'], 50],
            '#ca8a04', // yellow-500
            ['>=', ['get', 'match_percentage'], 25],
            '#ea580c', // orange-500
            '#dc2626', // red-500
          ],
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
          console.log('[CrewBrowseMap] Marker clicked, legId:', legId);

          // Clear previous selection first to prevent focusing on old leg
          setSelectedLeg(null);
          setLegWaypoints([]);
          setShowFullPanelOnMobile(false);
          setShowMobileLegCard(true); // Show MobileLegCard when marker is clicked on mobile

          // Small delay to ensure state is cleared
          await new Promise(resolve => setTimeout(resolve, 50));

          // Find the leg in our legs map first (cached data)
          let leg = legsMapRef.current.get(legId);

          // If not found in cache, fetch from API
          if (!leg) {
            console.log('[CrewBrowseMap] Leg not in cache, fetching from API:', legId);
            try {
              const response = await fetch(`/api/legs/${legId}`);
              if (response.ok) {
                const legData = await response.json();

                // Calculate match percentage and experience level match
                const experienceMatches = checkExperienceLevelMatch(
                  userExperienceLevelRef.current,
                  legData.min_experience_level
                );

                const matchPercentage = calculateMatchPercentage(
                  userSkillsRef.current,
                  legData.skills || [],
                  userRiskLevelRef.current as string[] | null,
                  legData.leg_risk_level as string | null,
                  legData.journey_risk_level as string[] | null || [],
                  userExperienceLevelRef.current,
                  legData.min_experience_level
                );

                // API returns data in Leg format
                leg = {
                  leg_id: legData.leg_id,
                  leg_name: legData.leg_name,
                  leg_description: legData.leg_description,
                  journey_id: legData.journey_id,
                  journey_name: legData.journey_name,
                  start_date: legData.start_date,
                  end_date: legData.end_date,
                  crew_needed: legData.crew_needed,
                  leg_risk_level: legData.leg_risk_level,
                  journey_risk_level: legData.journey_risk_level,
                  cost_model: legData.cost_model || null,
                  journey_images: legData.journey_images || [],
                  skills: legData.skills || [],
                  boat_id: legData.boat_id,
                  boat_name: legData.boat_name,
                  boat_type: legData.boat_type,
                  boat_image_url: legData.boat_image_url,
                  boat_average_speed_knots: legData.boat_average_speed_knots,
                  boat_make: legData.boat_make,
                  boat_model: legData.boat_model,
                  owner_name: legData.owner_name,
                  owner_image_url: legData.owner_image_url,
                  min_experience_level: legData.min_experience_level,
                  start_waypoint: legData.start_waypoint,
                  end_waypoint: legData.end_waypoint,
                  skill_match_percentage: matchPercentage,
                  experience_level_matches: experienceMatches,
                };
              } else {
                console.error('[CrewBrowseMap] Failed to fetch leg from API:', response.status);
                return;
              }
            } catch (error) {
              console.error('[CrewBrowseMap] Error fetching leg from API:', error);
              return;
            }
          }

          if (leg) {
            console.log('[CrewBrowseMap] Leg selected:', legId);

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
      /*
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
*/
      map.current.on('mouseenter', 'unclustered-point', handleMouseEnter);
      map.current.on('mouseleave', 'unclustered-point', handleMouseLeave);
      map.current.on('mouseenter', 'registered-approved', handleMouseEnter);
      map.current.on('mouseleave', 'registered-approved', handleMouseLeave);
      map.current.on('mouseenter', 'registered-pending', handleMouseEnter);
      map.current.on('mouseleave', 'registered-pending', handleMouseLeave);

      sourceAddedRef.current = true;
      
      // Add route source for leg routes (initially empty)
      map.current.addSource('leg-route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Add route line layer
      map.current.addLayer({
        id: 'leg-route-line',
        type: 'line',
        source: 'leg-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#A3A3A3',
          'line-width': 2,
          'line-opacity': 0.9,
          'line-dasharray': [2, 2],
          // Note: Mapbox doesn't support true gradients, but we can use a gradient-like effect
          // by using line-gradient with a color expression, or use multiple layers
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
          if (map.current.getLayer('registered-approved-text')) {
            map.current.removeLayer('registered-approved-text');
          }
          if (map.current.getLayer('registered-pending-text')) {
            map.current.removeLayer('registered-pending-text');
          }

          if (map.current.getLayer('leg-route-line')) {
            map.current.removeLayer('leg-route-line');
          }
          // Remove icons
          if (map.current.hasImage('marker-approved')) {
            map.current.removeImage('marker-approved');
          }
          if (map.current.hasImage('marker-pending')) {
            map.current.removeImage('marker-pending');
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

    const routeSource = map.current.getSource('leg-route-source') as mapboxgl.GeoJSONSource;
    if (!routeSource) return;

    // Always clear previous route first
    routeSource.setData({
      type: 'FeatureCollection',
      features: [],
    });

    if (!selectedLeg || legWaypoints.length === 0) {
      console.log('[CrewBrowseMap] Route display skipped - no leg or waypoints');
      return;
    }

    const validWaypoints = legWaypoints
      .filter(wp => wp.coordinates !== null)
      .sort((a, b) => a.index - b.index);
    console.log('[CrewBrowseMap] Valid waypoints:', validWaypoints.length, 'out of', legWaypoints.length);
    
    if (validWaypoints.length < 2) {
      console.log('[CrewBrowseMap] Route display skipped - need at least 2 waypoints');
      return; // Need at least start and end
    }

    const coordinates = validWaypoints.map(wp => wp.coordinates!);
    console.log('[CrewBrowseMap] Creating route with coordinates:', coordinates);

    const isApproved = userRegistrations.get(selectedLeg.leg_id) === 'Approved';

    // Use splitLineAtAntimeridian to handle routes crossing the 180° longitude
    const geometry = splitLineAtAntimeridian(coordinates);
    const routeFeature: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString> = {
      type: 'Feature',
      geometry,
      properties: {},
    };

    routeSource.setData({
      type: 'FeatureCollection',
      features: [routeFeature],
    });

    // Optional: different style based on approval status
    map.current.setPaintProperty('leg-route-line', 'line-color', isApproved ? '#01B000' : '#A3A3A3');
    map.current.setPaintProperty('leg-route-line', 'line-width', isApproved ? 4 : 2);
    map.current.setPaintProperty('leg-route-line', 'line-opacity', 0.9);
    map.current.setPaintProperty('leg-route-line', 'line-dasharray', isApproved ? [1, 0] : [2, 2]); // Solid if approved, dashed otherwise

    // Calculate bounds to fit entire route (handles antimeridian crossing)
    const calculatedBounds = calculateBoundsWithAntimeridian(coordinates);
    if (!calculatedBounds) {
      console.log('[CrewBrowseMap] Could not calculate bounds');
      return;
    }

    const [[minLng, minLat], [maxLng, maxLat]] = calculatedBounds;

    // Add padding
    const padding = 0.1; // 10% padding
    const lngDiff = Math.abs(maxLng - minLng);
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

    // Fit map to bounds with asymmetric padding to account for UI overlays
    // Mobile: Large bottom padding for MobileLegCard (~350px card height + margin)
    // Desktop: Large left padding for detail pane (400px + buffer)
    const isMobile = window.innerWidth < 768;
    map.current.fitBounds(bounds, {
      padding: isMobile
        ? { top: 50, bottom: 380, left: 30, right: 30 } // Mobile: large bottom padding for MobileLegCard
        : { top: 50, bottom: 50, left: 450, right: 50 }, // Desktop: 400px pane + 50px buffer on left
      duration: 1000,
      maxZoom: 12, // Don't zoom in too much
      essential: true, // This is essential, don't interrupt
    });

    // Reset flag after animation completes
    setTimeout(() => {
      isFittingBoundsRef.current = false;
    }, 1100); // Slightly longer than animation duration
  }, [selectedLeg, legWaypoints, mapLoaded, userRegistrations]);

  // Effect to update visible bounds when map moves or UI state changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Debounce timer ref for map move events
    let boundsDebounceTimer: NodeJS.Timeout | null = null;

    const debouncedUpdateBounds = () => {
      if (boundsDebounceTimer) {
        clearTimeout(boundsDebounceTimer);
      }
      boundsDebounceTimer = setTimeout(() => {
        updateVisibleBounds();
      }, 150); // 150ms debounce for smooth performance
    };

    // Attach event listeners
    map.current.on('moveend', debouncedUpdateBounds);
    map.current.on('zoomend', debouncedUpdateBounds);

    // Initial update
    updateVisibleBounds();

    return () => {
      if (boundsDebounceTimer) {
        clearTimeout(boundsDebounceTimer);
      }
      if (map.current) {
        map.current.off('moveend', debouncedUpdateBounds);
        map.current.off('zoomend', debouncedUpdateBounds);
      }
    };
  }, [mapLoaded, updateVisibleBounds]);

  // Effect to update visible bounds when UI state changes
  useEffect(() => {
    // Update bounds when pane state changes (desktop only, mobile uses full screen)
    updateVisibleBounds();
  }, [isLegsPaneMinimized, selectedLeg, updateVisibleBounds]);

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

      {/* Mobile: Bottom Sheet with Leg List (shows when not in full panel mode and MobileLegCard is not shown) */}
      {!showFullPanelOnMobile && !showMobileLegCard && legs.length > 0 && (
        <BottomSheet
          isOpen={true}
          defaultSnapPoint="collapsed"
          onSnapPointChange={setBottomSheetSnapPoint}
          collapsedHeight={80}
          halfHeight="50vh"
          expandedHeight="calc(100vh - 4rem)"
          headerContent={
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                {visibleLegs.length} Leg{visibleLegs.length !== 1 ? 's' : ''} in View
              </span>
              {selectedLeg && (
                <button
                  onClick={() => {
                    setSelectedLeg(null);
                    setLegWaypoints([]);
                  }}
                  className="text-sm text-primary hover:underline cursor-pointer"
                >
                  Clear selection
                </button>
              )}
            </div>
          }
        >
          <LegList
            legs={visibleLegs}
            onLegClick={async (leg) => {
              // Find the full leg data and select it with waypoints
              const fullLeg = legs.find(l => l.leg_id === leg.leg_id);
              if (fullLeg) {
                await selectLegWithWaypoints(fullLeg);
                setShowFullPanelOnMobile(true);
              }
            }}
            sortByMatch={!!user} // Only sort by match when user is logged in
            displayOptions={{
              showCarousel: bottomSheetSnapPoint !== 'collapsed', // Hide carousel when collapsed
              showMatchBadge: !!user, // Only show match badge when user is logged in
              showLegName: true,
              showJourneyName: true,
              showLocations: true,
              showDates: bottomSheetSnapPoint !== 'collapsed', // Hide dates when collapsed
              showDuration: bottomSheetSnapPoint !== 'collapsed', // Hide duration when collapsed
              carouselHeight: 'h-32',
              compact: bottomSheetSnapPoint === 'collapsed', // Use compact mode when collapsed
            }}
            gap="md"
          />
        </BottomSheet>
      )}

      {/* Mobile: Single Leg Card (when a leg is selected from map marker click) */}
      {selectedLeg && showMobileLegCard && !showFullPanelOnMobile && (
        <LegMobileCard
          leg={selectedLeg}
          onClose={() => {
            setSelectedLeg(null);
            setLegWaypoints([]);
            setShowMobileLegCard(false); // Show bottom sheet again when closing
          }}
          onClick={() => {
            // Open full panel on mobile when card is clicked
            setShowFullPanelOnMobile(true);
            setShowMobileLegCard(false);
          }}
        />
      )}

      {/* Mobile: Full screen panel */}
      {selectedLeg && showFullPanelOnMobile && (
        <div className="md:hidden">
          <LegDetailsPanel
            leg={selectedLeg}
            isOpen={true}
            onClose={() => {
              setShowFullPanelOnMobile(false);
              setSelectedLeg(null);
              setLegWaypoints([]);
            }}
            userSkills={userSkills}
            userRiskLevel={userRiskLevel}
            userExperienceLevel={userExperienceLevel}
            onRegistrationChange={() => {
              // Could refresh data or show notification here
              console.log('Registration status changed');
            }}
            initialOpenRegistration={initialOpenRegistration}
          />
        </div>
      )}

      {/* Desktop: Left Side Pane with Leg List (hidden when detail panel is open) */}
      <LegBrowsePane
        legs={visibleLegs}
        isVisible={!selectedLeg}
        isLoading={loading}
        onLegSelect={async (leg) => {
          // When selecting from the list, select with waypoints to show route
          await selectLegWithWaypoints(leg as Leg);
        }}
        onMinimizeChange={setIsLegsPaneMinimized}
        showMatchBadge={!!user} // Only show match badges when user is logged in
      />

      {/* Desktop: Side panel for selected leg details */}
      {selectedLeg && (
        <div className="hidden md:block">
          <LegDetailsPanel
            leg={selectedLeg}
            isOpen={!!selectedLeg}
            onClose={() => {
              setSelectedLeg(null);
              setLegWaypoints([]);
            }}
            userRiskLevel={userRiskLevel}
            userSkills={userSkills}
            userExperienceLevel={userExperienceLevel}
            onRegistrationChange={() => {
              // Could refresh data or show notification here
              console.log('Registration status changed');
            }}
            initialOpenRegistration={initialOpenRegistration}
          />
        </div>
      )}
    </div>
  );
}


