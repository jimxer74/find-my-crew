/**
 * AI Assistant Tool Executor
 *
 * Executes tool calls from the AI and returns results.
 * Uses shared utilities from @/app/lib/ai/shared for common operations.
 */

import { logger } from '@shared/logging';
import { SupabaseClient } from '@supabase/supabase-js';
import { ToolCall, ToolResult, AIPendingAction, ActionType } from './types';
import { isActionTool } from './tools';
import { BoundingBox, describeBbox } from '@shared/lib/geocoding/geocoding';
import { getLocationBbox, listRegions, getCategories } from '@shared/lib/geocoding/locations';
import { getAllRegions } from '@shared/lib/geocoding/locations';
import {
  normalizeBboxArgs,
  isValidBbox,
  findLegsInBbox,
  transformLeg,
} from '../shared';
import skillsConfig from '@/app/config/skills-config.json';

// Static definitions shared with owner/prospect services
const EXPERIENCE_LEVEL_DEFINITIONS = {
  1: { name: 'Beginner', description: 'New to sailing or have minimal experience. May have taken a basic sailing course or been on a few day sails.', typical_skills: 'Basic understanding of wind direction, can help with lines, basic safety awareness.' },
  2: { name: 'Competent Crew', description: 'Can steer, reef, and stand watch. Have completed several sailing trips and understand basic navigation.', typical_skills: 'Can handle lines, basic navigation, watch keeping, understands safety procedures.' },
  3: { name: 'Coastal Skipper', description: 'Experienced sailor who can skipper a boat in familiar waters. Can plan passages and handle most situations.', typical_skills: 'Passage planning, navigation, boat handling in various conditions, crew management.' },
  4: { name: 'Offshore Skipper', description: 'Highly experienced sailor capable of long ocean passages and handling challenging conditions.', typical_skills: 'Ocean navigation, heavy weather sailing, self-sufficiency, advanced seamanship.' },
};

const RISK_LEVEL_DEFINITIONS = {
  'Coastal sailing': { description: 'Sailing within sight of land or short distances between ports. Generally calmer conditions and easier access to shelter.', typical_conditions: 'Day sails, short coastal hops, protected waters. Usually within VHF range of coast guard.', experience_recommended: 'Beginner to Competent Crew' },
  'Offshore sailing': { description: 'Passages that take you out of sight of land for extended periods. Requires self-sufficiency and good weather planning.', typical_conditions: 'Multi-day passages, open water crossings, variable weather conditions. May be days from nearest port.', experience_recommended: 'Coastal Skipper or above' },
  'Extreme sailing': { description: 'Challenging conditions including high latitude sailing, ocean crossings, or expeditions to remote areas.', typical_conditions: 'Heavy weather, ice navigation, very long passages, limited rescue options. Weeks from nearest port.', experience_recommended: 'Offshore Skipper with specific experience' },
};

const SAILING_SKILLS = skillsConfig.general.map((s: { name: string }) => s.name);

function normalizeRiskLevel(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  function toArray(val: unknown): string[] {
    if (Array.isArray(val)) return val.flatMap(v => (typeof v === 'string' ? [v.trim()] : toArray(v))).filter(Boolean);
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) { try { return toArray(JSON.parse(trimmed)); } catch { return trimmed.length > 0 ? [trimmed] : []; } }
      return trimmed.length > 0 ? [trimmed] : [];
    }
    return [];
  }
  const validValues = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
  const arr = toArray(value).filter(v => v && validValues.includes(v) && !v.includes('[') && !v.includes(']'));
  return arr.length > 0 ? arr : null;
}

