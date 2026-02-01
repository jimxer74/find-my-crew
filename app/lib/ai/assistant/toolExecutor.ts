/**
 * AI Assistant Tool Executor
 *
 * Executes tool calls from the AI and returns results.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ToolCall, ToolResult, AIPendingAction, ActionType } from './types';
import { isActionTool } from './tools';

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
      payload = { legId: args.legId };
      explanation = args.reason as string;
      break;

    case 'suggest_profile_update':
      payload = { updates: JSON.parse(args.updates as string) };
      explanation = args.reason as string;
      break;

    case 'suggest_approve_registration':
    case 'suggest_reject_registration':
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
