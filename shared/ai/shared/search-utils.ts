/**
 * Shared Search Utilities
 *
 * Common utilities for searching legs with geographic and other filters.
 * Used by both assistant and prospect chat services.
 */

import { logger } from '@shared/logging';
import { SupabaseClient } from '@supabase/supabase-js';
import { BoundingBox, isValidBbox, isPointInBbox, extractCoordinates, describeBbox } from './bbox-utils';
import { RawLeg, transformLeg, TransformedLeg, formatLegForAI, FormattedLegForAI } from './leg-utils';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[Search Utils] ${message}`, data !== undefined ? (data as Record<string, any>) : undefined);
  }
};

/**
 * Search options for leg queries
 */
export interface LegSearchOptions {
  // Date filters
  startDate?: string;
  endDate?: string;
  // Location filters
  departureBbox?: BoundingBox;
  arrivalBbox?: BoundingBox;
  departureDescription?: string;
  arrivalDescription?: string;
  locationQuery?: string; // Text-based location filter
  // Other filters
  riskLevel?: string;
  riskLevels?: string; // Comma-separated
  minExperienceLevel?: number;
  skillsRequired?: string; // Comma-separated
  boatType?: string;
  makeModel?: string;
  crewNeeded?: boolean; // Default true - filter to legs needing crew
  // Pagination
  limit?: number;
}

/**
 * Information about legs that exist spatially but were filtered out by dates
 */
export interface DateAvailabilityInfo {
  spatialMatchCount: number;
  earliestDate: string;
  latestDate: string;
  searchedStartDate: string;
  searchedEndDate: string;
}

/**
 * Search result with metadata
 */
export interface LegSearchResult {
  legs: FormattedLegForAI[];
  count: number;
  searchedDeparture?: string;
  searchedArrival?: string;
  departureArea?: string;
  arrivalArea?: string;
  message?: string;
  dateAvailability?: DateAvailabilityInfo; // Info about legs filtered out by dates
}

/**
 * Base query for published legs with optional filters
 */
export async function searchPublishedLegs(
  supabase: SupabaseClient,
  options: LegSearchOptions = {}
): Promise<LegSearchResult> {
  const limit = options.limit || 10;

  // Build base query
  let query = supabase
    .from('legs')
    .select(`
      id,
      name,
      description,
      start_date,
      end_date,
      crew_needed,
      skills,
      risk_level,
      min_experience_level,
      journeys!inner (
        id,
        name,
        state,
        skills,
        risk_level,
        min_experience_level,
        images,
        boats (
          id,
          name,
          make_model,
          type,
          images
        )
      ),
      waypoints (
        index,
        name,
        location
      )
    `)
    .eq('journeys.state', 'Published')
    .order('start_date', { ascending: true });

  // Apply date filters
  if (options.startDate) {
    query = query.gte('start_date', options.startDate);
  }
  if (options.endDate) {
    query = query.lte('end_date', options.endDate);
  }

  // Apply risk level filter
  if (options.riskLevel) {
    query = query.eq('risk_level', options.riskLevel);
  }

  // Apply experience level filter
  if (options.minExperienceLevel) {
    query = query.lte('min_experience_level', options.minExperienceLevel);
  }

  // Apply boat type filter
  if (options.boatType) {
    query = query.eq('journeys.boats.type', options.boatType);
  }

  // Apply make/model filter
  if (options.makeModel) {
    query = query.ilike('journeys.boats.make_model', `%${options.makeModel}%`);
  }

  // Apply limit (fetch more than needed for post-filtering)
  const fetchLimit = Math.max(limit * 3, 50);
  query = query.limit(fetchLimit);

  const { data, error } = await query;

  if (error) {
    log('Search query error:', error);
    throw error;
  }

  // Cast data to RawLeg[] - the type is compatible due to flexible RawLeg definition
  let legs = (data || []) as unknown as RawLeg[];

  // Filter by crew_needed (default true)
  if (options.crewNeeded !== false) {
    legs = legs.filter((leg) => (leg.crew_needed || 0) > 0);
  }

  // Format legs for AI response
  let formattedLegs = legs.map(formatLegForAI);

  // Apply text-based location filter
  if (options.locationQuery) {
    const locationLower = options.locationQuery.toLowerCase();
    formattedLegs = formattedLegs.filter((leg) => {
      const departure = (leg.departureLocation || '').toLowerCase();
      const arrival = (leg.arrivalLocation || '').toLowerCase();
      const journeyName = (leg.journeyName || '').toLowerCase();
      const legName = (leg.name || '').toLowerCase();
      return (
        departure.includes(locationLower) ||
        arrival.includes(locationLower) ||
        journeyName.includes(locationLower) ||
        legName.includes(locationLower)
      );
    });
    log(`Location filter "${options.locationQuery}": ${legs.length} -> ${formattedLegs.length} legs`);
  }

  // Apply limit
  formattedLegs = formattedLegs.slice(0, limit);

  return {
    legs: formattedLegs,
    count: formattedLegs.length,
  };
}

/**
 * Helper function to get date range info for legs that exist in an area
 * Used to inform users about when legs are available if their dates don't match
 */
async function getLegsDateRange(
  supabase: SupabaseClient,
  legIds: string[]
): Promise<{ earliestDate: string; latestDate: string; count: number } | null> {
  if (legIds.length === 0) return null;

  const { data, error } = await supabase
    .from('legs')
    .select('start_date, end_date, crew_needed, journeys!inner(state)')
    .in('id', legIds)
    .eq('journeys.state', 'Published')
    .gt('crew_needed', 0)
    .order('start_date', { ascending: true });

  if (error || !data || data.length === 0) {
    log('getLegsDateRange error or no data:', error?.message);
    return null;
  }

  const dates = data
    .filter((leg) => leg.start_date)
    .map((leg) => ({
      start: new Date(leg.start_date),
      end: leg.end_date ? new Date(leg.end_date) : new Date(leg.start_date),
    }));

  if (dates.length === 0) return null;

  const earliest = dates.reduce((min, d) => (d.start < min ? d.start : min), dates[0].start);
  const latest = dates.reduce((max, d) => (d.end > max ? d.end : max), dates[0].end);

  return {
    earliestDate: earliest.toISOString().split('T')[0],
    latestDate: latest.toISOString().split('T')[0],
    count: data.length,
  };
}

/**
 * Search legs by geographic bounding boxes
 * Uses spatial filtering on waypoint locations
 */
export async function searchLegsByBbox(
  supabase: SupabaseClient,
  options: LegSearchOptions
): Promise<LegSearchResult> {
  const { departureBbox, arrivalBbox, departureDescription, arrivalDescription } = options;
  const limit = options.limit || 10;

  log('searchLegsByBbox called with:', { departureBbox, arrivalBbox });

  if (!departureBbox && !arrivalBbox) {
    throw new Error('At least one of departureBbox or arrivalBbox must be provided');
  }

  // Validate bounding boxes
  if (departureBbox && !isValidBbox(departureBbox)) {
    return {
      legs: [],
      count: 0,
      message: 'Invalid departure bounding box coordinates provided.',
      searchedDeparture: departureDescription,
      searchedArrival: arrivalDescription,
    };
  }

  if (arrivalBbox && !isValidBbox(arrivalBbox)) {
    return {
      legs: [],
      count: 0,
      message: 'Invalid arrival bounding box coordinates provided.',
      searchedDeparture: departureDescription,
      searchedArrival: arrivalDescription,
    };
  }

  log('Using bounding boxes:', {
    departure: departureBbox ? { description: departureDescription, bbox: departureBbox } : null,
    arrival: arrivalBbox ? { description: arrivalDescription, bbox: arrivalBbox } : null,
  });

  // Find matching leg IDs using spatial filter
  const matchingLegIds = await findLegsInBbox(supabase, departureBbox || null, arrivalBbox || null);

  if (matchingLegIds.length === 0) {
    log('No legs matched spatial criteria - check: 1) Published legs exist, 2) Waypoints have valid locations, 3) RPC find_legs_by_location exists and has correct grants');
    return {
      legs: [],
      count: 0,
      message: `No sailing opportunities found ${departureDescription ? `departing from ${departureDescription}` : ''}${departureDescription && arrivalDescription ? ' and ' : ''}${arrivalDescription ? `arriving at ${arrivalDescription}` : ''}.`,
      searchedDeparture: departureDescription,
      searchedArrival: arrivalDescription,
      departureArea: departureBbox ? describeBbox(departureBbox) : undefined,
      arrivalArea: arrivalBbox ? describeBbox(arrivalBbox) : undefined,
    };
  }

  log('Found matching leg IDs:', matchingLegIds.length);

  // Fetch full leg data with all joins
  let query = supabase
    .from('legs')
    .select(`
      id,
      name,
      description,
      start_date,
      end_date,
      crew_needed,
      skills,
      risk_level,
      min_experience_level,
      journeys!inner (
        id,
        name,
        state,
        skills,
        risk_level,
        min_experience_level,
        images,
        boats (
          id,
          name,
          make_model,
          type,
          images
        )
      ),
      waypoints (
        index,
        name
      )
    `)
    .in('id', matchingLegIds)
    .eq('journeys.state', 'Published')
    .order('start_date', { ascending: true });

  // Apply additional filters
  if (options.startDate) {
    query = query.gte('start_date', options.startDate);
  }
  if (options.endDate) {
    query = query.lte('end_date', options.endDate);
  }
  if (options.boatType) {
    query = query.eq('journeys.boats.type', options.boatType);
  }
  if (options.makeModel) {
    query = query.ilike('journeys.boats.make_model', `%${options.makeModel}%`);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    log('Query error:', error);
    throw error;
  }

  // Cast data to RawLeg[] - the type is compatible due to flexible RawLeg definition
  let legs = (data || []) as unknown as RawLeg[];

  // Filter by crew_needed (default true)
  if (options.crewNeeded !== false) {
    legs = legs.filter((leg) => (leg.crew_needed || 0) > 0);
  }

  // Transform and format legs
  const transformedLegs = legs.map((leg) => {
    const transformed = transformLeg(leg);
    return {
      ...formatLegForAI(leg),
      combined_skills: transformed.combined_skills,
      effective_risk_level: transformed.effective_risk_level,
      effective_min_experience_level: transformed.effective_min_experience_level,
    };
  });

  // Apply additional post-query filters
  let filteredLegs = transformedLegs;

  // Filter by skills if specified
  if (options.skillsRequired) {
    const requiredSkills = options.skillsRequired.split(',').map((s) => s.trim().toLowerCase());
    filteredLegs = filteredLegs.filter((leg: any) => {
      const legSkills = (leg.combined_skills || []).map((s: string) => s.toLowerCase());
      return requiredSkills.every((skill) => legSkills.includes(skill));
    });
  }

  // Filter by risk levels if specified
  if (options.riskLevels) {
    const allowedRiskLevels = options.riskLevels.split(',').map((s) => s.trim());
    filteredLegs = filteredLegs.filter((leg: any) => {
      if (!leg.effective_risk_level) return true;
      return allowedRiskLevels.includes(leg.effective_risk_level);
    });
  }

  // Filter by experience level if specified
  if (options.minExperienceLevel) {
    const userExpLevel = options.minExperienceLevel;
    filteredLegs = filteredLegs.filter((leg: any) => {
      if (!leg.effective_min_experience_level) return true;
      return userExpLevel >= leg.effective_min_experience_level;
    });
  }

  // Check if spatial matches were filtered out by dates
  // This helps users understand that legs exist but not in their date range
  let dateAvailability: DateAvailabilityInfo | undefined;
  let message: string | undefined;

  if (filteredLegs.length === 0 && matchingLegIds.length > 0 && (options.startDate || options.endDate)) {
    log('Spatial matches filtered by dates - checking date availability');
    const dateRange = await getLegsDateRange(supabase, matchingLegIds);

    if (dateRange && dateRange.count > 0) {
      const locationDesc = departureDescription || arrivalDescription || 'this area';
      const searchedRange = options.startDate && options.endDate
        ? `${formatDateForDisplay(options.startDate)} to ${formatDateForDisplay(options.endDate)}`
        : options.startDate
        ? `from ${formatDateForDisplay(options.startDate)} onwards`
        : `until ${formatDateForDisplay(options.endDate!)}`;

      const availableRange = dateRange.earliestDate === dateRange.latestDate
        ? formatDateForDisplay(dateRange.earliestDate)
        : `${formatDateForDisplay(dateRange.earliestDate)} to ${formatDateForDisplay(dateRange.latestDate)}`;

      message = `I found ${dateRange.count} sailing ${dateRange.count === 1 ? 'leg' : 'legs'} in ${locationDesc}, but ${dateRange.count === 1 ? "it's" : "they're"} scheduled for ${availableRange}, which is outside your search dates (${searchedRange}). Would you like me to search with different dates?`;

      dateAvailability = {
        spatialMatchCount: dateRange.count,
        earliestDate: dateRange.earliestDate,
        latestDate: dateRange.latestDate,
        searchedStartDate: options.startDate || '',
        searchedEndDate: options.endDate || '',
      };

      log('Date availability info:', dateAvailability);
    }
  }

  return {
    legs: filteredLegs,
    count: filteredLegs.length,
    searchedDeparture: departureDescription,
    searchedArrival: arrivalDescription,
    departureArea: departureBbox ? describeBbox(departureBbox) : undefined,
    arrivalArea: arrivalBbox ? describeBbox(arrivalBbox) : undefined,
    message,
    dateAvailability,
  };
}

/**
 * Format a date string for user-friendly display
 */
function formatDateForDisplay(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Find leg IDs that have waypoints within the specified bounding boxes
 * Exported for use by both shared search utilities and assistant toolExecutor
 */
export async function findLegsInBbox(
  supabase: SupabaseClient,
  departureBbox: BoundingBox | null,
  arrivalBbox: BoundingBox | null
): Promise<string[]> {
  log('Finding legs in bboxes:', { departureBbox, arrivalBbox });

  try {
    // Try using a stored procedure if both bboxes are provided
    if (departureBbox && arrivalBbox) {
      const { data, error } = await supabase.rpc('find_legs_by_location', {
        departure_min_lng: departureBbox.minLng,
        departure_min_lat: departureBbox.minLat,
        departure_max_lng: departureBbox.maxLng,
        departure_max_lat: departureBbox.maxLat,
        arrival_min_lng: arrivalBbox.minLng,
        arrival_min_lat: arrivalBbox.minLat,
        arrival_max_lng: arrivalBbox.maxLng,
        arrival_max_lat: arrivalBbox.maxLat,
      });

      if (!error && data) {
        const ids = (data as { id: string }[]).map((row) => row.id);
        log('RPC find_legs_by_location succeeded:', { count: ids.length, ids: ids.slice(0, 5) });
        return ids;
      }
      log('RPC find_legs_by_location failed, using fallback:', {
        error: error?.message,
        code: error?.code,
        details: error?.details,
      });
    }

    // Fallback: fetch waypoints and filter in memory
    return await findLegsInBboxFallback(supabase, departureBbox, arrivalBbox);
  } catch (error: any) {
    log('Spatial query error, using fallback:', error.message);
    return await findLegsInBboxFallback(supabase, departureBbox, arrivalBbox);
  }
}

/**
 * Fallback method to find legs when RPC find_legs_by_location fails
 * Uses get_waypoints_coords_for_bbox_search RPC (returns lng/lat) or inline waypoint fetch
 */
async function findLegsInBboxFallback(
  supabase: SupabaseClient,
  departureBbox: BoundingBox | null,
  arrivalBbox: BoundingBox | null
): Promise<string[]> {
  log('Using fallback bbox search');

  // Try RPC that returns coordinates (avoids EWKB parsing)
  const { data: coordRows, error: rpcError } = await supabase.rpc('get_waypoints_coords_for_bbox_search');

  if (!rpcError && coordRows && Array.isArray(coordRows)) {
    const rows = coordRows as { leg_id: string; waypoint_index: number; lng: number; lat: number }[];
    // Group by leg_id: collect {index, lng, lat}, then take index 0 = start, max index = end
    const legCoordsByIdx = new Map<string, Map<number, { lng: number; lat: number }>>();
    for (const row of rows) {
      if (!legCoordsByIdx.has(row.leg_id)) {
        legCoordsByIdx.set(row.leg_id, new Map());
      }
      legCoordsByIdx.get(row.leg_id)!.set(row.waypoint_index, { lng: row.lng, lat: row.lat });
    }

    const matchingLegIds: string[] = [];
    for (const [legId, idxMap] of legCoordsByIdx) {
      const indices = Array.from(idxMap.keys()).sort((a, b) => a - b);
      const start = idxMap.get(0) ?? null;
      const end = indices.length > 0 ? idxMap.get(indices[indices.length - 1]) ?? null : null;
      let departureMatch = !departureBbox;
      let arrivalMatch = !arrivalBbox;
      if (departureBbox && start) {
        departureMatch = isPointInBbox(start.lng, start.lat, departureBbox);
      }
      if (arrivalBbox && end) {
        arrivalMatch = isPointInBbox(end.lng, end.lat, arrivalBbox);
      }
      if (departureMatch && arrivalMatch) {
        matchingLegIds.push(legId);
      }
    }
    log('Fallback (RPC coords) found matching legs:', matchingLegIds.length);
    return matchingLegIds;
  }

  log('get_waypoints_coords_for_bbox_search not available, trying direct waypoint fetch:', rpcError?.message);

  // Legacy fallback: direct select (Supabase may return EWKB - extractCoordinates may fail)
  const { data: legs, error } = await supabase
    .from('legs')
    .select(`
      id,
      journeys!inner (
        state
      ),
      waypoints (
        index,
        location
      )
    `)
    .eq('journeys.state', 'Published')
    .limit(500);

  if (error) {
    log('Fallback query error:', error);
    throw error;
  }

  const matchingLegIds: string[] = [];

  for (const leg of legs || []) {
    const waypoints = (leg as any).waypoints || [];
    if (waypoints.length === 0) continue;

    const sortedWaypoints = waypoints.sort((a: any, b: any) => a.index - b.index);
    const startWaypoint = sortedWaypoints.find((w: any) => w.index === 0);
    const endWaypoint = sortedWaypoints[sortedWaypoints.length - 1];

    let departureMatch = true;
    let arrivalMatch = true;

    if (departureBbox && startWaypoint?.location) {
      const coords = extractCoordinates(startWaypoint.location);
      if (coords) {
        departureMatch = isPointInBbox(coords.lng, coords.lat, departureBbox);
      } else {
        departureMatch = false;
      }
    }

    if (arrivalBbox && endWaypoint?.location) {
      const coords = extractCoordinates(endWaypoint.location);
      if (coords) {
        arrivalMatch = isPointInBbox(coords.lng, coords.lat, arrivalBbox);
      } else {
        arrivalMatch = false;
      }
    }

    if (departureMatch && arrivalMatch) {
      matchingLegIds.push(leg.id);
    }
  }

  log('Fallback (direct) found matching legs:', matchingLegIds.length);
  return matchingLegIds;
}