function normalizeSailingExperience(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') { if (value >= 1 && value <= 4) return Math.round(value); return 2; }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const numMatch = trimmed.match(/\b([1-4])\b/);
    if (numMatch) return parseInt(numMatch[1], 10);
    const lower = trimmed.toLowerCase();
    if (lower.includes('beginner')) return 1;
    if (lower.includes('competent')) return 2;
    if (lower.includes('coastal')) return 3;
    if (lower.includes('offshore')) return 4;
    return 2;
  }
  return 2;
}

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[Tool Executor] ${message}`, data !== undefined ? (data as Record<string, any>) : undefined);
  }
};

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

      case 'search_matching_crew':
        result = await searchMatchingCrewTool(supabase, userId, args);
        break;

      case 'fetch_all_boats':
        result = await fetchAllBoats(supabase, userId, args);
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

      // ── Static definition tools (public) ──────────────────────────────────

      case 'get_experience_level_definitions':
        result = EXPERIENCE_LEVEL_DEFINITIONS;
        break;

      case 'get_risk_level_definitions':
        result = RISK_LEVEL_DEFINITIONS;
        break;

      case 'get_skills_definitions':
        result = { skills: SAILING_SKILLS, skillsStructure: skillsConfig.general, note: 'Use ONLY these exact skill names.' };
        break;

      // ── Authenticated tools ────────────────────────────────────────────────

      case 'get_profile_completion_status':
        result = await getProfileCompletionStatus(supabase, userId);
        break;

      case 'update_user_profile':
        result = await updateUserProfileTool(supabase, userId, args);
        break;

      // ── Owner-only tools ───────────────────────────────────────────────────

      case 'fetch_boat_details_from_sailboatdata':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await fetchBoatDetailsFromSailboatdata(args);
        break;

      case 'get_boat_completion_status':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await getBoatCompletionStatus(supabase, userId, args);
        break;

      case 'get_journey_completion_status':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await getJourneyCompletionStatus(supabase, userId, args);
        break;

      case 'generate_journey_route':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await generateJourneyRouteTool(supabase, userId, args);
        break;

      case 'create_boat':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await createBoatTool(supabase, userId, args);
        break;

      case 'create_journey':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await createJourneyTool(supabase, userId, args);
        break;

      case 'create_leg':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await createLegTool(supabase, userId, args);
        break;

      // ── Boat management query tools (owner) ───────────────────────────────

      case 'get_boat_equipment':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await getBoatEquipmentTool(supabase, userId, args);
        break;

      case 'get_boat_inventory':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await getBoatInventoryTool(supabase, userId, args);
        break;

      case 'get_maintenance_tasks':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await getMaintenanceTasksTool(supabase, userId, args);
        break;

      case 'get_boat_management_summary':
        if (!userRoles.includes('owner')) throw new Error('This action requires owner role');
        result = await getBoatManagementSummaryTool(supabase, userId, args);
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

// Note: normalizeBboxArgs is now imported from shared utilities

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
        make_model,
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
  // Filter by boat type
  if (args.boatType) {
    query = query.eq('boats.type', args.boatType);
  }
  // Filter by boat make and model using ILIKE for case-insensitive partial matching
  if (args.makeModel) {
    query = query.ilike('boats.make_model', `%${args.makeModel}%`);
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
        images,
        boats!inner (
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
  // Filter by boat type
  if (args.boatType) {
    query = query.eq('journeys.boats.type', args.boatType);
  }
  // Filter by boat make and model using ILIKE for case-insensitive partial matching
  if (args.makeModel) {
    query = query.ilike('journeys.boats.make_model', `%${args.makeModel}%`);
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
      waypoints: undefined,
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
        images,
        boats!inner (
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

  // Filter by boat type
  if (args.boatType) {
    query = query.eq('journeys.boats.type', args.boatType);
  }
  // Filter by boat make and model using ILIKE for case-insensitive partial matching
  if (args.makeModel) {
    query = query.ilike('journeys.boats.make_model', `%${args.makeModel}%`);
  }

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

  // Filter by boat type if specified (additional filtering for cases where SQL filtering didn't work)
  if (args.boatType) {
    filteredLegs = filteredLegs.filter((leg: any) => {
      const boatType = leg.journeys?.boats?.type;
      return boatType === args.boatType;
    });
  }

  // Filter by boat make and model if specified (additional filtering for cases where SQL filtering didn't work)
  if (args.makeModel) {
    filteredLegs = filteredLegs.filter((leg: any) => {
      const makeModel = leg.journeys?.boats?.make_model;
      if (!makeModel) return false;
      return makeModel.toLowerCase().includes((args.makeModel as string).toLowerCase());
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

  // Check if spatial matches were filtered out by dates
  // This helps users understand that legs exist but not in their date range
  let message: string | undefined;
  let dateAvailability: {
    spatialMatchCount: number;
    earliestDate: string;
    latestDate: string;
    searchedStartDate: string;
    searchedEndDate: string;
  } | undefined;

  if (filteredLegs.length === 0 && matchingLegIds.length > 0 && (args.startDate || args.endDate)) {
    log('Spatial matches filtered by dates - checking date availability');
    const dateRange = await getLegsDateRange(supabase, matchingLegIds);

    if (dateRange && dateRange.count > 0) {
      const locationDesc = departureDescription || arrivalDescription || 'this area';
      const searchedRange = args.startDate && args.endDate
        ? `${formatDateForDisplay(args.startDate as string)} to ${formatDateForDisplay(args.endDate as string)}`
        : args.startDate
        ? `from ${formatDateForDisplay(args.startDate as string)} onwards`
        : `until ${formatDateForDisplay(args.endDate as string)}`;

      const availableRange = dateRange.earliestDate === dateRange.latestDate
        ? formatDateForDisplay(dateRange.earliestDate)
        : `${formatDateForDisplay(dateRange.earliestDate)} to ${formatDateForDisplay(dateRange.latestDate)}`;

      message = `I found ${dateRange.count} sailing ${dateRange.count === 1 ? 'leg' : 'legs'} in ${locationDesc}, but ${dateRange.count === 1 ? "it's" : "they're"} scheduled for ${availableRange}, which is outside your search dates (${searchedRange}). Would you like me to search with different dates?`;

      dateAvailability = {
        spatialMatchCount: dateRange.count,
        earliestDate: dateRange.earliestDate,
        latestDate: dateRange.latestDate,
        searchedStartDate: (args.startDate as string) || '',
        searchedEndDate: (args.endDate as string) || '',
      };

      log('Date availability info:', dateAvailability);
    }
  }

  return {
    legs: filteredLegs,
    count: filteredLegs.length,
    searchedDeparture: departureDescription,
    searchedArrival: arrivalDescription,
    departureArea: departureBbox ? describeBbox(departureBbox) : null,
    arrivalArea: arrivalBbox ? describeBbox(arrivalBbox) : null,
    message,
    dateAvailability,
  };
}

// Note: isValidBbox, findLegsInBbox, extractCoordinates, and isPointInBbox
// are now imported from '../shared' to avoid code duplication

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
          make_model,
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
        make_model,
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

async function fetchAllBoats(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
) {
  const { limit = 50, includePerformance = false, boatType, homePort, makeModel, includeImages = true } = args;

  // Check if user is owner
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', userId)
    .single();

  const isOwner = profile?.roles?.includes('owner');

  let query = supabase.from('boats').select('id, name, type, make_model, capacity, home_port, country_flag, loa_m, lwl_m, beam_m, max_draft_m, displcmt_m, ballast_kg, sail_area_sqm, average_speed_knots, link_to_specs, images, characteristics, capabilities, accommodations, sa_displ_ratio, ballast_displ_ratio, displ_len_ratio, comfort_ratio, capsize_screening, hull_speed_knots, ppi_pounds_per_inch, created_at, updated_at');

  if (isOwner) {
    // Owners see their own boats
    query = query.eq('owner_id', userId);
  } else {
    // Crew see boats with published journeys
    // Use a subquery approach to filter boats that have published journeys
    const publishedBoatIds = await supabase
      .from('journeys')
      .select('boat_id')
      .eq('state', 'Published')
      .not('boat_id', 'is', null);

    if (publishedBoatIds.error) {
      throw publishedBoatIds.error;
    }

    const boatIds = publishedBoatIds.data?.map(j => j.boat_id) || [];
    if (boatIds.length === 0) {
      // No published journeys, return empty result
      return { boats: [], count: 0, totalCount: 0, userType: 'crew' };
    }

    query = query.in('id', boatIds);
  }

  // Apply filters
  if (boatType) {
    query = query.eq('type', boatType);
  }
  if (homePort) {
    query = query.ilike('home_port', `%${homePort}%`);
  }
  if (makeModel) {
    query = query.ilike('make_model', `%${makeModel}%`);
  }

  // Apply limit (with proper type casting)
  query = query.limit(Number(limit) || 50);

  const { data, error } = await query;

  if (error) throw error;

  // Filter out sensitive fields based on permissions and includeImages setting
  const filteredBoats = (data || []).map(boat => {
    // Handle both direct boat objects (for owners) and joined boat objects (for crew)
    const boatData = (boat as any).boats || boat;

    const result: any = {
      id: boatData.id,
      name: boatData.name,
      type: boatData.type,
      make_model: boatData.make_model,
      capacity: boatData.capacity,
      home_port: boatData.home_port,
      country_flag: boatData.country_flag,
    };

    // Always include basic performance metrics
    if (boatData.loa_m) result.loa_m = boatData.loa_m;
    if (boatData.lwl_m) result.lwl_m = boatData.lwl_m;
    if (boatData.beam_m) result.beam_m = boatData.beam_m;
    if (boatData.max_draft_m) result.max_draft_m = boatData.max_draft_m;
    if (boatData.displcmt_m) result.displcmt_m = boatData.displcmt_m;

    // Include detailed performance metrics only if requested
    if (includePerformance) {
      if (boatData.sail_area_sqm) result.sail_area_sqm = boatData.sail_area_sqm;
      if (boatData.average_speed_knots) result.average_speed_knots = boatData.average_speed_knots;
      if (boatData.sa_displ_ratio) result.sa_displ_ratio = boatData.sa_displ_ratio;
      if (boatData.ballast_displ_ratio) result.ballast_displ_ratio = boatData.ballast_displ_ratio;
      if (boatData.displ_len_ratio) result.displ_len_ratio = boatData.displ_len_ratio;
      if (boatData.cbr) result.cbr = boatData.cbr;
      if (boatData.hsc) result.hsc = boatData.hsc;
      if (boatData.dsf) result.dsf = boatData.dsf;
    }

    // Include descriptions
    if (boatData.characteristics) result.characteristics = boatData.characteristics;
    if (boatData.capabilities) result.capabilities = boatData.capabilities;
    if (boat.accommodations) result.accommodations = boat.accommodations;

    // Include images if requested
    if (includeImages && boat.images && boat.images.length > 0) {
      result.images = boat.images;
    }

    // For crew, include journey count for context
    if (!isOwner && (boat as any).journeys) {
      result.published_journeys_count = (boat as any).journeys.length;
    }

    return result;
  });

  return {
    boats: filteredBoats,
    count: filteredBoats.length,
    totalCount: isOwner ? (data || []).length : filteredBoats.length,
    userType: isOwner ? 'owner' : 'crew',
  };
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

async function searchMatchingCrewTool(
  supabase: SupabaseClient,
  userId: string | null,
  args: Record<string, unknown>
) {
  const { searchMatchingCrew } = await import('@/app/lib/crew/matching-service');
  
  // Build search parameters
  const params: any = {
    experienceLevel: args.experienceLevel as number | undefined,
    riskLevels: args.riskLevels as string[] | undefined,
    skills: args.skills as string[] | undefined,
    limit: args.limit as number | undefined,
    includePrivateInfo: !!userId, // Only include names/images if authenticated
  };
  
  // Handle location parameter
  if (args.location && typeof args.location === 'object') {
    const loc = args.location as Record<string, unknown>;
    params.location = {
      lat: loc.lat as number,
      lng: loc.lng as number,
      radius: loc.radius as number | undefined,
    };
  }
  
  // Handle dateRange parameter
  if (args.dateRange && typeof args.dateRange === 'object') {
    const dateRange = args.dateRange as Record<string, unknown>;
    params.dateRange = {
      start: dateRange.start as string,
      end: dateRange.end as string,
    };
  }
  
  const result = await searchMatchingCrew(supabase, params);
  
  log(`Found ${result.matches.length} matching crew members (total: ${result.totalCount})`);
  
  return {
    success: true,
    matches: result.matches,
    totalCount: result.totalCount,
    isAuthenticated: !!userId,
    note: userId 
      ? 'Full crew profiles shown (authenticated user)'
      : 'Anonymized profiles shown (sign up to see full details)',
  };
}

async function getOwnerBoats(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('boats')
    .select('id, name, make_model, type, home_port, capacity')
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
// Helper functions for input metadata
// ============================================================================

/**
 * Get input prompt for profile update actions
 */
function getInputPrompt(actionType: ActionType): string | undefined {
  switch (actionType) {
    case 'update_profile_user_description':
      return 'What would you like your new user description to be?';
    case 'update_profile_certifications':
      return 'What certifications would you like to add or update?';
    case 'update_profile_risk_level':
      return 'Which risk levels would you like to select?';
    case 'update_profile_sailing_preferences':
      return 'What sailing preferences would you like to update?';
    case 'update_profile_skills':
      return 'Which skills would you like to add or update?';
    default:
      return undefined;
  }
}

/**
 * Get input type for profile update actions
 */
function getInputType(actionType: ActionType): 'text' | 'text_array' | 'select' | undefined {
  switch (actionType) {
    case 'update_profile_user_description':
    case 'update_profile_certifications':
    case 'update_profile_sailing_preferences':
      return 'text';
    case 'update_profile_risk_level':
    case 'update_profile_skills':
      return 'select';
    default:
      return undefined;
  }
}

/**
 * Get input options for select-type inputs
 */
function getInputOptions(actionType: ActionType): string[] | undefined {
  switch (actionType) {
    case 'update_profile_risk_level':
      return ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    case 'update_profile_skills':
      return [
        'Navigation',
        'Sailing',
        'Engine Maintenance',
        'Electronics',
        'Cooking',
        'First Aid',
        'Photography',
        'Teaching'
      ];
    default:
      return undefined;
  }
}

/**
 * Get profile field mapping for profile update actions
 */
function getProfileField(actionType: ActionType): string | undefined {
  switch (actionType) {
    case 'update_profile_user_description':
      return 'user_description';
    case 'update_profile_certifications':
      return 'certifications';
    case 'update_profile_risk_level':
      return 'risk_level';
    case 'update_profile_sailing_preferences':
      return 'sailing_preferences';
    case 'update_profile_skills':
      return 'skills';
    case 'refine_skills':
      return 'skills';
    default:
      return undefined;
  }
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
    submit_leg_registration: 'register_for_leg',
    suggest_profile_update_user_description: 'update_profile_user_description',
    suggest_profile_update_certifications: 'update_profile_certifications',
    suggest_profile_update_risk_level: 'update_profile_risk_level',
    suggest_profile_update_sailing_preferences: 'update_profile_sailing_preferences',
    suggest_profile_update_skills: 'update_profile_skills',
    suggest_skills_refinement: 'refine_skills',
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

    case 'submit_leg_registration': {
      // Validate required parameters for conversational registration
      if (!args.legId) {
        throw new Error('Missing required parameter: legId. Please provide the ID of the leg to register for.');
      }
      if (!args.answers || !Array.isArray(args.answers)) {
        throw new Error('Missing required parameter: answers. Please provide an array of answers to registration questions.');
      }

      // Validate each answer has requirement_id
      for (const answer of args.answers as any[]) {
        if (!answer.requirement_id) {
          throw new Error('Each answer must include a requirement_id.');
        }
        if (!answer.answer_text && answer.answer_json === undefined) {
          throw new Error(`Answer for requirement ${answer.requirement_id} must include either answer_text or answer_json.`);
        }
      }

      payload = {
        legId: args.legId,
        answers: args.answers,
        notes: args.notes || null,
      };
      explanation = 'Registration for this sailing leg with your answers to the registration questions. Click Approve to submit your registration.';
      break;
    }

    case 'suggest_profile_update_user_description':
    case 'suggest_profile_update_certifications':
    case 'suggest_profile_update_risk_level':
    case 'suggest_profile_update_sailing_preferences':
    case 'suggest_profile_update_skills': {
      // Validate required parameters
      if (!args.reason || typeof args.reason !== 'string' || args.reason.trim() === '') {
        throw new Error('Missing required parameter: reason. Please provide an explanation of why this profile field should be updated.');
      }
      if (!args.suggestedField) {
        throw new Error('Missing required parameter: suggestedField. Please specify which field to update.');
      }

      // For suggestion tools, do NOT include newValue - user should provide it when approving
      payload = { suggestedField: args.suggestedField };
      explanation = args.reason as string;
      break;
    }

    case 'suggest_skills_refinement': {
      // Validate required parameters
      if (!args.reason || typeof args.reason !== 'string' || args.reason.trim() === '') {
        throw new Error('Missing required parameter: reason. Please provide an explanation of why these skills should be refined.');
      }
      if (!args.suggestedField || args.suggestedField !== 'skills') {
        throw new Error('Missing required parameter: suggestedField must be "skills".');
      }
      if (!args.targetSkills || !Array.isArray(args.targetSkills) || args.targetSkills.length === 0) {
        throw new Error('Missing required parameter: targetSkills. Please provide an array of skill names to refine.');
      }

      payload = {
        targetSkills: args.targetSkills,
        userProvidedDescriptions: args.userProvidedDescriptions
      };
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

  // Determine field-specific metadata for new action types
  let fieldType: string | null = null;
  let suggestedValue: string | null = null;

  if (actionType.startsWith('update_profile_')) {
    fieldType = actionType.replace('update_profile_', '');
    if (payload.newValue !== undefined) {
      suggestedValue = typeof payload.newValue === 'string'
        ? payload.newValue
        : JSON.stringify(payload.newValue);
    }
  } else if (actionType === 'refine_skills' && payload.targetSkills) {
    fieldType = 'skills';
    suggestedValue = Array.isArray(payload.targetSkills)
      ? payload.targetSkills.join(', ')
      : JSON.stringify(payload.targetSkills);
  }

  // Create pending action with input metadata for profile update actions
  const { data, error } = await supabase
    .from('ai_pending_actions')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      action_type: actionType,
      action_payload: payload,
      explanation,
      status: 'pending',
      field_type: fieldType,
      suggested_value: suggestedValue,
      // Add input metadata for profile update actions
      input_prompt: getInputPrompt(actionType),
      input_type: getInputType(actionType),
      input_options: getInputOptions(actionType),
      // Add profile field mapping for profile update actions
      profile_field: getProfileField(actionType),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Additional tool implementations (role-based: public, authenticated, owner)
// ============================================================================

async function getProfileCompletionStatus(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  const requiredFields = ['full_name', 'user_description', 'sailing_experience', 'risk_level', 'skills'];
  const filledFields: string[] = [];
  const missingFields: string[] = [];
  for (const field of requiredFields) {
    const value = profile?.[field];
    if (value && (Array.isArray(value) ? value.length > 0 : true)) { filledFields.push(field); } else { missingFields.push(field); }
  }
  const completionPercentage = Math.round((filledFields.length / requiredFields.length) * 100);
  return { filledFields, missingFields, completionPercentage, profile: profile ? { full_name: profile.full_name, user_description: profile.user_description, sailing_experience: profile.sailing_experience, risk_level: profile.risk_level, skills: profile.skills, roles: profile.roles } : null };
}

async function updateUserProfileTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const allowedFields = ['full_name', 'user_description', 'sailing_experience', 'risk_level', 'skills', 'sailing_preferences', 'certifications', 'phone', 'profile_image_url', 'preferred_departure_location', 'preferred_arrival_location', 'availability_start_date', 'availability_end_date'];
  // Accept both snake_case (original) and camelCase (from normalizeArgs)
  const fieldAliasMap: Record<string, string> = { riskLevel: 'risk_level', sailingExperience: 'sailing_experience', fullName: 'full_name', userDescription: 'user_description', sailingPreferences: 'sailing_preferences', profileImageUrl: 'profile_image_url', preferredDepartureLocation: 'preferred_departure_location', preferredArrivalLocation: 'preferred_arrival_location', availabilityStartDate: 'availability_start_date', availabilityEndDate: 'availability_end_date', risk_levels: 'risk_level', comfort_zones: 'risk_level', avatar_url: 'profile_image_url', bio: 'user_description', description: 'user_description', experience_level: 'sailing_experience' };
  for (const [alias, canonical] of Object.entries(fieldAliasMap)) {
    if (args[alias] !== undefined && args[canonical] === undefined) args[canonical] = args[alias];
  }
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (args[field] === undefined) continue;
    let value = args[field];
    if (field === 'risk_level') {
      value = normalizeRiskLevel(value);
    } else if (field === 'sailing_experience') {
      value = normalizeSailingExperience(value);
    } else if (field === 'skills') {
      let skillsArray: unknown[] = Array.isArray(value) ? value : typeof value === 'string' ? (() => { try { const p = JSON.parse(value as string); return Array.isArray(p) ? p : [p]; } catch { return [value]; } })() : [value];
      const validSkillNames = new Set(SAILING_SKILLS);
      const normalizedSkills: Array<{ skill_name: string; description: string }> = [];
      for (const skill of skillsArray) {
        if (typeof skill === 'string' && validSkillNames.has(skill)) { normalizedSkills.push({ skill_name: skill, description: '' }); }
        else if (skill && typeof skill === 'object') { const s = skill as Record<string, unknown>; const sn = (s.skill_name || s.name) as string | undefined; if (sn && validSkillNames.has(sn)) normalizedSkills.push({ skill_name: sn, description: (s.description || '') as string }); }
      }
      value = normalizedSkills;
    } else if (field === 'preferred_departure_location' || field === 'preferred_arrival_location') {
      if (value && typeof value === 'object') {
        const loc = value as Record<string, unknown>;
        if (typeof loc.name === 'string' && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          const normalized: Record<string, unknown> = { name: loc.name, lat: loc.lat, lng: loc.lng };
          if (typeof loc.isCruisingRegion === 'boolean') normalized.isCruisingRegion = loc.isCruisingRegion;
          if (loc.bbox && typeof loc.bbox === 'object') normalized.bbox = loc.bbox;
          if (!normalized.bbox) {
            const regionMatch = getAllRegions().find((r: { name: string; aliases: string[]; bbox: Record<string, number> }) => r.name.toLowerCase() === (loc.name as string).toLowerCase().trim() || r.aliases.some((a: string) => a.toLowerCase() === (loc.name as string).toLowerCase().trim()));
            if (regionMatch) { normalized.isCruisingRegion = true; normalized.bbox = { ...regionMatch.bbox }; }
          }
          value = normalized;
        } else { continue; }
      } else { continue; }
    } else if (field === 'availability_start_date' || field === 'availability_end_date') {
      if (typeof value === 'string') { const m = value.match(/^\d{4}-\d{2}-\d{2}/); if (m) value = m[0]; else continue; } else { continue; }
    }
    updates[field] = value;
  }
  if (Object.keys(updates).length === 0) return { success: false, error: 'No valid fields provided to update' };
  updates.updated_at = new Date().toISOString();
  const { data: existingProfile } = await supabase.from('profiles').select('id, username, roles').eq('id', userId).single();
  if (existingProfile) {
    const existingRoles = existingProfile.roles as string[] | null;
    if (!updates.roles) updates.roles = existingRoles || [];
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) return { success: false, error: `Failed to update profile: ${error.message}` };
    return { success: true, operation: 'update', updatedFields: Object.keys(updates).filter(k => k !== 'updated_at') };
  } else {
    const baseName = (updates.full_name as string) ? (updates.full_name as string).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) : `user_${userId.substring(0, 8)}`;
    const username = `${baseName}_${Date.now().toString(36)}`;
    let email: string | undefined;
    try { const { data: authUser } = await supabase.auth.getUser(); email = authUser?.user?.email || undefined; } catch { /* optional */ }
    const insertData: Record<string, unknown> = { id: userId, username, ...updates, created_at: new Date().toISOString() };
    if (email) insertData.email = email;
    if (!insertData.roles) insertData.roles = [];
    const { error } = await supabase.from('profiles').insert(insertData);
    if (error) return { success: false, error: `Failed to create profile: ${error.message}` };
    return { success: true, operation: 'insert', updatedFields: Object.keys(updates).filter(k => k !== 'updated_at' && k !== 'created_at') };
  }
}

async function fetchBoatDetailsFromSailboatdata(args: Record<string, unknown>) {
  const make_model = (args.makeModel as string) || (args.make_model as string) || ((args.make && args.model) ? `${args.make} ${args.model}`.trim() : undefined) || (args.make as string) || (args.model as string);
  const slug = (args.slug as string) || undefined;
  if (!make_model) return { error: 'make_model is required (e.g. "Bavaria 46")' };
  try {
    const { lookupBoatRegistry, registryToSailboatDetails } = await import('@shared/lib/boat-registry/service');
    const registryEntry = await lookupBoatRegistry(make_model.trim(), slug?.trim());
    if (registryEntry && registryEntry.characteristics && registryEntry.capabilities && registryEntry.accommodations) {
      return registryToSailboatDetails(registryEntry);
    }
    const { fetchSailboatDetails } = await import('@/app/lib/sailboatdata_queries');
    const details = await fetchSailboatDetails(make_model.trim(), slug?.trim());
    const needsAIFallback = !details || !details.capabilities || details.capabilities.trim() === '' || !details.accommodations || details.accommodations.trim() === '';
    if (details && !needsAIFallback) {
      return { type: details.type || null, capacity: details.capacity ?? null, loa_m: details.loa_m ?? null, beam_m: details.beam_m ?? null, max_draft_m: details.max_draft_m ?? null, displcmt_m: details.displcmt_m ?? null, average_speed_knots: details.average_speed_knots ?? null, characteristics: details.characteristics || '', capabilities: details.capabilities || '', accommodations: details.accommodations || '', link_to_specs: details.link_to_specs || '', sa_displ_ratio: details.sa_displ_ratio ?? null, ballast_displ_ratio: details.ballast_displ_ratio ?? null, displ_len_ratio: details.displ_len_ratio ?? null, comfort_ratio: details.comfort_ratio ?? null, capsize_screening: details.capsize_screening ?? null, hull_speed_knots: details.hull_speed_knots ?? null, ppi_pounds_per_inch: details.ppi_pounds_per_inch ?? null };
    }
    const { callAI, parseJsonObjectFromAIResponse } = await import('@shared/ai');
    const aiResult = await callAI({ useCase: 'boat-details', prompt: `You are a sailing expert. Provide comprehensive JSON details about the sailboat: "${make_model.trim()}". Return ONLY a JSON object with: type (one of: Daysailers, Coastal cruisers, Traditional offshore cruisers, Performance cruisers, Multihulls, Expedition sailboats), capacity (number), loa_m, beam_m, displcmt_m, average_speed_knots, characteristics, capabilities, accommodations, link_to_specs, sa_displ_ratio, ballast_displ_ratio, displ_len_ratio, comfort_ratio, capsize_screening, hull_speed_knots, ppi_pounds_per_inch.` });
    const boatDetails = parseJsonObjectFromAIResponse(aiResult.text);
    const merged = { type: details?.type || boatDetails.type || null, capacity: details?.capacity ?? boatDetails.capacity ?? null, loa_m: details?.loa_m ?? boatDetails.loa_m ?? null, beam_m: details?.beam_m ?? boatDetails.beam_m ?? null, max_draft_m: details?.max_draft_m ?? boatDetails.max_draft_m ?? null, displcmt_m: details?.displcmt_m ?? boatDetails.displcmt_m ?? null, average_speed_knots: details?.average_speed_knots ?? boatDetails.average_speed_knots ?? null, characteristics: (details?.characteristics && details.characteristics.trim()) ? details.characteristics : (boatDetails.characteristics || ''), capabilities: boatDetails.capabilities || '', accommodations: boatDetails.accommodations || '', link_to_specs: details?.link_to_specs || boatDetails.link_to_specs || '', sa_displ_ratio: details?.sa_displ_ratio ?? boatDetails.sa_displ_ratio ?? null, ballast_displ_ratio: details?.ballast_displ_ratio ?? boatDetails.ballast_displ_ratio ?? null, displ_len_ratio: details?.displ_len_ratio ?? boatDetails.displ_len_ratio ?? null, comfort_ratio: details?.comfort_ratio ?? boatDetails.comfort_ratio ?? null, capsize_screening: details?.capsize_screening ?? boatDetails.capsize_screening ?? null, hull_speed_knots: details?.hull_speed_knots ?? boatDetails.hull_speed_knots ?? null, ppi_pounds_per_inch: details?.ppi_pounds_per_inch ?? boatDetails.ppi_pounds_per_inch ?? null };
    try { const { saveBoatRegistry } = await import('@shared/lib/boat-registry/service'); const slugFromLink = merged.link_to_specs ? merged.link_to_specs.match(/\/sailboat\/([^\/\?#]+)/)?.[1] : undefined; await saveBoatRegistry(make_model.trim(), merged as any, slugFromLink); } catch { /* non-critical */ }
    return merged;
  } catch (e: any) { return { error: e.message || 'Failed to fetch boat details' }; }
}

async function getBoatCompletionStatus(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const boatId = (args.boatId || args.boat_id) as string | undefined;
  if (boatId) {
    const { data: boat, error } = await supabase.from('boats').select('*').eq('id', boatId).eq('owner_id', userId).single();
    if (error || !boat) return { error: 'Boat not found' };
    const requiredFields = ['name', 'type', 'make_model', 'capacity'];
    const filledFields = requiredFields.filter(f => (boat as any)[f]);
    const missingFields = requiredFields.filter(f => !(boat as any)[f]);
    return { hasBoat: true, filledFields, missingFields, completionPercentage: Math.round((filledFields.length / requiredFields.length) * 100), boat };
  }
  const { data: boats } = await supabase.from('boats').select('id').eq('owner_id', userId).limit(1);
  return { hasBoat: (boats?.length || 0) > 0, boatCount: boats?.length || 0 };
}

async function getJourneyCompletionStatus(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const journeyId = (args.journeyId || args.journey_id) as string | undefined;
  if (journeyId) {
    const { data: journey, error } = await supabase.from('journeys').select('*, boats!inner(owner_id)').eq('id', journeyId).eq('boats.owner_id', userId).single();
    if (error || !journey) return { error: 'Journey not found' };
    const requiredFields = ['name', 'boat_id'];
    const filledFields = requiredFields.filter(f => (journey as any)[f]);
    const missingFields = requiredFields.filter(f => !(journey as any)[f]);
    return { hasJourney: true, filledFields, missingFields, completionPercentage: Math.round((filledFields.length / requiredFields.length) * 100), journey };
  }
  const { data: journeys } = await supabase.from('journeys').select('id, boats!inner(owner_id)').eq('boats.owner_id', userId).limit(1);
  return { hasJourney: (journeys?.length || 0) > 0, journeyCount: journeys?.length || 0 };
}

async function createJourneyAndLegsFromRoute(
  supabase: SupabaseClient,
  userId: string,
  boatId: string,
  routeData: { journeyName: string; description?: string; legs: Array<{ name: string; start_date?: string; end_date?: string; waypoints: Array<{ index: number; name: string; geocode: { type: string; coordinates: [number, number] } }> }> },
  metadata: { risk_level?: string[]; skills?: string[]; min_experience_level?: number; cost_model?: string; cost_info?: string; startDate?: string; endDate?: string }
): Promise<{ journeyId: string; journeyName: string; legsCreated: number; error?: string }> {
  const { data: boat } = await supabase.from('boats').select('owner_id').eq('id', boatId).eq('owner_id', userId).single();
  if (!boat) return { journeyId: '', journeyName: '', legsCreated: 0, error: 'Boat not found or you do not own this boat' };
  const firstLeg = routeData.legs[0];
  const lastLeg = routeData.legs[routeData.legs.length - 1];
  const validRiskLevels = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
  let rawRisk: unknown = metadata.risk_level;
  if (typeof rawRisk === 'string') { try { rawRisk = JSON.parse((rawRisk as string).trim()); } catch { rawRisk = []; } }
  const riskLevelArray = (Array.isArray(rawRisk) ? rawRisk as unknown[] : []).flat(2).filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(v => v && !v.includes('[') && !v.includes(']') && validRiskLevels.includes(v));
  const validCostModels = ['Shared contribution', 'Owner covers all costs', 'Crew pays a fee', 'Delivery/paid crew', 'Not defined'];
  const costModel = (metadata.cost_model && validCostModels.includes(metadata.cost_model)) ? metadata.cost_model : 'Not defined';
  const { data: journeyId, error: rpcError } = await supabase.rpc('insert_journey_with_risk', { p_boat_id: boatId, p_name: routeData.journeyName, p_description: routeData.description || null, p_start_date: firstLeg?.start_date ?? metadata.startDate ?? null, p_end_date: lastLeg?.end_date ?? metadata.endDate ?? null, p_risk_level: riskLevelArray, p_skills: metadata.skills || [], p_min_experience_level: metadata.min_experience_level ?? 1, p_cost_model: costModel, p_cost_info: metadata.cost_info || null, p_state: 'In planning', p_ai_prompt: null, p_is_ai_generated: true });
  if (rpcError || !journeyId) return { journeyId: '', journeyName: routeData.journeyName, legsCreated: 0, error: `Failed to create journey: ${rpcError?.message || 'Unknown error'}` };
  let legsCreated = 0;
  for (const leg of routeData.legs) {
    if (!leg.waypoints || leg.waypoints.length < 2) continue;
    const { data: legRecord } = await supabase.from('legs').insert({ journey_id: journeyId, name: leg.name, start_date: leg.start_date || null, end_date: leg.end_date || null, crew_needed: 1 }).select('id').single();
    if (!legRecord) continue;
    const waypointsForRPC = leg.waypoints.map(wp => ({ index: wp.index, name: wp.name, lng: wp.geocode.coordinates[0], lat: wp.geocode.coordinates[1] }));
    await supabase.rpc('insert_leg_waypoints', { leg_id_param: legRecord.id, waypoints_param: waypointsForRPC });
    legsCreated++;
  }
  return { journeyId, journeyName: routeData.journeyName, legsCreated };
}

async function generateJourneyRouteTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const startLocation = (args.startLocation || args.start_location) as { name: string; lat: number; lng: number };
  const endLocation = (args.endLocation || args.end_location) as { name: string; lat: number; lng: number };
  const boatId = (args.boatId || args.boat_id) as string;
  if (!startLocation || !endLocation || !boatId) return { error: 'startLocation, endLocation, and boatId are required' };
  const intermediateWaypoints = ((args.intermediateWaypoints || args.intermediate_waypoints || []) as Array<{ name: string; lat: number; lng: number }>);
  const startDate = (args.startDate || args.start_date) as string | undefined;
  const endDate = (args.endDate || args.end_date) as string | undefined;
  const waypointDensity = ((args.waypointDensity || args.waypoint_density || 'moderate') as 'minimal' | 'moderate' | 'detailed');
  try {
    let speed = args.boatSpeed as number | undefined;
    if (!speed) {
      const { data: boat } = await supabase.from('boats').select('average_speed_knots, hull_speed_knots').eq('id', boatId).eq('owner_id', userId).single();
      const hullSpeed = boat?.hull_speed_knots;
      speed = boat?.average_speed_knots ?? (typeof hullSpeed === 'number' && hullSpeed > 0 ? hullSpeed * 0.8 : undefined);
      if (speed && speed < 5) speed = 5;
    }
    const { generateJourneyRoute } = await import('@shared/ai');
    const journeyResult = await generateJourneyRoute({ startLocation, endLocation, intermediateWaypoints, boatId, startDate, endDate, useSpeedPlanning: !!speed, boatSpeed: speed, waypointDensity });
    if (!journeyResult.success) return { error: journeyResult.error };
    const routeData = journeyResult.data;
    if (!routeData || !routeData.journeyName || !routeData.legs) return { error: 'Invalid response from journey generation' };
    const validRiskLevels = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
    const normalizedRisk = (normalizeRiskLevel(args.risk_level || args.riskLevel) || []).filter((v: string) => !v.includes('[') && validRiskLevels.includes(v));
    const aiRisk = (routeData as any).riskLevel;
    const riskForCreate = (aiRisk && validRiskLevels.includes(aiRisk)) ? [aiRisk] : normalizedRisk;
    let normalizedSkills: string[] = [];
    if (Array.isArray(args.skills)) normalizedSkills = (args.skills as unknown[]).filter((s) => typeof s === 'string') as string[];
    else if (typeof args.skills === 'string') { try { const p = JSON.parse(args.skills); normalizedSkills = Array.isArray(p) ? p.filter((s: unknown) => typeof s === 'string') : []; } catch { normalizedSkills = []; } }
    const createResult = await createJourneyAndLegsFromRoute(supabase, userId, boatId, routeData, { risk_level: riskForCreate, skills: normalizedSkills, min_experience_level: ((args.minExperienceLevel || args.min_experience_level) as number | undefined), cost_model: ((args.costModel || args.cost_model) as string | undefined), cost_info: ((args.costInfo || args.cost_info) as string | undefined), startDate, endDate });
    if (createResult.error) return { error: createResult.error };
    return { journeyCreated: true, journeyId: createResult.journeyId, journeyName: createResult.journeyName, legsCreated: createResult.legsCreated, riskLevel: riskForCreate[0] ?? null, message: `Journey "${createResult.journeyName}" and ${createResult.legsCreated} leg(s) created as DRAFT. The user should review and publish it in their journeys section.` };
  } catch (e: any) { return { error: e.message || 'Failed to generate journey route' }; }
}

async function createBoatTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const normalizeBoatType = (type: string): string => {
    const n = type.toLowerCase().trim();
    if (n === 'multihull' || n === 'catamaran' || n === 'trimaran') return 'Multihulls';
    if (n.includes('daysail')) return 'Daysailers';
    if (n.includes('coastal')) return 'Coastal cruisers';
    if (n.includes('offshore') || n.includes('traditional')) return 'Traditional offshore cruisers';
    if (n.includes('performance')) return 'Performance cruisers';
    if (n.includes('expedition')) return 'Expedition sailboats';
    return type;
  };
  const { data: profile } = await supabase.from('profiles').select('roles').eq('id', userId).single();
  if (!profile || !(profile.roles as string[]).includes('owner')) return { error: 'User must have owner role to create boats' };
  const name = args.name as string;
  const type = args.type as string;
  const makeModel = ((args.makeModel || args.make_model) as string);
  const capacity = args.capacity as number;
  if (!name || !type || !makeModel || !capacity) return { error: 'name, type, make_model, and capacity are required' };
  const boatData: Record<string, unknown> = {
    owner_id: userId, name, type: normalizeBoatType(type), make_model: makeModel, capacity,
    home_port: ((args.homePort || args.home_port) ?? null) as string | null,
    country_flag: ((args.countryFlag || args.country_flag) ?? null) as string | null,
    loa_m: ((args.loaM || args.loa_m) ?? null) as number | null,
    beam_m: ((args.beamM || args.beam_m) ?? null) as number | null,
    max_draft_m: ((args.maxDraftM || args.max_draft_m) ?? null) as number | null,
    displcmt_m: ((args.displcmtM || args.displcmt_m) ?? null) as number | null,
    average_speed_knots: ((args.averageSpeedKnots || args.average_speed_knots) ?? null) as number | null,
    link_to_specs: ((args.linkToSpecs || args.link_to_specs) ?? null) as string | null,
    characteristics: (args.characteristics ?? null) as string | null,
    capabilities: (args.capabilities ?? null) as string | null,
    accommodations: (args.accommodations ?? null) as string | null,
    sa_displ_ratio: ((args.saDisplRatio || args.sa_displ_ratio) ?? null) as number | null,
    ballast_displ_ratio: ((args.ballastDisplRatio || args.ballast_displ_ratio) ?? null) as number | null,
    displ_len_ratio: ((args.displLenRatio || args.displ_len_ratio) ?? null) as number | null,
    comfort_ratio: ((args.comfortRatio || args.comfort_ratio) ?? null) as number | null,
    capsize_screening: ((args.capsizeScreening || args.capsize_screening) ?? null) as number | null,
    hull_speed_knots: ((args.hullSpeedKnots || args.hull_speed_knots) ?? null) as number | null,
    ppi_pounds_per_inch: ((args.ppiPoundsPerInch || args.ppi_pounds_per_inch) ?? null) as number | null,
  };
  const { data: existing } = await supabase.from('boats').select('id, name, make_model').eq('owner_id', userId);
  const dupByName = existing?.find(b => b.name.toLowerCase().trim() === name.toLowerCase().trim());
  if (dupByName) return { boatAlreadyExists: true, boatId: dupByName.id, boatName: dupByName.name, message: `Boat "${dupByName.name}" already exists. Proceed to create a journey.` };
  const dupByModel = existing?.find(b => b.make_model && b.make_model.toLowerCase().trim() === makeModel.toLowerCase().trim());
  if (dupByModel) return { boatAlreadyExists: true, boatId: dupByModel.id, boatName: dupByModel.name, message: `A boat with make/model "${makeModel}" already exists. Proceed to create a journey.` };
  const { data, error } = await supabase.from('boats').insert(boatData).select('id, name').single();
  if (error) return { error: `Failed to create boat: ${error.message}` };
  return { success: true, boatId: data.id, boatName: data.name, message: `Boat "${data.name}" created successfully` };
}

async function createJourneyTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const boatId = ((args.boatId || args.boat_id) as string);
  const name = args.name as string;
  if (!boatId || !name) return { error: 'boat_id and name are required' };
  const { data: boat } = await supabase.from('boats').select('owner_id').eq('id', boatId).eq('owner_id', userId).single();
  if (!boat) return { error: 'Boat not found or you do not own this boat' };
  const validRiskLevels = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
  const riskLevel = (normalizeRiskLevel(args.riskLevel || args.risk_level) || []).filter((v: string) => validRiskLevels.includes(v));
  const validCostModels = ['Shared contribution', 'Owner covers all costs', 'Crew pays a fee', 'Delivery/paid crew', 'Not defined'];
  const costModel = ((args.costModel || args.cost_model) as string | undefined);
  const { data: journeyId, error } = await supabase.rpc('insert_journey_with_risk', {
    p_boat_id: boatId, p_name: name,
    p_description: ((args.description) ?? null) as string | null,
    p_start_date: ((args.startDate || args.start_date) ?? null) as string | null,
    p_end_date: ((args.endDate || args.end_date) ?? null) as string | null,
    p_risk_level: riskLevel, p_skills: ((args.skills || []) as string[]),
    p_min_experience_level: (((args.minExperienceLevel || args.min_experience_level) ?? 1) as number),
    p_cost_model: (costModel && validCostModels.includes(costModel)) ? costModel : 'Not defined',
    p_cost_info: ((args.costInfo || args.cost_info) ?? null) as string | null,
    p_state: 'In planning', p_ai_prompt: null, p_is_ai_generated: false,
  });
  if (error) return { error: `Failed to create journey: ${error.message}` };
  return { success: true, journeyId, journeyName: name, message: `Journey "${name}" created as DRAFT. Review and publish it in your journeys section.` };
}

async function createLegTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const journeyId = ((args.journeyId || args.journey_id) as string);
  const name = args.name as string;
  const waypoints = ((args.waypoints || []) as Array<{ index: number; name: string; geocode: { type: string; coordinates: [number, number] } }>);
  if (!journeyId || !name) return { error: 'journey_id and name are required' };
  const { data: journey } = await supabase.from('journeys').select('id, boats!inner(owner_id)').eq('id', journeyId).eq('boats.owner_id', userId).single();
  if (!journey) return { error: 'Journey not found or you do not own it' };
  const { data: leg, error } = await supabase.from('legs').insert({ journey_id: journeyId, name, start_date: ((args.startDate || args.start_date) ?? null) as string | null, end_date: ((args.endDate || args.end_date) ?? null) as string | null, crew_needed: ((args.crewNeeded || args.crew_needed || 1) as number) }).select('id').single();
  if (error) return { error: `Failed to create leg: ${error.message}` };
  if (waypoints.length >= 2) {
    const waypointsForRPC = waypoints.map(wp => ({ index: wp.index, name: wp.name, lng: wp.geocode.coordinates[0], lat: wp.geocode.coordinates[1] }));
    const { error: wpErr } = await supabase.rpc('insert_leg_waypoints', { leg_id_param: leg.id, waypoints_param: waypointsForRPC });
    if (wpErr) log(`Warning: failed to insert waypoints for leg ${leg.id}: ${wpErr.message}`);
  }
  return { success: true, legId: leg.id, legName: name, message: `Leg "${name}" created successfully` };
}

async function getBoatEquipmentTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const boatId = (args.boatId || args.boat_id) as string;
  if (!boatId) return { error: 'boat_id is required' };
  const { data: boat } = await supabase.from('boats').select('id, name').eq('id', boatId).eq('owner_id', userId).single();
  if (!boat) return { error: 'Boat not found or you do not own this boat' };

  let query = supabase
    .from('boat_equipment')
    .select('id, name, category, subcategory, manufacturer, model, status, quantity, serial_number, year_installed, service_date, next_service_date, expiry_date, notes')
    .eq('boat_id', boatId);

  const category = args.category as string | undefined;
  if (category) query = query.eq('category', category);

  const status = args.status as string | undefined;
  if (status) query = query.eq('status', status);

  const dueSoonDays = (args.dueSoonDays || args.due_soon_days) as number | undefined;
  if (dueSoonDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + dueSoonDays);
    query = query.lte('next_service_date', cutoff.toISOString().split('T')[0]).not('next_service_date', 'is', null);
  }

  query = query.order('category').order('name').limit(50);
  const { data, error } = await query;
  if (error) return { error: `Failed to fetch equipment: ${error.message}` };

  return {
    boatId: boat.id,
    boatName: boat.name,
    equipment: data || [],
    count: (data || []).length,
  };
}

async function getBoatInventoryTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const boatId = (args.boatId || args.boat_id) as string;
  if (!boatId) return { error: 'boat_id is required' };
  const { data: boat } = await supabase.from('boats').select('id, name').eq('id', boatId).eq('owner_id', userId).single();
  if (!boat) return { error: 'Boat not found or you do not own this boat' };

  let query = supabase
    .from('boat_inventory')
    .select('id, name, category, quantity, min_quantity, unit, location, supplier, part_number, cost, currency, expiry_date, notes, equipment_id')
    .eq('boat_id', boatId);

  const equipmentId = (args.equipmentId || args.equipment_id) as string | undefined;
  if (equipmentId) query = query.eq('equipment_id', equipmentId);

  const category = args.category as string | undefined;
  if (category) query = query.eq('category', category);

  const lowStockOnly = (args.lowStockOnly || args.low_stock_only) as boolean | undefined;

  query = query.order('category').order('name').limit(100);
  const { data, error } = await query;
  if (error) return { error: `Failed to fetch inventory: ${error.message}` };

  let items = data || [];
  if (lowStockOnly) items = items.filter((i: Record<string, unknown>) => (i.quantity as number) < ((i.min_quantity as number) || 1));

  return {
    boatId: boat.id,
    boatName: boat.name,
    inventory: items,
    count: items.length,
    lowStockCount: (data || []).filter((i: Record<string, unknown>) => (i.quantity as number) < ((i.min_quantity as number) || 1)).length,
  };
}

async function getMaintenanceTasksTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const boatId = (args.boatId || args.boat_id) as string;
  if (!boatId) return { error: 'boat_id is required' };
  const { data: boat } = await supabase.from('boats').select('id, name').eq('id', boatId).eq('owner_id', userId).single();
  if (!boat) return { error: 'Boat not found or you do not own this boat' };

  let query = supabase
    .from('boat_maintenance_tasks')
    .select('id, title, description, category, priority, status, due_date, estimated_hours, estimated_cost, equipment_id, is_template')
    .eq('boat_id', boatId)
    .eq('is_template', false);

  const status = args.status as string | undefined;
  if (status) query = query.eq('status', status);

  const priority = args.priority as string | undefined;
  if (priority) query = query.eq('priority', priority);

  const category = args.category as string | undefined;
  if (category) query = query.eq('category', category);

  const equipmentId = (args.equipmentId || args.equipment_id) as string | undefined;
  if (equipmentId) query = query.eq('equipment_id', equipmentId);

  const overdueOnly = (args.overdueOnly || args.overdue_only) as boolean | undefined;
  if (overdueOnly) {
    const today = new Date().toISOString().split('T')[0];
    query = query.lt('due_date', today).not('due_date', 'is', null).neq('status', 'completed');
  }

  const dueSoonDays = (args.dueSoonDays || args.due_soon_days) as number | undefined;
  if (dueSoonDays && !overdueOnly) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + dueSoonDays);
    query = query.lte('due_date', cutoff.toISOString().split('T')[0]).not('due_date', 'is', null);
  }

  const includeCompleted = (args.includeCompleted || args.include_completed) as boolean | undefined;
  if (!includeCompleted) query = query.neq('status', 'completed');

  query = query.order('due_date', { nullsFirst: false }).order('priority').limit(50);
  const { data, error } = await query;
  if (error) return { error: `Failed to fetch maintenance tasks: ${error.message}` };

  const tasks = data || [];
  const today = new Date().toISOString().split('T')[0];
  return {
    boatId: boat.id,
    boatName: boat.name,
    tasks,
    count: tasks.length,
    overdueCount: tasks.filter((t: Record<string, unknown>) => t.due_date && (t.due_date as string) < today && t.status !== 'completed').length,
  };
}

async function getBoatManagementSummaryTool(supabase: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const boatId = (args.boatId || args.boat_id) as string;
  if (!boatId) return { error: 'boat_id is required' };
  const { data: boat } = await supabase.from('boats').select('id, name, type, make_model').eq('id', boatId).eq('owner_id', userId).single();
  if (!boat) return { error: 'Boat not found or you do not own this boat' };

  const dueSoonDays = ((args.dueSoonDays || args.due_soon_days) ?? 30) as number;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + dueSoonDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const [equipmentRes, inventoryRes, tasksRes] = await Promise.all([
    supabase.from('boat_equipment').select('id, name, category, status, next_service_date, expiry_date').eq('boat_id', boatId),
    supabase.from('boat_inventory').select('id, name, category, quantity, min_quantity').eq('boat_id', boatId),
    supabase.from('boat_maintenance_tasks').select('id, title, category, priority, status, due_date').eq('boat_id', boatId).eq('is_template', false),
  ]);

  const equipment = equipmentRes.data || [];
  const inventory = inventoryRes.data || [];
  const tasks = tasksRes.data || [];

  const dueSoonEquipment = equipment.filter((e: Record<string, unknown>) => e.next_service_date && (e.next_service_date as string) <= cutoffStr);
  const expiredEquipment = equipment.filter((e: Record<string, unknown>) => e.expiry_date && (e.expiry_date as string) <= today);
  const lowStockItems = inventory.filter((i: Record<string, unknown>) => (i.quantity as number) < ((i.min_quantity as number) || 1));
  const overdueTasks = tasks.filter((t: Record<string, unknown>) => t.due_date && (t.due_date as string) < today && t.status !== 'completed');
  const dueSoonTasks = tasks.filter((t: Record<string, unknown>) => t.due_date && (t.due_date as string) >= today && (t.due_date as string) <= cutoffStr && t.status !== 'completed');
  const pendingTasks = tasks.filter((t: Record<string, unknown>) => t.status === 'pending' || t.status === 'in_progress');

  return {
    boatId: boat.id,
    boatName: boat.name,
    boatType: boat.type,
    boatModel: boat.make_model,
    summary: {
      equipment: { total: equipment.length, dueSoon: dueSoonEquipment.length, expiringSoon: expiredEquipment.length },
      inventory: { total: inventory.length, lowStock: lowStockItems.length },
      maintenance: { total: tasks.length, overdue: overdueTasks.length, dueSoon: dueSoonTasks.length, pending: pendingTasks.length },
    },
    alerts: [
      ...overdueTasks.map((t: Record<string, unknown>) => ({ type: 'overdue_task', title: t.title, dueDate: t.due_date, priority: t.priority })),
      ...dueSoonTasks.slice(0, 5).map((t: Record<string, unknown>) => ({ type: 'task_due_soon', title: t.title, dueDate: t.due_date, priority: t.priority })),
      ...expiredEquipment.map((e: Record<string, unknown>) => ({ type: 'equipment_expired', name: e.name, expiryDate: e.expiry_date })),
      ...dueSoonEquipment.slice(0, 3).map((e: Record<string, unknown>) => ({ type: 'service_due_soon', name: e.name, nextServiceDate: e.next_service_date })),
      ...lowStockItems.slice(0, 5).map((i: Record<string, unknown>) => ({ type: 'low_stock', name: i.name, quantity: i.quantity, minQuantity: i.min_quantity })),
    ],
  };
}
