/**
 * AI Assistant Tool Executor
 *
 * Executes tool calls from the AI and returns results.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ToolCall, ToolResult, AIPendingAction, ActionType } from './types';
import { isActionTool } from './tools';
import { BoundingBox, describeBbox } from './geocoding';
import { getLocationBbox, listRegions, getCategories } from './locations';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Tool Executor] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Convert snake_case keys to camelCase
 * This handles AI models that output snake_case instead of camelCase
 */
function normalizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    normalized[camelKey] = value;
  }
  return normalized;
}

interface ExecutorContext {
  supabase: SupabaseClient;
  userId: string;
  userRoles: string[];
  conversationId: string;
}

/**
 * Execute a single tool call
 */
export async function executeTool(
  toolCall: ToolCall,
  context: ExecutorContext
): Promise<ToolResult> {
  const { name, arguments: rawArgs, id } = toolCall;
  const { supabase, userId, userRoles, conversationId } = context;

  // Normalize arguments (convert snake_case to camelCase)
  const args = normalizeArgs(rawArgs);
  log(`Executing tool: ${name}`, { id, rawArgs, normalizedArgs: args });

  try {
    // Handle action tools (create pending action)
    if (isActionTool(name)) {
      log(`Tool ${name} is an action tool, creating pending action...`);
      const pendingAction = await createPendingAction(name, args, context);
      log(`Pending action created: ${pendingAction.id}`);
      return {
        toolCallId: id,
        name,
        result: {
          success: true,
          message: `Action suggested and pending user approval. Action ID: ${pendingAction.id}`,
          pendingActionId: pendingAction.id,
        },
      };
    }

    // Handle data tools
    log(`Executing data tool: ${name}`);
    let result: unknown;

    switch (name) {
      case 'search_journeys':
        result = await searchJourneys(supabase, args);
        break;

      case 'search_legs':
        result = await searchLegs(supabase, args);
        break;

      case 'search_legs_by_location':
        result = await searchLegsByLocation(supabase, args);
        break;

      case 'get_leg_details':
        result = await getLegDetails(supabase, args.legId as string);
        break;

      case 'get_journey_details':
        result = await getJourneyDetails(supabase, args.journeyId as string);
        break;

      case 'get_user_profile':
        result = await getUserProfile(supabase, userId);
        break;

      case 'get_user_registrations':
        result = await getUserRegistrations(supabase, userId, args);
        break;

      case 'get_boat_details':
        result = await getBoatDetails(supabase, args.boatId as string);
        break;

      case 'analyze_leg_match':
        result = await analyzeLegMatch(supabase, userId, args.legId as string);
        break;

      case 'get_owner_boats':
        if (!userRoles.includes('owner')) {
          throw new Error('This action requires owner role');
        }
        result = await getOwnerBoats(supabase, userId);
        break;

      case 'get_owner_journeys':
        if (!userRoles.includes('owner')) {
          throw new Error('This action requires owner role');
        }
        result = await getOwnerJourneys(supabase, userId, args);
        break;

      case 'get_leg_registrations':
        if (!userRoles.includes('owner')) {
          throw new Error('This action requires owner role');
        }
        result = await getLegRegistrations(supabase, userId, args.legId as string);
        break;

      case 'analyze_crew_match':
        if (!userRoles.includes('owner')) {
          throw new Error('This action requires owner role');
        }
        result = await analyzeCrewMatch(supabase, userId, args.registrationId as string);
        break;

      case 'get_location_bounding_box':
        //result = handleGetLocationBoundingBox(args);
        break;

      case 'get_leg_registration_info':
        result = await getLegRegistrationInfo(supabase, args.legId as string);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    log(`Tool ${name} completed successfully`, { resultKeys: result ? Object.keys(result as object) : null });
    return {
      toolCallId: id,
      name,
      result,
    };
  } catch (error: any) {
    log(`Tool ${name} failed: ${error.message}`);
    return {
      toolCallId: id,
      name,
      result: null,
      error: error.message || 'Tool execution failed',
    };
  }
}

/**
 * Execute multiple tool calls
 */
export async function executeTools(
  toolCalls: ToolCall[],
  context: ExecutorContext
): Promise<ToolResult[]> {
  log(`Executing ${toolCalls.length} tool calls in parallel...`, toolCalls.map(tc => tc.name));
  // Execute tools in parallel where possible
  const results = await Promise.all(
    toolCalls.map(tc => executeTool(tc, context))
  );
  log(`All tools completed`, { successCount: results.filter(r => !r.error).length, errorCount: results.filter(r => r.error).length });
  return results;
}

// ============================================================================
// Data Tool Implementations
// ============================================================================

/**
 * Normalize bounding box arguments from AI
 * Handles multiple formats:
 * 1. Proper nested: { departureBbox: { minLng: -6, ... } }
 * 2. Flat coordinates: { minLng: -6, minLat: 35, maxLng: 10, maxLat: 44 }
 * 3. String values: { departureBbox: { minLng: "-6", ... } }
 */
function normalizeBboxArgs(args: Record<string, unknown>): {
  departureBbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  arrivalBbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  departureDescription?: string;
  arrivalDescription?: string;
} {
  const result: ReturnType<typeof normalizeBboxArgs> = {};

  // Helper to convert string/number to number
  const toNumber = (val: unknown): number | undefined => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  };

  // Helper to normalize a bbox object (convert strings to numbers)
  const normalizeBbox = (bbox: unknown): { minLng: number; minLat: number; maxLng: number; maxLat: number } | undefined => {
    if (!bbox || typeof bbox !== 'object') return undefined;
    const b = bbox as Record<string, unknown>;
    const minLng = toNumber(b.minLng);
    const minLat = toNumber(b.minLat);
    const maxLng = toNumber(b.maxLng);
    const maxLat = toNumber(b.maxLat);
    if (minLng !== undefined && minLat !== undefined && maxLng !== undefined && maxLat !== undefined) {
      return { minLng, minLat, maxLng, maxLat };
    }
    return undefined;
  };

  // Check for proper nested format first
  if (args.departureBbox) {
    result.departureBbox = normalizeBbox(args.departureBbox);
  }
  if (args.arrivalBbox) {
    result.arrivalBbox = normalizeBbox(args.arrivalBbox);
  }

  // If no nested bbox found, check for flat coordinates at root level
  // This handles the case where AI sends: { minLng: -6, minLat: 35, maxLng: 10, maxLat: 44 }
  if (!result.departureBbox && !result.arrivalBbox) {
    const minLng = toNumber(args.minLng);
    const minLat = toNumber(args.minLat);
    const maxLng = toNumber(args.maxLng);
    const maxLat = toNumber(args.maxLat);

    if (minLng !== undefined && minLat !== undefined && maxLng !== undefined && maxLat !== undefined) {
      // Flat coordinates found - treat as departure bbox by default
      result.departureBbox = { minLng, minLat, maxLng, maxLat };
      log('Converted flat coordinates to departureBbox:', result.departureBbox);

      // Use departureDescription if provided, otherwise generate one
      if (!args.departureDescription) {
        result.departureDescription = 'Search area (coordinates provided)';
      }
    }
  }

  return result;
}

async function searchJourneys(
  supabase: SupabaseClient,
  args: Record<string, unknown>
) {
  let query = supabase
    .from('journeys')
    .select(`
      id,
      name,
      description,
      start_date,
      end_date,
      risk_level,
      skills,
      min_experience_level,
      state,
      boats!inner (
        id,
        name,
        make,
        model,
        type
      )
    `)
    .eq('state', 'Published')
    .order('start_date', { ascending: true });

  if (args.startDate) {
    query = query.gte('start_date', args.startDate);
  }
  if (args.endDate) {
    query = query.lte('end_date', args.endDate);
  }
  // Note: journey.risk_level is a scalar enum (not array), use eq for filtering
  if (args.riskLevel) {
    query = query.eq('risk_level', args.riskLevel);
  }

  const limit = (args.limit as number) || 10;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;
  return { journeys: data || [], count: data?.length || 0 };
}

async function searchLegs(
  supabase: SupabaseClient,
  args: Record<string, unknown>
) {
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
        boats!inner (
          id,
          name,
          make,
          model
        )
      )
    `)
    .eq('journeys.state', 'Published')
    .order('start_date', { ascending: true });

  if (args.journeyId) {
    query = query.eq('journey_id', args.journeyId);
  }
  if (args.startDate) {
    query = query.gte('start_date', args.startDate);
  }
  if (args.endDate) {
    query = query.lte('end_date', args.endDate);
  }

  const limit = (args.limit as number) || 10;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;

  // Filter by crew_needed if specified
  let legs = data || [];
  if (args.crewNeeded !== false) {
    legs = legs.filter(leg => (leg.crew_needed || 0) > 0);
  }

  // Transform legs to include computed fields matching get_legs_per_viewport logic:
  // - combined_skills: union of journey.skills + leg.skills (deduplicated)
  // - effective_risk_level: leg.risk_level if set, otherwise journey.risk_level
  // - effective_min_experience_level: leg.min_experience_level if set, otherwise journey.min_experience_level
  const transformedLegs = legs.map((leg: any) => {
    const journey = leg.journeys;
    const journeySkills = journey?.skills || [];
    const legSkills = leg.skills || [];

    // Combine skills (union, deduplicated, filter empty)
    const combinedSkills = [...new Set([...journeySkills, ...legSkills])].filter(
      (s: string) => s && s.trim() !== ''
    );

    // Effective risk_level: leg's if set, otherwise journey's
    const effectiveRiskLevel = leg.risk_level ?? journey?.risk_level ?? null;

    // Effective min_experience_level: leg's if set, otherwise journey's
    const effectiveMinExperienceLevel = leg.min_experience_level ?? journey?.min_experience_level ?? null;

    return {
      ...leg,
      combined_skills: combinedSkills,
      effective_risk_level: effectiveRiskLevel,
      effective_min_experience_level: effectiveMinExperienceLevel,
    };
  });

  return { legs: transformedLegs, count: transformedLegs.length };
}

/**
 * Search for legs by geographic location using AI-provided bounding boxes
 * Supports filtering by departure and/or arrival area, plus other criteria
 */
async function searchLegsByLocation(
  supabase: SupabaseClient,
  args: Record<string, unknown>
) {
  log('searchLegsByLocation called with args:', args);

  // Normalize input: handle both nested bbox objects AND flat coordinates
  // This provides resilience against AI format variations
  const normalizedArgs = normalizeBboxArgs(args);

  const departureBboxArg = normalizedArgs.departureBbox;
  const arrivalBboxArg = normalizedArgs.arrivalBbox;
  const departureDescription = (args.departureDescription as string | undefined) || normalizedArgs.departureDescription;
  const arrivalDescription = (args.arrivalDescription as string | undefined) || normalizedArgs.arrivalDescription;

  if (!departureBboxArg && !arrivalBboxArg) {
    throw new Error('At least one of departureBbox or arrivalBbox must be provided. Use format: {"departureBbox": {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}, "departureDescription": "Western Med"}');
  }

  // Convert to BoundingBox type (validate coordinates)
  let departureBbox: BoundingBox | null = null;
  let arrivalBbox: BoundingBox | null = null;

  if (departureBboxArg) {
    if (!isValidBbox(departureBboxArg)) {
      return {
        legs: [],
        count: 0,
        message: 'Invalid departure bounding box coordinates provided.',
        searchedDeparture: departureDescription,
        searchedArrival: arrivalDescription,
      };
    }
    departureBbox = departureBboxArg;
  }

  if (arrivalBboxArg) {
    if (!isValidBbox(arrivalBboxArg)) {
      return {
        legs: [],
        count: 0,
        message: 'Invalid arrival bounding box coordinates provided.',
        searchedDeparture: departureDescription,
        searchedArrival: arrivalDescription,
      };
    }
    arrivalBbox = arrivalBboxArg;
  }

  log('Using AI-provided bounding boxes:', {
    departure: departureBbox ? { description: departureDescription, bbox: departureBbox } : null,
    arrival: arrivalBbox ? { description: arrivalDescription, bbox: arrivalBbox } : null,
  });

  // Build the query with spatial filtering using RPC or raw query
  // Since Supabase doesn't directly support PostGIS in the JS client,
  // we need to use a raw SQL approach via RPC or construct a compatible query

  // First, get all leg IDs that match the spatial criteria
  const matchingLegIds = await findLegsInBbox(supabase, departureBbox, arrivalBbox);

  if (matchingLegIds.length === 0) {
    return {
      legs: [],
      count: 0,
      message: `No sailing opportunities found ${departureDescription ? `departing from ${departureDescription}` : ''}${departureDescription && arrivalDescription ? ' and ' : ''}${arrivalDescription ? `arriving at ${arrivalDescription}` : ''}.`,
      searchedDeparture: departureDescription,
      searchedArrival: arrivalDescription,
      departureArea: departureBbox ? describeBbox(departureBbox) : null,
      arrivalArea: arrivalBbox ? describeBbox(arrivalBbox) : null,
    };
  }

  log('Found matching leg IDs:', matchingLegIds.length);

  // Now fetch the full leg data with all joins
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
        boats!inner (
          id,
          name,
          make,
          model
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

  // Apply date filters
  if (args.startDate) {
    query = query.gte('start_date', args.startDate);
  }
  if (args.endDate) {
    query = query.lte('end_date', args.endDate);
  }

  const limit = (args.limit as number) || 10;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    log('Query error:', error);
    throw error;
  }

  // Filter and transform results
  let legs = data || [];

  // Filter by crew_needed if specified (default true)
  if (args.crewNeeded !== false) {
    legs = legs.filter((leg: any) => (leg.crew_needed || 0) > 0);
  }

  // Transform legs to include computed fields
  const transformedLegs = legs.map((leg: any) => {
    const journey = leg.journeys;
    const journeySkills = journey?.skills || [];
    const legSkills = leg.skills || [];

    // Combine skills (union, deduplicated, filter empty)
    const combinedSkills = [...new Set([...journeySkills, ...legSkills])].filter(
      (s: string) => s && s.trim() !== ''
    );

    // Effective risk_level: leg's if set, otherwise journey's
    const effectiveRiskLevel = leg.risk_level ?? journey?.risk_level ?? null;

    // Effective min_experience_level: leg's if set, otherwise journey's
    const effectiveMinExperienceLevel = leg.min_experience_level ?? journey?.min_experience_level ?? null;

    // Get start and end waypoint names
    const sortedWaypoints = (leg.waypoints || []).sort((a: any, b: any) => a.index - b.index);
    const startWaypoint = sortedWaypoints.find((w: any) => w.index === 0);
    const endWaypoint = sortedWaypoints.length > 0 ? sortedWaypoints[sortedWaypoints.length - 1] : null;

    return {
      ...leg,
      combined_skills: combinedSkills,
      effective_risk_level: effectiveRiskLevel,
      effective_min_experience_level: effectiveMinExperienceLevel,
      start_location: startWaypoint?.name || 'Unknown',
      end_location: endWaypoint?.name || 'Unknown',
      // Remove waypoints array from response to keep it clean
      waypoints: undefined,
    };
  });

  // Apply additional filters that couldn't be done in SQL
  let filteredLegs = transformedLegs;

  // Filter by skills if specified
  if (args.skillsRequired) {
    const requiredSkills = (args.skillsRequired as string).split(',').map(s => s.trim().toLowerCase());
    filteredLegs = filteredLegs.filter((leg: any) => {
      const legCombinedSkills = (leg.combined_skills || []).map((s: string) => s.toLowerCase());
      return requiredSkills.every(skill => legCombinedSkills.includes(skill));
    });
  }

  // Filter by risk levels if specified
  if (args.riskLevels) {
    const allowedRiskLevels = (args.riskLevels as string).split(',').map(s => s.trim());
    filteredLegs = filteredLegs.filter((leg: any) => {
      if (!leg.effective_risk_level) return true; // No restriction
      return allowedRiskLevels.includes(leg.effective_risk_level);
    });
  }

  // Filter by experience level if specified
  if (args.minExperienceLevel) {
    const userExpLevel = args.minExperienceLevel as number;
    filteredLegs = filteredLegs.filter((leg: any) => {
      if (!leg.effective_min_experience_level) return true; // No restriction
      return userExpLevel >= leg.effective_min_experience_level;
    });
  }

  return {
    legs: filteredLegs,
    count: filteredLegs.length,
    searchedDeparture: departureDescription,
    searchedArrival: arrivalDescription,
    departureArea: departureBbox ? describeBbox(departureBbox) : null,
    arrivalArea: arrivalBbox ? describeBbox(arrivalBbox) : null,
  };
}

/**
 * Validate that a bounding box has valid coordinates
 */
function isValidBbox(bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }): boolean {
  // Check all values are numbers
  if (
    typeof bbox.minLng !== 'number' ||
    typeof bbox.minLat !== 'number' ||
    typeof bbox.maxLng !== 'number' ||
    typeof bbox.maxLat !== 'number'
  ) {
    return false;
  }

  // Check longitude range (-180 to 180)
  if (bbox.minLng < -180 || bbox.minLng > 180 || bbox.maxLng < -180 || bbox.maxLng > 180) {
    return false;
  }

  // Check latitude range (-90 to 90)
  if (bbox.minLat < -90 || bbox.minLat > 90 || bbox.maxLat < -90 || bbox.maxLat > 90) {
    return false;
  }

  // Check min < max (allow for bboxes crossing the antimeridian)
  if (bbox.minLat > bbox.maxLat) {
    return false;
  }

  return true;
}

/**
 * Find leg IDs that have waypoints within the specified bounding boxes
 * Uses raw SQL via Supabase RPC or direct query
 */
async function findLegsInBbox(
  supabase: SupabaseClient,
  departureBbox: BoundingBox | null,
  arrivalBbox: BoundingBox | null
): Promise<string[]> {
  log('Finding legs in bboxes:', { departureBbox, arrivalBbox });

  // Build conditions for the query
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  // We need to use raw SQL for PostGIS spatial queries
  // Build the WHERE clause based on which bboxes are provided

  let sqlQuery = `
    SELECT DISTINCT l.id
    FROM legs l
    INNER JOIN journeys j ON j.id = l.journey_id
    WHERE j.state = 'Published'
  `;

  // Add departure location filter (start waypoint with index = 0)
  if (departureBbox) {
    sqlQuery += `
      AND EXISTS (
        SELECT 1 FROM waypoints w
        WHERE w.leg_id = l.id
        AND w.index = 0
        AND ST_Within(
          w.location,
          ST_MakeEnvelope(${departureBbox.minLng}, ${departureBbox.minLat}, ${departureBbox.maxLng}, ${departureBbox.maxLat}, 4326)
        )
      )
    `;
  }

  // Add arrival location filter (end waypoint with max index)
  if (arrivalBbox) {
    sqlQuery += `
      AND EXISTS (
        SELECT 1 FROM waypoints w
        WHERE w.leg_id = l.id
        AND w.index = (SELECT MAX(w2.index) FROM waypoints w2 WHERE w2.leg_id = l.id)
        AND ST_Within(
          w.location,
          ST_MakeEnvelope(${arrivalBbox.minLng}, ${arrivalBbox.minLat}, ${arrivalBbox.maxLng}, ${arrivalBbox.maxLat}, 4326)
        )
      )
    `;
  }

  sqlQuery += ' LIMIT 100';

  log('Executing spatial query:', sqlQuery);

  // Execute raw SQL using Supabase's rpc or sql methods
  // Note: Supabase requires an RPC function for raw SQL, or we can use the REST API
  // For now, let's try using the .rpc method with a generic function

  try {
    // Try using a simple approach: query legs and filter by bbox overlap
    // This uses the leg's bbox column which is pre-calculated

    // If we only have departure OR arrival, we can use the leg's bbox
    // For both, we need waypoint-level precision

    if (departureBbox && arrivalBbox) {
      // Need waypoint-level queries - use raw SQL via RPC
      // First, try to call a stored procedure if available
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

      if (error) {
        // RPC function might not exist, fall back to simpler approach
        log('RPC not available, using fallback approach:', error.message);
        return await findLegsInBboxFallback(supabase, departureBbox, arrivalBbox);
      }

      return (data || []).map((row: any) => row.id);
    } else {
      // Single location - use the simpler fallback approach
      return await findLegsInBboxFallback(supabase, departureBbox, arrivalBbox);
    }
  } catch (error: any) {
    log('Spatial query error, using fallback:', error.message);
    return await findLegsInBboxFallback(supabase, departureBbox, arrivalBbox);
  }
}

/**
 * Fallback method to find legs when RPC is not available
 * Fetches waypoints and filters in memory
 */
async function findLegsInBboxFallback(
  supabase: SupabaseClient,
  departureBbox: BoundingBox | null,
  arrivalBbox: BoundingBox | null
): Promise<string[]> {
  log('Using fallback bbox search');

  // Get all legs with their waypoints
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

    // Sort waypoints by index
    const sortedWaypoints = waypoints.sort((a: any, b: any) => a.index - b.index);
    const startWaypoint = sortedWaypoints.find((w: any) => w.index === 0);
    const endWaypoint = sortedWaypoints[sortedWaypoints.length - 1];

    let departureMatch = true;
    let arrivalMatch = true;

    // Check departure location
    if (departureBbox && startWaypoint?.location) {
      const coords = extractCoordinates(startWaypoint.location);
      if (coords) {
        departureMatch = isPointInBbox(coords.lng, coords.lat, departureBbox);
      } else {
        departureMatch = false;
      }
    }

    // Check arrival location
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

  log('Fallback found matching legs:', matchingLegIds.length);
  return matchingLegIds;
}

/**
 * Extract coordinates from a PostGIS geometry response
 */
function extractCoordinates(location: any): { lng: number; lat: number } | null {
  try {
    if (typeof location === 'string') {
      // Could be GeoJSON string or WKT
      if (location.startsWith('{')) {
        const geoJson = JSON.parse(location);
        if (geoJson.coordinates) {
          return { lng: geoJson.coordinates[0], lat: geoJson.coordinates[1] };
        }
      }
    } else if (location?.coordinates) {
      // GeoJSON object
      return { lng: location.coordinates[0], lat: location.coordinates[1] };
    } else if (location?.x !== undefined && location?.y !== undefined) {
      // Point object with x/y
      return { lng: location.x, lat: location.y };
    }
  } catch (e) {
    log('Failed to extract coordinates:', e);
  }
  return null;
}

/**
 * Check if a point is within a bounding box
 */
function isPointInBbox(lng: number, lat: number, bbox: BoundingBox): boolean {
  return (
    lng >= bbox.minLng &&
    lng <= bbox.maxLng &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

/**
 * Handle get_location_bounding_box tool
 * Resolves location names to bounding box coordinates
 */
function handleGetLocationBoundingBox(args: Record<string, unknown>): {
  found: boolean;
  bbox?: BoundingBox;
  name?: string;
  description?: string;
  aliases?: string[];
  category?: string;
  regions?: { name: string; category: string; aliases: string[] }[];
  categories?: string[];
  message?: string;
} {
  // If listCategory is provided, list all regions in that category
  if (args.listCategory) {
    const category = args.listCategory as 'mediterranean' | 'atlantic' | 'caribbean' | 'northern_europe' | 'pacific' | 'indian_ocean' | 'south_america' | 'arctic' | 'antarctic';
    const regions = listRegions(category);
    return {
      found: true,
      regions,
      message: `Found ${regions.length} regions in the ${category.replace('_', ' ')} category.`,
    };
  }

  // If no query provided, list all categories
  if (!args.query || typeof args.query !== 'string' || args.query.trim() === '') {
    const categories = getCategories();
    return {
      found: false,
      categories,
      message: 'No query provided. Available categories: ' + categories.join(', ') + '. Use listCategory to see regions in each category, or provide a query to search for a specific location.',
    };
  }

  const query = args.query as string;
  const result = getLocationBbox(query);

  if (!result) {
    // No match found - provide helpful suggestions
    const categories = getCategories();
    return {
      found: false,
      message: `No matching location found for "${query}". Try a more specific name (e.g., "Barcelona", "Canary Islands", "BVI") or use listCategory to browse available regions. Categories: ${categories.join(', ')}.`,
      categories,
    };
  }

  log('Location bbox resolved:', { query, result: result.name });

  return {
    found: true,
    bbox: result.bbox,
    name: result.name,
    description: result.description,
    aliases: result.aliases,
    category: result.category,
    message: `Found "${result.name}" - use these coordinates with search_legs_by_location.`,
  };
}

/**
 * Get registration requirements and auto-approval settings for a leg
 */
async function getLegRegistrationInfo(supabase: SupabaseClient, legId: string) {
  // 1. Get leg with journey info
  const { data: leg, error: legError } = await supabase
    .from('legs')
    .select(`
      id,
      name,
      journey_id,
      journeys!inner (
        id,
        name,
        auto_approval_enabled,
        auto_approval_threshold
      )
    `)
    .eq('id', legId)
    .single();

  if (legError || !leg) {
    throw new Error('Leg not found');
  }

  const journey = (leg as any).journeys;

  // 2. Get journey requirements
  const { data: requirements, error: reqError } = await supabase
    .from('journey_requirements')
    .select('id, question_text, question_type, is_required, options')
    .eq('journey_id', journey.id)
    .order('order', { ascending: true });

  if (reqError) {
    throw new Error('Failed to fetch requirements');
  }

  const hasRequirements = requirements && requirements.length > 0;

  return {
    legId,
    legName: leg.name,
    journeyId: journey.id,
    journeyName: journey.name,
    hasRequirements,
    requirementsCount: requirements?.length || 0,
    requirements: requirements || [],
    autoApprovalEnabled: journey.auto_approval_enabled === true,
    autoApprovalThreshold: journey.auto_approval_threshold || 80,
    // Guidance for AI
    registrationMethod: hasRequirements
      ? 'ui_form'
      : 'assistant_action',
    message: hasRequirements
      ? 'This leg requires answering registration questions. Direct the user to complete registration through the leg details page in the UI.'
      : 'No requirements. You can use suggest_register_for_leg to register the user.',
  };
}

async function getLegDetails(supabase: SupabaseClient, legId: string) {
  const { data, error } = await supabase
    .from('legs')
    .select(`
      *,
      journeys!inner (
        id,
        name,
        description,
        start_date,
        end_date,
        risk_level,
        skills,
        min_experience_level,
        boats!inner (
          id,
          name,
          make,
          model,
          type,
          capacity,
          home_port
        )
      ),
      waypoints (
        id,
        index,
        name,
        location
      )
    `)
    .eq('id', legId)
    .single();

  if (error) throw error;

  // Add computed fields matching get_legs_per_viewport logic
  if (data) {
    const leg = data as any;
    const journey = leg.journeys;
    const journeySkills = journey?.skills || [];
    const legSkills = leg.skills || [];

    // Combine skills (union, deduplicated, filter empty)
    const combinedSkills = [...new Set([...journeySkills, ...legSkills])].filter(
      (s: string) => s && s.trim() !== ''
    );

    // Effective risk_level: leg's if set, otherwise journey's
    const effectiveRiskLevel = leg.risk_level ?? journey?.risk_level ?? null;

    // Effective min_experience_level: leg's if set, otherwise journey's
    const effectiveMinExperienceLevel = leg.min_experience_level ?? journey?.min_experience_level ?? null;

    return {
      ...leg,
      combined_skills: combinedSkills,
      effective_risk_level: effectiveRiskLevel,
      effective_min_experience_level: effectiveMinExperienceLevel,
    };
  }

  return data;
}

async function getJourneyDetails(supabase: SupabaseClient, journeyId: string) {
  const { data, error } = await supabase
    .from('journeys')
    .select(`
      *,
      boats!inner (
        id,
        name,
        make,
        model,
        type,
        capacity,
        home_port,
        characteristics,
        capabilities
      ),
      legs (
        id,
        name,
        description,
        start_date,
        end_date,
        crew_needed,
        skills,
        risk_level,
        min_experience_level
      )
    `)
    .eq('id', journeyId)
    .single();

  if (error) throw error;

  // Add computed fields for each leg matching get_legs_per_viewport logic
  if (data && data.legs) {
    const journey = data as any;
    const journeySkills = journey.skills || [];
    const journeyRiskLevel = journey.risk_level;
    const journeyMinExpLevel = journey.min_experience_level;

    journey.legs = journey.legs.map((leg: any) => {
      const legSkills = leg.skills || [];

      // Combine skills (union, deduplicated, filter empty)
      const combinedSkills = [...new Set([...journeySkills, ...legSkills])].filter(
        (s: string) => s && s.trim() !== ''
      );

      // Effective risk_level: leg's if set, otherwise journey's
      const effectiveRiskLevel = leg.risk_level ?? journeyRiskLevel ?? null;

      // Effective min_experience_level: leg's if set, otherwise journey's
      const effectiveMinExperienceLevel = leg.min_experience_level ?? journeyMinExpLevel ?? null;

      return {
        ...leg,
        combined_skills: combinedSkills,
        effective_risk_level: effectiveRiskLevel,
        effective_min_experience_level: effectiveMinExperienceLevel,
      };
    });
  }

  return data;
}

async function getUserProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

async function getUserRegistrations(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
) {
  let query = supabase
    .from('registrations')
    .select(`
      id,
      status,
      notes,
      created_at,
      legs!inner (
        id,
        name,
        start_date,
        end_date,
        journeys!inner (
          id,
          name,
          boats!inner (
            id,
            name
          )
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const limit = (args.limit as number) || 10;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;
  return { registrations: data || [], count: data?.length || 0 };
}

async function getBoatDetails(supabase: SupabaseClient, boatId: string) {
  const { data, error } = await supabase
    .from('boats')
    .select('*')
    .eq('id', boatId)
    .single();

  if (error) throw error;
  return data;
}

async function analyzeLegMatch(
  supabase: SupabaseClient,
  userId: string,
  legId: string
) {
  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('sailing_experience, skills, risk_level')
    .eq('id', userId)
    .single();

  // Get leg requirements with journey data for combined/effective values
  const { data: leg } = await supabase
    .from('legs')
    .select(`
      name,
      skills,
      risk_level,
      min_experience_level,
      journeys!inner (
        skills,
        risk_level,
        min_experience_level
      )
    `)
    .eq('id', legId)
    .single();

  if (!profile || !leg) {
    throw new Error('Profile or leg not found');
  }

  const journey = (leg as any).journeys;

  // Calculate combined skills (journey + leg, deduplicated, matching get_legs_per_viewport logic)
  const journeySkills = journey?.skills || [];
  const legSkills = (leg as any).skills || [];
  const combinedSkills = [...new Set([...journeySkills, ...legSkills])].filter(
    (s: string) => s && s.trim() !== ''
  );

  // Effective risk_level: leg's if set, otherwise journey's (matching get_legs_per_viewport)
  const effectiveRiskLevel = (leg as any).risk_level ?? journey?.risk_level ?? null;

  // Effective min_experience_level: leg's if set, otherwise journey's (matching get_legs_per_viewport)
  const effectiveMinExpLevel = (leg as any).min_experience_level ?? journey?.min_experience_level ?? null;

  // Calculate match using effective/combined values
  const userSkills = profile.skills || [];
  const userRiskLevels = profile.risk_level || [];

  // Skills match (using combined skills from journey + leg)
  const matchingSkills = combinedSkills.filter((s: string) => userSkills.includes(s));
  const skillsMatch = combinedSkills.length > 0
    ? Math.round((matchingSkills.length / combinedSkills.length) * 100)
    : 100;

  // Experience match (using effective min_experience_level)
  const userExp = profile.sailing_experience || 1;
  const requiredExp = effectiveMinExpLevel || 1;
  const experienceMatch = userExp >= requiredExp;

  // Risk level match (using effective risk_level)
  const riskMatch = !effectiveRiskLevel || userRiskLevels.includes(effectiveRiskLevel);

  // Overall match
  const overallMatch = Math.round(
    (skillsMatch * 0.4) +
    (experienceMatch ? 40 : 0) +
    (riskMatch ? 20 : 0)
  );

  return {
    legName: (leg as any).name,
    overallMatch,
    skillsMatch,
    matchingSkills,
    missingSkills: combinedSkills.filter((s: string) => !userSkills.includes(s)),
    experienceMatch,
    userExperience: userExp,
    requiredExperience: requiredExp,
    riskMatch,
    userRiskLevels,
    effectiveRiskLevel,
    // Include source info for transparency
    legRiskLevel: (leg as any).risk_level,
    journeyRiskLevel: journey?.risk_level,
    legSkills: legSkills,
    journeySkills: journeySkills,
    combinedSkills,
    legMinExperienceLevel: (leg as any).min_experience_level,
    journeyMinExperienceLevel: journey?.min_experience_level,
    effectiveMinExperienceLevel: effectiveMinExpLevel,
  };
}

async function getOwnerBoats(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('boats')
    .select('id, name, make, model, type, home_port, capacity')
    .eq('owner_id', userId);

  if (error) throw error;
  return { boats: data || [], count: data?.length || 0 };
}

async function getOwnerJourneys(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
) {
  let query = supabase
    .from('journeys')
    .select(`
      id,
      name,
      start_date,
      end_date,
      state,
      boats!inner (
        id,
        name,
        owner_id
      )
    `)
    .eq('boats.owner_id', userId)
    .order('start_date', { ascending: false });

  if (args.boatId) {
    query = query.eq('boat_id', args.boatId);
  }
  if (args.state) {
    query = query.eq('state', args.state);
  }

  const { data, error } = await query;

  if (error) throw error;
  return { journeys: data || [], count: data?.length || 0 };
}

async function getLegRegistrations(
  supabase: SupabaseClient,
  userId: string,
  legId: string
) {
  // Verify user owns the journey this leg belongs to
  const { data: leg } = await supabase
    .from('legs')
    .select(`
      id,
      journeys!inner (
        boats!inner (
          owner_id
        )
      )
    `)
    .eq('id', legId)
    .single();

  if (!leg || (leg as any).journeys.boats.owner_id !== userId) {
    throw new Error('Not authorized to view registrations for this leg');
  }

  const { data, error } = await supabase
    .from('registrations')
    .select(`
      id,
      status,
      notes,
      match_percentage,
      created_at,
      profiles!inner (
        id,
        username,
        full_name,
        sailing_experience,
        skills,
        certifications
      )
    `)
    .eq('leg_id', legId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return { registrations: data || [], count: data?.length || 0 };
}

async function analyzeCrewMatch(
  supabase: SupabaseClient,
  userId: string,
  registrationId: string
) {
  // Get registration with leg, journey, and crew profile for combined/effective values
  const { data: registration } = await supabase
    .from('registrations')
    .select(`
      id,
      user_id,
      match_percentage,
      legs!inner (
        id,
        name,
        skills,
        risk_level,
        min_experience_level,
        journeys!inner (
          skills,
          risk_level,
          min_experience_level,
          boats!inner (
            owner_id
          )
        )
      ),
      profiles!inner (
        username,
        full_name,
        sailing_experience,
        skills,
        risk_level,
        certifications,
        user_description
      )
    `)
    .eq('id', registrationId)
    .single();

  if (!registration) {
    throw new Error('Registration not found');
  }

  // Verify ownership
  if ((registration as any).legs.journeys.boats.owner_id !== userId) {
    throw new Error('Not authorized to analyze this registration');
  }

  const profile = (registration as any).profiles;
  const leg = (registration as any).legs;
  const journey = leg.journeys;

  // Calculate combined skills (journey + leg, matching get_legs_per_viewport logic)
  const journeySkills = journey?.skills || [];
  const legSkills = leg.skills || [];
  const combinedSkills = [...new Set([...journeySkills, ...legSkills])].filter(
    (s: string) => s && s.trim() !== ''
  );

  // Effective risk_level: leg's if set, otherwise journey's
  const effectiveRiskLevel = leg.risk_level ?? journey?.risk_level ?? null;

  // Effective min_experience_level: leg's if set, otherwise journey's
  const effectiveMinExperienceLevel = leg.min_experience_level ?? journey?.min_experience_level ?? null;

  // Return comprehensive analysis with combined/effective values
  return {
    crewMember: {
      username: profile.username,
      fullName: profile.full_name,
      experience: profile.sailing_experience,
      skills: profile.skills,
      riskLevels: profile.risk_level,
      certifications: profile.certifications,
      userDescription: profile.user_description,
    },
    legRequirements: {
      name: leg.name,
      // Include both raw and computed values for transparency
      legSkills: legSkills,
      journeySkills: journeySkills,
      combinedSkills: combinedSkills,
      legRiskLevel: leg.risk_level,
      journeyRiskLevel: journey?.risk_level,
      effectiveRiskLevel: effectiveRiskLevel,
      legMinExperience: leg.min_experience_level,
      journeyMinExperience: journey?.min_experience_level,
      effectiveMinExperience: effectiveMinExperienceLevel,
    },
    matchPercentage: registration.match_percentage,
  };
}

// ============================================================================
// Action Creation
// ============================================================================

async function createPendingAction(
  toolName: string,
  args: Record<string, unknown>,
  context: ExecutorContext
): Promise<AIPendingAction> {
  const { supabase, userId, conversationId } = context;

  // Map tool name to action type
  const actionTypeMap: Record<string, ActionType> = {
    suggest_register_for_leg: 'register_for_leg',
    suggest_profile_update: 'update_profile',
    suggest_approve_registration: 'approve_registration',
    suggest_reject_registration: 'reject_registration',
  };

  const actionType = actionTypeMap[toolName];
  if (!actionType) {
    throw new Error(`Unknown action tool: ${toolName}`);
  }

  // Build payload based on action type
  let payload: Record<string, unknown>;
  let explanation: string;

  switch (toolName) {
    case 'suggest_register_for_leg':
      // Validate required parameters
      if (!args.legId) {
        throw new Error('Missing required parameter: legId. Please provide the ID of the leg to register for.');
      }
      if (!args.reason || typeof args.reason !== 'string' || args.reason.trim() === '') {
        throw new Error('Missing required parameter: reason. Please provide an explanation of why this leg is a good match for the user.');
      }
      payload = { legId: args.legId };
      explanation = args.reason as string;
      break;

    case 'suggest_profile_update': {
      // Validate required parameters
      if (!args.reason || typeof args.reason !== 'string' || args.reason.trim() === '') {
        throw new Error('Missing required parameter: reason. Please provide an explanation of why these profile updates are recommended.');
      }

      // Handle updates parameter - can be JSON string or object
      let updates: Record<string, unknown>;
      if (!args.updates) {
        // Check if AI sent fields directly instead of in an "updates" wrapper
        // Common case: AI sends {skills: [...], reason: "..."} instead of {updates: "{...}", reason: "..."}
        const knownProfileFields = ['skills', 'sailing_experience', 'risk_level', 'certifications', 'user_description', 'bio'];
        const directFields: Record<string, unknown> = {};
        let hasDirectFields = false;

        for (const field of knownProfileFields) {
          if (args[field] !== undefined) {
            directFields[field] = args[field];
            hasDirectFields = true;
          }
        }

        if (hasDirectFields) {
          updates = directFields;
          log('Normalized direct profile fields to updates object:', updates);
        } else {
          throw new Error('Missing required parameter: updates. Please provide a JSON object with the profile fields and values to update.');
        }
      } else if (typeof args.updates === 'string') {
        // Parse JSON string
        try {
          updates = JSON.parse(args.updates);
        } catch (e) {
          throw new Error(`Invalid updates parameter: could not parse JSON string. Error: ${(e as Error).message}`);
        }
      } else if (typeof args.updates === 'object' && args.updates !== null) {
        // Already an object, use directly
        updates = args.updates as Record<string, unknown>;
      } else {
        throw new Error('Invalid updates parameter: must be a JSON string or object.');
      }

      payload = { updates };
      explanation = args.reason as string;
      break;
    }

    case 'suggest_approve_registration':
    case 'suggest_reject_registration':
      // Validate required parameters
      if (!args.registrationId) {
        throw new Error('Missing required parameter: registrationId. Please provide the ID of the registration.');
      }
      if (!args.reason || typeof args.reason !== 'string' || args.reason.trim() === '') {
        throw new Error('Missing required parameter: reason. Please provide an explanation for this action.');
      }
      payload = { registrationId: args.registrationId };
      explanation = args.reason as string;
      break;

    default:
      throw new Error(`Unhandled action tool: ${toolName}`);
  }

  // Create pending action
  const { data, error } = await supabase
    .from('ai_pending_actions')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      action_type: actionType,
      action_payload: payload,
      explanation,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
