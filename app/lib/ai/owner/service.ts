/**
 * Owner AI Chat Service
 *
 * AI service for owner/skipper role users onboarding.
 * - Guides users through profile creation
 * - Assists with boat creation (using screenscraping for boat details)
 * - Helps create first journey with legs
 *
 * Uses shared AI utilities from @/app/lib/ai/shared for tool parsing,
 * bounding box handling, and shared infrastructure.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { callAI } from '../service';
import {
  parseToolCalls,
  formatToolResultsForAI,
  sanitizeContent,
  ToolCall,
  TOOL_DEFINITIONS,
  getToolByName,
  toolsToPromptFormat,
} from '../shared';
import { getAllRegions } from '@/app/lib/geocoding/locations';
import {
  OwnerMessage,
  OwnerChatRequest,
  OwnerChatResponse,
  OwnerPreferences,
  type OwnerStep,
} from './types';
import skillsConfig from '@/app/config/skills-config.json';

const MAX_HISTORY_MESSAGES = 15;
const MAX_TOOL_ITERATIONS = 10; // Increased to allow creating multiple legs for journeys

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Owner Chat Service] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Get skills structure from config for AI instructions
 */
function getSkillsStructure(): string {
  return skillsConfig.general.map(skill => 
    `- **${skill.name}**: ${skill.infoText}`
  ).join('\n');
}

/**
 * Experience level definitions (same as prospect)
 */
const EXPERIENCE_LEVEL_DEFINITIONS = {
  1: {
    name: 'Beginner',
    description: 'New to sailing or have minimal experience. May have taken a basic sailing course or been on a few day sails.',
    typical_skills: 'Basic understanding of wind direction, can help with lines, basic safety awareness.',
  },
  2: {
    name: 'Competent Crew',
    description: 'Can steer, reef, and stand watch. Have completed several sailing trips and understand basic navigation.',
    typical_skills: 'Can handle lines, basic navigation, watch keeping, understands safety procedures.',
  },
  3: {
    name: 'Coastal Skipper',
    description: 'Experienced sailor who can skipper a boat in familiar waters. Can plan passages and handle most situations.',
    typical_skills: 'Passage planning, navigation, boat handling in various conditions, crew management.',
  },
  4: {
    name: 'Offshore Skipper',
    description: 'Highly experienced sailor capable of long ocean passages and handling challenging conditions.',
    typical_skills: 'Ocean navigation, heavy weather sailing, self-sufficiency, advanced seamanship.',
  },
};

/**
 * Risk level definitions (same as prospect)
 */
const RISK_LEVEL_DEFINITIONS = {
  'Coastal sailing': {
    description: 'Sailing within sight of land or short distances between ports. Generally calmer conditions and easier access to shelter.',
    typical_conditions: 'Day sails, short coastal hops, protected waters. Usually within VHF range of coast guard.',
    experience_recommended: 'Beginner to Competent Crew',
  },
  'Offshore sailing': {
    description: 'Passages that take you out of sight of land for extended periods. Requires self-sufficiency and good weather planning.',
    typical_conditions: 'Multi-day passages, open water crossings, variable weather conditions. May be days from nearest port.',
    experience_recommended: 'Coastal Skipper or above',
  },
  'Extreme sailing': {
    description: 'Challenging conditions including high latitude sailing, ocean crossings, or expeditions to remote areas.',
    typical_conditions: 'Heavy weather, ice navigation, very long passages, limited rescue options. Weeks from nearest port.',
    experience_recommended: 'Offshore Skipper with specific experience',
  },
};

/**
 * Available sailing skills - EXACTLY from skills-config.json
 */
const SAILING_SKILLS = skillsConfig.general.map(skill => skill.name);

/** Tool names allowed per owner onboarding step. AI only sees these tools. */
const TOOLS_BY_STEP: Record<OwnerStep, string[]> = {
  signup: ['get_experience_level_definitions', 'get_risk_level_definitions', 'get_skills_definitions'],
  create_profile: ['update_user_profile', 'get_experience_level_definitions', 'get_risk_level_definitions', 'get_skills_definitions'],
  add_boat: ['fetch_boat_details_from_sailboatdata', 'create_boat'],
  post_journey: ['generate_journey_route'],
  completed: [],
};

/**
 * Derive the current onboarding step from deterministic state (no AI status tools).
 */
function deriveOwnerStep(
  authenticatedUserId: string | null,
  hasProfile: boolean,
  hasBoat: boolean,
  hasJourney: boolean
): OwnerStep {
  if (!authenticatedUserId) return 'signup';
  if (!hasProfile) return 'create_profile';
  if (!hasBoat) return 'add_boat';
  if (!hasJourney) return 'post_journey';
  return 'completed';
}

/**
 * Get only the tools allowed for the current step. Used for prompt and execution guard.
 */
function getToolsForOwnerStep(step: OwnerStep): Array<{ name: string; description: string; parameters: unknown }> {
  const names = TOOLS_BY_STEP[step];
  if (!names.length) return [];
  return names
    .map(name => getToolByName(name))
    .filter((t): t is NonNullable<typeof t> => t != null && !t.disabled)
    .map(t => ({ name: t.name, description: t.description, parameters: t.parameters }));
}

/** Format step tools for prompt (name + description + params). */
function formatStepToolsForPrompt(tools: Array<{ name: string; description: string; parameters: unknown }>): string {
  if (!tools.length) return '(No tools available for this step.)';
  return tools
    .map(t => `- **${t.name}**: ${t.description}\n  Parameters: ${JSON.stringify((t.parameters as { properties?: Record<string, unknown> })?.properties ?? {}, null, 2)}`)
    .join('\n\n');
}

const TOOL_CALL_FORMAT = `
**TOOL CALL FORMAT:** Use a code block with valid JSON. Example:
\`\`\`tool_call
{"name": "tool_name", "arguments": { ... }}
\`\`\`
- One tool per block. Use complete, valid JSON. No placeholders like {...}.
- When the user confirms (e.g. "yes", "looks good"), call the tool immediately.
`;

/**
 * Build step-specific system prompt. State is injected by code; AI does not call status tools.
 */
function buildOwnerPromptForStep(
  step: OwnerStep,
  opts: {
    currentDate: string;
    userProfile?: { fullName?: string | null; email?: string | null; phone?: string | null; avatarUrl?: string | null } | null;
    preferences: OwnerPreferences;
    boatId?: string;
    boatName?: string;
    isProfileCompletionMode?: boolean;
  }
): string {
  const tools = getToolsForOwnerStep(step);
  const toolsBlock = formatStepToolsForPrompt(tools);
  const { currentDate, userProfile, boatId, boatName, isProfileCompletionMode } = opts;

  const userInfo = userProfile
    ? [
        userProfile.fullName && `- **Name:** "${userProfile.fullName}"`,
        userProfile.email && `- **Email:** "${userProfile.email}"`,
        userProfile.phone && `- **Phone:** "${userProfile.phone}"`,
        userProfile.avatarUrl && `- **Profile photo:** Already set`,
      ].filter(Boolean).join('\n')
    : '';

  let stateAndGoal = '';
  let stepInstructions = '';
  let extra = '';

  switch (step) {
    case 'signup':
      stateAndGoal = `## CURRENT STEP: Sign up
**State:** User is not signed in. No profile, boat, or journey.
**Goal:** Encourage sign up. Be welcoming. Explain benefits (create profile, add boat, create journeys). Do not call any profile/boat/journey tools.`;
      stepInstructions = userInfo ? `**From signup/OAuth (if known):**\n${userInfo}\n` : '';
      extra = `You may use definition tools (get_experience_level_definitions, get_risk_level_definitions, get_skills_definitions) only to answer general questions.`;
      break;
    case 'create_profile':
      stateAndGoal = `## CURRENT STEP: Create profile
**State:** Profile not created yet. Boat: none. Journey: none.
**Goal:** Gather full_name, user_description, sailing_experience (and optionally risk_level, skills). Then call \`update_user_profile\` with **roles: ['owner']** (required). When the user gives their full name, include [OWNER_NAME: Their Full Name] in your message.
**AFTER PROFILE IS CREATED:** You MUST propose the next step: add a boat. In [SUGGESTIONS] include e.g. "Add your boat" or "Let's add your boat so we can create journeys."`;
      stepInstructions = userInfo ? `**From signup/OAuth:**\n${userInfo}\n` : '';
      extra = `## SKILLS (optional)
Use ONLY exact skill names from config. Format in profile: [{"skill_name": "exact_name", "description": "..."}]. Skills optional.
${getSkillsStructure()}`;
      if (isProfileCompletionMode) {
        extra += `\n**Profile completion mode:** Extract info from conversation history. Present summary, get confirmation, then call update_user_profile with roles: ['owner'].`;
      }
      break;
    case 'add_boat':
      stateAndGoal = `## CURRENT STEP: Add boat
**State:** Profile created. Boat: none. Journey: none.
**Goal:** Get boat make/model → call \`fetch_boat_details_from_sailboatdata\` → gather name if needed → present summary → when user confirms, you MUST call \`create_boat\` in your next response.
**AFTER BOAT IS CREATED:** You MUST propose the next step: create a journey. In [SUGGESTIONS] include e.g. "Create your first journey" or "Let's plan your journey and add legs."`;
      stepInstructions = `**In this step you may ONLY use fetch_boat_details_from_sailboatdata and create_boat. Do NOT call create_journey or generate_journey_route.**

**READ CONVERSATION HISTORY FIRST:** Before asking for boat details, check the full conversation—the user may have already provided boat info (e.g. "Grand Soleil 43 – Admiral Fyodor", make/model, name, description). If so, use that information: call \`fetch_boat_details_from_sailboatdata\` with the make/model they gave, use the boat name they mentioned, then present a short summary and ask to confirm (or call \`create_boat\` if you have name, type, make_model, capacity). Do NOT ask again for name, type, or size if they were already stated earlier in the chat.
**CRITICAL:** After you show a boat summary, if the user replies with ANY confirmation (e.g. "yes", "looks good", "confirm", "correct", "go ahead", "create it", "ok", "sounds good"), you MUST call the \`create_boat\` tool immediately. Do not ask again; do not only describe—actually call the tool with the boat details you just summarized. Required fields: name, type, make_model, capacity (number). Use data from fetch_boat_details_from_sailboatdata and your summary.`;
      extra = `**create_boat:** Call this as soon as the user confirms the boat summary. Example (replace with actual values from your summary and fetch_boat_details result):
\`\`\`tool_call
{"name": "create_boat", "arguments": {"name": "Boat Name", "type": "Coastal cruisers", "make_model": "Bavaria 46", "capacity": 6}}
\`\`\``;
      break;
    case 'post_journey':
      stateAndGoal = `## CURRENT STEP: Post journey
**State:** Profile created. Boat: ${boatName ?? 'N/A'} (id: ${boatId ?? 'N/A'}). Journey: none.
**Goal:** Gather route (start, end, optional waypoints, dates). Call \`generate_journey_route\` with **boatId: "${boatId ?? ''}"**, startLocation, endLocation (each {name, lat, lng}), and optional intermediateWaypoints, startDate, endDate, waypointDensity ("minimal" or "moderate"). Do not call get_owner_boats—boat id is above.
**AFTER JOURNEY IS CREATED:** In [SUGGESTIONS] propose e.g. "View your journeys" or "Invite crew to your legs."`;
      stepInstructions = `To create a journey from a route (e.g. Jamaica to San Blas), you MUST call generate_journey_route with startLocation, endLocation, boatId, and optional waypoints/dates. Do NOT call create_journey for route-based journeys; create_journey is not available in this step.

generate_journey_route creates the journey and all legs. After it succeeds, tell the user their journey is ready. waypointDensity: "moderate" default.
**COORDINATES:** If the user's message includes journey details with coordinates in parentheses (e.g. "Start location: Kingston, Jamaica (lat 18.0, lng -76.8)"), use those exact lat/lng values in your generate_journey_route call. Otherwise supply lat and lng from your knowledge of geography. Do NOT ask the user for latitude/longitude.`;
      break;
    case 'completed':
      stateAndGoal = `## CURRENT STEP: Completed
**State:** Profile, boat(s), and journey(s) exist. Onboarding complete.
**Goal:** Be helpful. No creation tools available. You can suggest they review journeys or invite crew.`;
      stepInstructions = '';
      extra = '';
      break;
  }

  return `You are SailSmart's AI assistant for owner onboarding. CURRENT DATE: ${currentDate}

${stateAndGoal}
${stepInstructions}

## AVAILABLE TOOLS (only these):
${toolsBlock}
${TOOL_CALL_FORMAT}
${extra ? `\n${extra}` : ''}

## RULES
- Be concise. One or two questions at a time. Confirm before creating (profile/boat/journey).
- **Use conversation history:** Before asking for any detail, check if the user already provided it earlier in the conversation (e.g. boat name, make/model, profile info). If they did, use that information and do not ask again—proceed to the next action (e.g. look up boat, show summary, or create).
- **ALWAYS propose the next onboarding step:** After completing the current step (profile created, boat created, or journey created), your [SUGGESTIONS] MUST include one suggestion that moves the user to the next step (e.g. after profile → "Add your boat"; after boat → "Create your first journey"; after journey → "View your journeys" or "Invite crew"). Never end with only generic tips—always offer the concrete next step in the flow.
- At the end of every response, add [SUGGESTIONS] with 1–2 items: at least one must be the next step in the flow when the current step is complete; the other can be a value for a missing field or a short tip. [/SUGGESTIONS]
- Do not show tool_call JSON to the user; describe in plain language.`;
}

/**
 * Normalize risk_level field to ensure it's a proper array of enum strings.
 * Handles AI passing: array, string "["Offshore sailing"]", double-encoded JSON, etc.
 */
function normalizeRiskLevel(value: unknown): string[] | null {
  if (value === null || value === undefined) {
    return null;
  }

  function toArray(val: unknown): string[] {
    if (Array.isArray(val)) {
      return val.flatMap(v => (typeof v === 'string' ? [v.trim()] : toArray(v))).filter(Boolean);
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          return toArray(parsed);
        } catch {
          return trimmed.length > 0 ? [trimmed] : [];
        }
      }
      return trimmed.length > 0 ? [trimmed] : [];
    }
    return [];
  }

  const validValues = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
  const arr = toArray(value).filter(
    v => v && validValues.includes(v) && !v.includes('[') && !v.includes(']')
  );
  return arr.length > 0 ? arr : null;
}

/**
 * Normalize sailing_experience field to ensure it's a proper integer (1-4)
 */
function normalizeSailingExperience(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'number') {
    if (value >= 1 && value <= 4) {
      return Math.round(value);
    }
    log(`sailing_experience out of range (${value}), defaulting to 2`);
    return 2;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const numMatch = trimmed.match(/\b([1-4])\b/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }
    
    const lowerValue = trimmed.toLowerCase();
    if (lowerValue.includes('beginner') || lowerValue.includes('new to sailing')) {
      return 1;
    } else if (lowerValue.includes('competent crew') || lowerValue.includes('competent')) {
      return 2;
    } else if (lowerValue.includes('coastal skipper') || lowerValue.includes('coastal')) {
      return 3;
    } else if (lowerValue.includes('offshore skipper') || lowerValue.includes('offshore')) {
      return 4;
    }
    
    log(`Could not parse sailing_experience from text: "${trimmed}", defaulting to 2`);
    return 2;
  }
  
  const numValue = Number(value);
  if (!isNaN(numValue) && numValue >= 1 && numValue <= 4) {
    return Math.round(numValue);
  }
  
  log(`Could not normalize sailing_experience: ${value}, defaulting to 2`);
  return 2;
}

/**
 * Create journey and all legs from a generated route (static code, no AI involvement).
 * Called when generate_journey_route returns successfully.
 */
async function createJourneyAndLegsFromRoute(
  supabase: SupabaseClient,
  authenticatedUserId: string,
  boatId: string,
  routeData: {
    journeyName: string;
    description?: string;
    legs: Array<{
      name: string;
      start_date?: string;
      end_date?: string;
      waypoints: Array<{
        index: number;
        name: string;
        geocode: { type: string; coordinates: [number, number] };
      }>;
    }>;
  },
  metadata: {
    risk_level?: string[];
    skills?: string[];
    min_experience_level?: number;
    cost_model?: string;
    cost_info?: string;
    startDate?: string;
    endDate?: string;
  },
  aiPrompt?: string
): Promise<{ journeyId: string; journeyName: string; legsCreated: number; error?: string }> {
  // Verify boat ownership
  const { data: boat, error: boatError } = await supabase
    .from('boats')
    .select('owner_id')
    .eq('id', boatId)
    .eq('owner_id', authenticatedUserId)
    .single();

  if (boatError || !boat) {
    return { journeyId: '', journeyName: '', legsCreated: 0, error: 'Boat not found or you do not own this boat' };
  }

  const firstLeg = routeData.legs[0];
  const lastLeg = routeData.legs[routeData.legs.length - 1];

  // Ensure risk_level is a flat array of valid enum strings
  // Use RPC to bypass PostgREST enum[] serialization (insert_journey_with_risk accepts text[])
  const validRiskLevels = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
  let rawRisk: unknown = metadata.risk_level;
  if (typeof rawRisk === 'string') {
    try {
      rawRisk = JSON.parse(rawRisk.trim());
    } catch {
      rawRisk = [];
    }
  }
  const riskLevelArray = (Array.isArray(rawRisk) ? rawRisk : [])
    .flat(2)
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(v => v && !v.includes('[') && !v.includes(']') && validRiskLevels.includes(v));

  const costModel = metadata.cost_model && ['Shared contribution', 'Owner covers all costs', 'Crew pays a fee', 'Delivery/paid crew', 'Not defined'].includes(metadata.cost_model)
    ? metadata.cost_model
    : 'Not defined';

  const { data: journeyId, error: rpcError } = await supabase.rpc('insert_journey_with_risk', {
    p_boat_id: boatId,
    p_name: routeData.journeyName,
    p_description: routeData.description || null,
    p_start_date: firstLeg?.start_date ?? metadata.startDate ?? null,
    p_end_date: lastLeg?.end_date ?? metadata.endDate ?? null,
    p_risk_level: riskLevelArray,
    p_skills: metadata.skills || [],
    p_min_experience_level: metadata.min_experience_level ?? 1,
    p_cost_model: costModel,
    p_cost_info: metadata.cost_info || null,
    p_state: 'In planning',
    p_ai_prompt: aiPrompt || null,
    p_is_ai_generated: !!aiPrompt,
  });

  if (rpcError || !journeyId) {
    return {
      journeyId: '',
      journeyName: routeData.journeyName,
      legsCreated: 0,
      error: `Failed to create journey: ${rpcError?.message || 'Unknown error'}`,
    };
  }

  const journey = { id: journeyId, name: routeData.journeyName };

  let legsCreated = 0;

  for (const leg of routeData.legs) {
    if (!leg.waypoints || leg.waypoints.length < 2) continue;

    const { data: legRecord, error: legError } = await supabase
      .from('legs')
      .insert({
        journey_id: journey.id,
        name: leg.name,
        start_date: leg.start_date || null,
        end_date: leg.end_date || null,
        crew_needed: 1,
      })
      .select('id, name')
      .single();

    if (legError || !legRecord) {
      log('Warning: Failed to create leg', { legName: leg.name, error: legError });
      continue;
    }

    const waypointsForRPC = leg.waypoints.map(wp => ({
      index: wp.index,
      name: wp.name,
      lng: wp.geocode.coordinates[0],
      lat: wp.geocode.coordinates[1],
    }));

    const { error: waypointsError } = await supabase.rpc('insert_leg_waypoints', {
      leg_id_param: legRecord.id,
      waypoints_param: waypointsForRPC,
    });

    if (waypointsError) {
      log('Warning: Failed to create waypoints for leg', { legName: leg.name, error: waypointsError });
    }

    legsCreated++;
  }

  return {
    journeyId: journey.id,
    journeyName: journey.name,
    legsCreated,
  };
}

/**
 * Execute owner tool calls.
 * Only tools in allowedToolNames are executed; others are rejected (step-based restriction).
 */
async function executeOwnerTools(
  supabase: SupabaseClient,
  toolCalls: ToolCall[],
  authenticatedUserId: string | null,
  allowedToolNames: Set<string>,
  aiPrompt?: string
): Promise<Array<{ name: string; result: unknown; error?: string }>> {
  const results: Array<{ name: string; result: unknown; error?: string }> = [];

  for (const toolCall of toolCalls) {
    log('Executing tool:', toolCall.name);
    log('Raw arguments:', JSON.stringify(toolCall.arguments));

    if (!allowedToolNames.has(toolCall.name)) {
      results.push({
        name: toolCall.name,
        result: null,
        error: 'This action is not available in the current step. Please complete the current onboarding step first.',
      });
      continue;
    }

    try {
      const args = toolCall.arguments as Record<string, unknown>;

      // Definition tools (public)
      if (toolCall.name === 'get_experience_level_definitions') {
        results.push({
          name: toolCall.name,
          result: EXPERIENCE_LEVEL_DEFINITIONS,
        });
        continue;
      }

      if (toolCall.name === 'get_risk_level_definitions') {
        results.push({
          name: toolCall.name,
          result: RISK_LEVEL_DEFINITIONS,
        });
        continue;
      }

      if (toolCall.name === 'get_skills_definitions') {
        results.push({
          name: toolCall.name,
          result: {
            skills: SAILING_SKILLS,
            skillsStructure: skillsConfig.general,
            note: 'CRITICAL: You MUST use ONLY these exact skill names from the config.',
          },
        });
        continue;
      }

      // Profile tools (same as prospect but with owner role)
      if (toolCall.name === 'get_profile_completion_status') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: {
              filledFields: [],
              missingFields: ['full_name', 'user_description', 'sailing_experience', 'risk_level', 'skills'],
              completionPercentage: 0,
              profile: null,
              message: 'Please sign up to check your profile completion status',
            },
          });
          continue;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authenticatedUserId)
          .single();

        if (error) {
          results.push({
            name: toolCall.name,
            result: null,
            error: `Failed to get profile: ${error.message}`,
          });
          continue;
        }

        const completionStatus = {
          filledFields: [] as string[],
          missingFields: [] as string[],
          completionPercentage: 0,
        };

        const requiredFields = ['full_name', 'user_description', 'sailing_experience', 'risk_level', 'skills'];

        for (const field of requiredFields) {
          const value = profile?.[field];
          if (value && (Array.isArray(value) ? value.length > 0 : true)) {
            completionStatus.filledFields.push(field);
          } else {
            completionStatus.missingFields.push(field);
          }
        }

        const totalFields = requiredFields.length;
        const filledRequired = requiredFields.filter(f => completionStatus.filledFields.includes(f)).length;
        completionStatus.completionPercentage = Math.round((filledRequired / totalFields) * 100);

        results.push({
          name: toolCall.name,
          result: {
            ...completionStatus,
            profile: {
              full_name: profile?.full_name,
              user_description: profile?.user_description,
              sailing_experience: profile?.sailing_experience,
              risk_level: profile?.risk_level,
              skills: profile?.skills,
              roles: profile?.roles,
            },
          },
        });
        continue;
      }

      if (toolCall.name === 'update_user_profile') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'Authentication required to create or update profile. Please sign up first.',
          });
          continue;
        }

        // Field alias mapping
        const fieldAliases: Record<string, string> = {
          'risk_levels': 'risk_level',
          'comfort_zones': 'risk_level',
          'avatar_url': 'profile_image_url',
          'bio': 'user_description',
          'description': 'user_description',
          'experience_level': 'sailing_experience',
        };

        const updates: Record<string, unknown> = {};
        const allowedFields = [
          'full_name', 'user_description', 'sailing_experience',
          'risk_level', 'skills', 'sailing_preferences', 'certifications',
          'phone', 'profile_image_url',
          'preferred_departure_location', 'preferred_arrival_location',
          'availability_start_date', 'availability_end_date'
        ];

        // Map aliases
        for (const [alias, canonical] of Object.entries(fieldAliases)) {
          if (args[alias] !== undefined && args[canonical] === undefined) {
            args[canonical] = args[alias];
          }
        }

        for (const field of allowedFields) {
          if (args[field] !== undefined) {
            let value = args[field];
            
            if (field === 'risk_level') {
              value = normalizeRiskLevel(value);
            } else if (field === 'sailing_experience') {
              value = normalizeSailingExperience(value);
            } else if (field === 'skills') {
              let skillsArray: unknown[] = [];
              
              if (typeof value === 'string') {
                try {
                  const parsed = JSON.parse(value);
                  skillsArray = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  skillsArray = [value];
                }
              } else if (Array.isArray(value)) {
                skillsArray = value;
              } else {
                skillsArray = [value];
              }
              
              const validSkillNames = new Set(SAILING_SKILLS);
              const normalizedSkills: Array<{ skill_name: string; description: string }> = [];
              
              for (const skill of skillsArray) {
                if (typeof skill === 'string') {
                  if (validSkillNames.has(skill)) {
                    normalizedSkills.push({ skill_name: skill, description: '' });
                  }
                } else if (skill && typeof skill === 'object') {
                  const skillObj = skill as Record<string, unknown>;
                  const skillName = (skillObj.skill_name || skillObj.name) as string | undefined;
                  if (skillName && validSkillNames.has(skillName)) {
                    normalizedSkills.push({
                      skill_name: skillName,
                      description: (skillObj.description || '') as string,
                    });
                  }
                }
              }
              
              value = normalizedSkills;
            } else if (field === 'preferred_departure_location' || field === 'preferred_arrival_location') {
              // Normalize location object - validate required fields, pass through bbox
              if (value && typeof value === 'object') {
                const loc = value as Record<string, unknown>;
                if (typeof loc.name === 'string' && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                  const normalized: Record<string, unknown> = { name: loc.name, lat: loc.lat, lng: loc.lng };
                  if (typeof loc.isCruisingRegion === 'boolean') normalized.isCruisingRegion = loc.isCruisingRegion;
                  if (loc.bbox && typeof loc.bbox === 'object') {
                    const bbox = loc.bbox as Record<string, unknown>;
                    if (typeof bbox.minLng === 'number' && typeof bbox.minLat === 'number' &&
                        typeof bbox.maxLng === 'number' && typeof bbox.maxLat === 'number') {
                      normalized.bbox = { minLng: bbox.minLng, minLat: bbox.minLat, maxLng: bbox.maxLng, maxLat: bbox.maxLat };
                    }
                  }
                  if (typeof loc.countryCode === 'string') normalized.countryCode = loc.countryCode;
                  if (typeof loc.countryName === 'string') normalized.countryName = loc.countryName;

                  // Auto-enrich: if AI omitted bbox, try to match against known cruising regions
                  if (!normalized.bbox && typeof normalized.name === 'string') {
                    const regionName = (normalized.name as string).toLowerCase().trim();
                    const matchedRegion = getAllRegions().find(r =>
                      r.name.toLowerCase() === regionName ||
                      r.aliases.some(a => a.toLowerCase() === regionName)
                    );
                    if (matchedRegion) {
                      normalized.isCruisingRegion = true;
                      normalized.bbox = { ...matchedRegion.bbox };
                    }
                  }

                  value = normalized;
                } else {
                  continue; // Skip invalid location
                }
              } else {
                continue;
              }
            } else if (field === 'availability_start_date' || field === 'availability_end_date') {
              if (typeof value === 'string') {
                const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
                if (dateMatch) {
                  value = dateMatch[0];
                } else {
                  continue;
                }
              } else {
                continue;
              }
            }

            updates[field] = value;
          }
        }

        if (Object.keys(updates).length === 0) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'No valid fields provided to update',
          });
          continue;
        }

        updates.updated_at = new Date().toISOString();

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, username, roles')
          .eq('id', authenticatedUserId)
          .single();

        let operationType: 'insert' | 'update';

        if (existingProfile) {
          operationType = 'update';
          const existingRoles = existingProfile.roles as string[] | null;
          if (!existingRoles || !existingRoles.includes('owner')) {
            updates.roles = [...(existingRoles || []), 'owner'];
          }

          const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', authenticatedUserId)
            .select('id');

          if (error) {
            results.push({
              name: toolCall.name,
              result: null,
              error: `Failed to update profile: ${error.message}`,
            });
            continue;
          }

          if (!data || data.length === 0) {
            results.push({
              name: toolCall.name,
              result: null,
              error: 'Profile update failed: no rows were affected.',
            });
            continue;
          }
        } else {
          operationType = 'insert';
          const baseName = (updates.full_name as string)
            ? (updates.full_name as string).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)
            : `user_${authenticatedUserId.substring(0, 8)}`;
          const username = `${baseName}_${Date.now().toString(36)}`;

          let email: string | undefined;
          try {
            const { data: authUser } = await supabase.auth.getUser();
            email = authUser?.user?.email || undefined;
          } catch {
            // Email is optional
          }

          const insertData: Record<string, unknown> = {
            id: authenticatedUserId,
            username,
            ...updates,
            created_at: new Date().toISOString(),
            roles: ['owner'], // CRITICAL: Set owner role
          };

          if (email) {
            insertData.email = email;
          }

          const { data, error } = await supabase
            .from('profiles')
            .insert(insertData)
            .select('id');

          if (error) {
            results.push({
              name: toolCall.name,
              result: null,
              error: `Failed to create profile: ${error.message}`,
            });
            continue;
          }

          if (!data || data.length === 0) {
            results.push({
              name: toolCall.name,
              result: null,
              error: 'Profile creation failed: no rows were inserted.',
            });
            continue;
          }
        }

        const updatedFieldNames = Object.keys(updates).filter(k => k !== 'updated_at' && k !== 'created_at');
        results.push({
          name: toolCall.name,
          result: {
            success: true,
            operation: operationType,
            updatedFields: updatedFieldNames,
            message: operationType === 'insert'
              ? 'Profile created successfully with owner role'
              : 'Profile updated successfully',
          },
        });
        continue;
      }

      // Boat tools
      if (toolCall.name === 'fetch_boat_details_from_sailboatdata') {
        const make_model = args.make_model as string;
        const slug = args.slug as string | undefined;

        if (!make_model) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'make_model is required',
          });
          continue;
        }

        try {
          // Call fetchSailboatDetails directly (avoids HTTP self-call which fails in serverless)
          const { fetchSailboatDetails } = await import('@/app/lib/sailboatdata_queries');
          const details = await fetchSailboatDetails(make_model.trim(), slug?.trim());

          if (details) {
            results.push({
              name: toolCall.name,
              result: {
                type: details.type || null,
                capacity: details.capacity ?? null,
                loa_m: details.loa_m ?? null,
                beam_m: details.beam_m ?? null,
                max_draft_m: details.max_draft_m ?? null,
                displcmt_m: details.displcmt_m ?? null,
                average_speed_knots: details.average_speed_knots ?? null,
                characteristics: details.characteristics || '',
                capabilities: details.capabilities || '',
                accommodations: details.accommodations || '',
                link_to_specs: details.link_to_specs || '',
                sa_displ_ratio: details.sa_displ_ratio ?? null,
                ballast_displ_ratio: details.ballast_displ_ratio ?? null,
                displ_len_ratio: details.displ_len_ratio ?? null,
                comfort_ratio: details.comfort_ratio ?? null,
                capsize_screening: details.capsize_screening ?? null,
                hull_speed_knots: details.hull_speed_knots ?? null,
                ppi_pounds_per_inch: details.ppi_pounds_per_inch ?? null,
              },
            });
            continue;
          }

          // Screenscraping returned null - try AI fallback
          const { callAI } = await import('@/app/lib/ai/service');
          const { parseJsonObjectFromAIResponse } = await import('@/app/lib/ai/shared');
          const searchUrl = `https://sailboatdata.com/?keyword=${encodeURIComponent(make_model.trim())}&sort-select&sailboats_per_page=50`;
          const prompt = `You are a sailing expert with comprehensive knowledge of sailboats from www.sailboatdata.com database.

A user wants detailed information about the sailboat: "${make_model.trim()}"

The search URL on sailboatdata.com would be: ${searchUrl}

Your task: Provide comprehensive details about this sailboat in JSON format. Use your knowledge of sailboats from sailboatdata.com and general sailing expertise.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON, no markdown, no code blocks, no explanations
2. Use exact values from sailboatdata.com when available
3. For sailboat category, choose ONE from: "Daysailers", "Coastal cruisers", "Traditional offshore cruisers", "Performance cruisers", "Multihulls", "Expedition sailboats"
4. Return in metric units if available

Return a JSON object with this exact structure:
{
  "type": "one of the categories above or null",
  "capacity": number,
  "loa_m": number,
  "beam_m": number,
  "displcmt_m": number,
  "average_speed_knots": number,
  "characteristics": "string",
  "capabilities": "string",
  "accommodations": "string",
  "link_to_specs": "string",
  "sa_displ_ratio": number or null,
  "ballast_displ_ratio": number or null,
  "displ_len_ratio": number or null,
  "comfort_ratio": number or null,
  "capsize_screening": number or null,
  "hull_speed_knots": number or null,
  "ppi_pounds_per_inch": number or null
}

Return ONLY the JSON object, nothing else.`;

          const aiResult = await callAI({ useCase: 'boat-details', prompt });
          const boatDetails = parseJsonObjectFromAIResponse(aiResult.text);
          results.push({
            name: toolCall.name,
            result: {
              type: boatDetails.type || null,
              capacity: boatDetails.capacity ?? null,
              loa_m: boatDetails.loa_m ?? null,
              beam_m: boatDetails.beam_m ?? null,
              max_draft_m: boatDetails.max_draft_m ?? null,
              displcmt_m: boatDetails.displcmt_m ?? null,
              average_speed_knots: boatDetails.average_speed_knots ?? null,
              characteristics: boatDetails.characteristics || '',
              capabilities: boatDetails.capabilities || '',
              accommodations: boatDetails.accommodations || '',
              link_to_specs: boatDetails.link_to_specs || '',
              sa_displ_ratio: boatDetails.sa_displ_ratio ?? null,
              ballast_displ_ratio: boatDetails.ballast_displ_ratio ?? null,
              displ_len_ratio: boatDetails.displ_len_ratio ?? null,
              comfort_ratio: boatDetails.comfort_ratio ?? null,
              capsize_screening: boatDetails.capsize_screening ?? null,
              hull_speed_knots: boatDetails.hull_speed_knots ?? null,
              ppi_pounds_per_inch: boatDetails.ppi_pounds_per_inch ?? null,
            },
          });
        } catch (e: any) {
          results.push({
            name: toolCall.name,
            result: null,
            error: e.message || 'Failed to fetch boat details',
          });
        }
        continue;
      }

      if (toolCall.name === 'get_owner_boats') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: { boats: [], count: 0, message: 'Please sign up to view your boats' },
          });
          continue;
        }

        const limit = (args.limit as number) || 50;

        const { data: boats, error } = await supabase
          .from('boats')
          .select('*')
          .eq('owner_id', authenticatedUserId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          results.push({
            name: toolCall.name,
            result: null,
            error: `Failed to get boats: ${error.message}`,
          });
          continue;
        }

        results.push({
          name: toolCall.name,
          result: { boats: boats || [], count: boats?.length || 0 },
        });
        continue;
      }

      if (toolCall.name === 'get_boat_completion_status') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: {
              hasBoat: false,
              boatCount: 0,
              message: 'Please sign up to check boat completion status',
            },
          });
          continue;
        }

        const boatId = args.boatId as string | undefined;

        if (boatId) {
          // Check specific boat
          const { data: boat, error } = await supabase
            .from('boats')
            .select('*')
            .eq('id', boatId)
            .eq('owner_id', authenticatedUserId)
            .single();

          if (error || !boat) {
            results.push({
              name: toolCall.name,
              result: null,
              error: 'Boat not found',
            });
            continue;
          }

          const requiredFields = ['name', 'type', 'make_model', 'capacity'];
          const filledFields: string[] = [];
          const missingFields: string[] = [];

          for (const field of requiredFields) {
            if (boat[field]) {
              filledFields.push(field);
            } else {
              missingFields.push(field);
            }
          }

          results.push({
            name: toolCall.name,
            result: {
              hasBoat: true,
              filledFields,
              missingFields,
              completionPercentage: Math.round((filledFields.length / requiredFields.length) * 100),
              boat,
            },
          });
        } else {
          // Check if user has any boats
          const { data: boats, error } = await supabase
            .from('boats')
            .select('id')
            .eq('owner_id', authenticatedUserId)
            .limit(1);

          if (error) {
            results.push({
              name: toolCall.name,
              result: null,
              error: `Failed to check boats: ${error.message}`,
            });
            continue;
          }

          results.push({
            name: toolCall.name,
            result: {
              hasBoat: (boats?.length || 0) > 0,
              boatCount: boats?.length || 0,
            },
          });
        }
        continue;
      }

      if (toolCall.name === 'create_boat') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'Authentication required to create a boat. Please sign up first.',
          });
          continue;
        }

        const boatData: Record<string, unknown> = {
          owner_id: authenticatedUserId,
          name: args.name as string,
          type: args.type as string,
          make_model: args.make_model as string,
          capacity: args.capacity as number,
          home_port: args.home_port as string | undefined || null,
          country_flag: args.country_flag as string | undefined || null,
          loa_m: args.loa_m as number | undefined || null,
          beam_m: args.beam_m as number | undefined || null,
          max_draft_m: args.max_draft_m as number | undefined || null,
          displcmt_m: args.displcmt_m as number | undefined || null,
          average_speed_knots: args.average_speed_knots as number | undefined || null,
          link_to_specs: args.link_to_specs as string | undefined || null,
          characteristics: args.characteristics as string | undefined || null,
          capabilities: args.capabilities as string | undefined || null,
          accommodations: args.accommodations as string | undefined || null,
          sa_displ_ratio: args.sa_displ_ratio as number | undefined || null,
          ballast_displ_ratio: args.ballast_displ_ratio as number | undefined || null,
          displ_len_ratio: args.displ_len_ratio as number | undefined || null,
          comfort_ratio: args.comfort_ratio as number | undefined || null,
          capsize_screening: args.capsize_screening as number | undefined || null,
          hull_speed_knots: args.hull_speed_knots as number | undefined || null,
          ppi_pounds_per_inch: args.ppi_pounds_per_inch as number | undefined || null,
        };

        // Verify ownership (RLS should handle this, but double-check)
        const { data: profile } = await supabase
          .from('profiles')
          .select('roles')
          .eq('id', authenticatedUserId)
          .single();

        if (!profile || !(profile.roles as string[]).includes('owner')) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'User must have owner role to create boats',
          });
          continue;
        }

        // Check for duplicate boats: same name or same make_model for this owner
        const { data: existingBoats, error: duplicateCheckError } = await supabase
          .from('boats')
          .select('id, name, make_model')
          .eq('owner_id', authenticatedUserId);

        if (duplicateCheckError) {
          results.push({
            name: toolCall.name,
            result: null,
            error: `Failed to check for duplicate boats: ${duplicateCheckError.message}`,
          });
          continue;
        }

        // Check if a boat with the same name exists (case-insensitive)
        const duplicateByName = existingBoats?.find(
          (b) => b.name.toLowerCase().trim() === (boatData.name as string).toLowerCase().trim()
        );

        if (duplicateByName) {
          // Treat "boat already exists" as step success so user can advance to journey (Fix 1)
          results.push({
            name: toolCall.name,
            result: {
              boatAlreadyExists: true,
              boatName: duplicateByName.name,
              message: `This boat is already in your fleet. You can proceed to create your journey.`,
            },
          });
          continue;
        }

        // Check if a boat with the same make_model exists (if make_model is provided)
        if (boatData.make_model) {
          const duplicateByMakeModel = existingBoats?.find(
            (b) =>
              b.make_model &&
              b.make_model.toLowerCase().trim() === (boatData.make_model as string).toLowerCase().trim()
          );

          if (duplicateByMakeModel) {
            // Treat "boat already exists" as step success so user can advance (Fix 1)
            results.push({
              name: toolCall.name,
              result: {
                boatAlreadyExists: true,
                boatName: duplicateByMakeModel.name,
                message: `This boat is already in your fleet. You can proceed to create your journey.`,
              },
            });
            continue;
          }
        }

        const { data, error } = await supabase
          .from('boats')
          .insert(boatData)
          .select('id, name')
          .single();

        if (error) {
          results.push({
            name: toolCall.name,
            result: null,
            error: `Failed to create boat: ${error.message}`,
          });
          continue;
        }

        results.push({
          name: toolCall.name,
          result: {
            success: true,
            boatId: data.id,
            boatName: data.name,
            message: `Boat "${data.name}" created successfully`,
          },
        });
        continue;
      }

      // Journey tools
      if (toolCall.name === 'generate_journey_route') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'Authentication required to generate journey routes. Please sign up first.',
          });
          continue;
        }

        const startLocation = args.startLocation as { name: string; lat: number; lng: number };
        const endLocation = args.endLocation as { name: string; lat: number; lng: number };
        const intermediateWaypoints = (args.intermediateWaypoints as Array<{ name: string; lat: number; lng: number }>) || [];
        const boatId = args.boatId as string;
        const startDate = args.startDate as string | undefined;
        const endDate = args.endDate as string | undefined;
        // Default useSpeedPlanning to true if not provided
        const useSpeedPlanning = (args.useSpeedPlanning as boolean | undefined) ?? true;
        const boatSpeed = args.boatSpeed as number | undefined;
        const waypointDensity = (args.waypointDensity as 'minimal' | 'moderate' | 'detailed' | undefined) || 'moderate';

        if (!startLocation || !endLocation || !boatId) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'startLocation, endLocation, and boatId are required',
          });
          continue;
        }

        try {
          // Always try to get boat speed if not provided (useSpeedPlanning defaults to true)
          let speed = boatSpeed;
          if (!speed) {
            const { data: boat } = await supabase
              .from('boats')
              .select('average_speed_knots, hull_speed_knots')
              .eq('id', boatId)
              .eq('owner_id', authenticatedUserId!)
              .single();

            const hullSpeed = boat?.hull_speed_knots;
            speed = boat?.average_speed_knots ?? (typeof hullSpeed === 'number' && hullSpeed > 0 ? hullSpeed * 0.8 : undefined);
          }

          // Call shared function directly (avoids HTTP self-call which fails in serverless)
          // Use speed planning if speed is available (defaults to true)
          const { generateJourneyRoute } = await import('@/app/lib/ai/generateJourney');
          const journeyResult = await generateJourneyRoute({
            startLocation,
            endLocation,
            intermediateWaypoints,
            boatId,
            startDate,
            endDate,
            useSpeedPlanning: useSpeedPlanning && !!speed,
            boatSpeed: speed,
            waypointDensity,
          });

          if (!journeyResult.success) {
            results.push({
              name: toolCall.name,
              result: null,
              error: journeyResult.error,
            });
            continue;
          }

          const routeData = journeyResult.data;

          if (!routeData || !routeData.journeyName || !routeData.legs) {
            results.push({
              name: toolCall.name,
              result: null,
              error: 'Invalid response format from journey generation',
            });
            continue;
          }

          // Normalize risk_level: prefer AI-assessed journey risk from generate result, else tool args
          const validRiskLevels = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
          const normalizedRiskLevel = (normalizeRiskLevel(args.risk_level) || [])
            .filter(v => v && !v.includes('[') && !v.includes(']') && validRiskLevels.includes(v));
          const aiAssessedRisk = (routeData as { riskLevel?: string }).riskLevel;
          const riskLevelForCreate = (aiAssessedRisk && validRiskLevels.includes(aiAssessedRisk))
            ? [aiAssessedRisk]
            : normalizedRiskLevel;

          // Normalize skills (AI may pass as string)
          let normalizedSkills: string[] = [];
          if (Array.isArray(args.skills)) {
            normalizedSkills = args.skills.filter(s => typeof s === 'string');
          } else if (typeof args.skills === 'string') {
            try {
              const parsed = JSON.parse(args.skills);
              normalizedSkills = Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string') : [];
            } catch {
              normalizedSkills = [];
            }
          }

          // Static code: create journey and legs directly from JSON (no AI involvement)
          const createResult = await createJourneyAndLegsFromRoute(
            supabase,
            authenticatedUserId!,
            boatId,
            routeData,
            {
              risk_level: riskLevelForCreate,
              skills: normalizedSkills,
              min_experience_level: args.min_experience_level as number | undefined,
              cost_model: args.cost_model as string | undefined,
              cost_info: args.cost_info as string | undefined,
              startDate: startDate as string | undefined,
              endDate: endDate as string | undefined,
            },
            aiPrompt
          );

          if (createResult.error) {
            results.push({
              name: toolCall.name,
              result: null,
              error: createResult.error,
            });
            continue;
          }

          // Return summary for AI - journey and legs already created, proceed with rest
          const riskNote = riskLevelForCreate.length > 0
            ? ` Risk level: ${riskLevelForCreate[0]}.`
            : '';
          results.push({
            name: toolCall.name,
            result: {
              journeyCreated: true,
              journeyId: createResult.journeyId,
              journeyName: createResult.journeyName,
              legsCreated: createResult.legsCreated,
              riskLevel: riskLevelForCreate[0] ?? null,
              message: `Journey "${createResult.journeyName}" and ${createResult.legsCreated} leg(s) have been created successfully.${riskNote} [SYSTEM: Proceed with responding to the user - inform them their journey is ready. No need to call create_journey or create_leg tools.]`,
            },
          });
        } catch (e: any) {
          results.push({
            name: toolCall.name,
            result: null,
            error: e.message || 'Failed to generate journey route',
          });
        }
        continue;
      }

      if (toolCall.name === 'get_owner_journeys') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: { journeys: [], count: 0, message: 'Please sign up to view your journeys' },
          });
          continue;
        }

        const limit = (args.limit as number) || 50;

        const { data: journeys, error } = await supabase
          .from('journeys')
          .select(`
            *,
            boats!inner (
              owner_id
            )
          `)
          .eq('boats.owner_id', authenticatedUserId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          results.push({
            name: toolCall.name,
            result: null,
            error: `Failed to get journeys: ${error.message}`,
          });
          continue;
        }

        results.push({
          name: toolCall.name,
          result: { journeys: journeys || [], count: journeys?.length || 0 },
        });
        continue;
      }

      if (toolCall.name === 'get_journey_completion_status') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: {
              hasJourney: false,
              journeyCount: 0,
              message: 'Please sign up to check journey completion status',
            },
          });
          continue;
        }

        const journeyId = args.journeyId as string | undefined;

        if (journeyId) {
          const { data: journey, error } = await supabase
            .from('journeys')
            .select(`
              *,
              boats!inner (
                owner_id
              )
            `)
            .eq('id', journeyId)
            .eq('boats.owner_id', authenticatedUserId)
            .single();

          if (error || !journey) {
            results.push({
              name: toolCall.name,
              result: null,
              error: 'Journey not found',
            });
            continue;
          }

          const requiredFields = ['name', 'boat_id'];
          const filledFields: string[] = [];
          const missingFields: string[] = [];

          for (const field of requiredFields) {
            if (journey[field]) {
              filledFields.push(field);
            } else {
              missingFields.push(field);
            }
          }

          results.push({
            name: toolCall.name,
            result: {
              hasJourney: true,
              filledFields,
              missingFields,
              completionPercentage: Math.round((filledFields.length / requiredFields.length) * 100),
              journey,
            },
          });
        } else {
          const { data: journeys, error } = await supabase
            .from('journeys')
            .select(`
              id,
              boats!inner (
                owner_id
              )
            `)
            .eq('boats.owner_id', authenticatedUserId)
            .limit(1);

          if (error) {
            results.push({
              name: toolCall.name,
              result: null,
              error: `Failed to check journeys: ${error.message}`,
            });
            continue;
          }

          results.push({
            name: toolCall.name,
            result: {
              hasJourney: (journeys?.length || 0) > 0,
              journeyCount: journeys?.length || 0,
            },
          });
        }
        continue;
      }

      if (toolCall.name === 'create_journey') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'Authentication required to create a journey. Please sign up first.',
          });
          continue;
        }

        const validCostModels = ['Shared contribution', 'Owner covers all costs', 'Crew pays a fee', 'Delivery/paid crew', 'Not defined'];
    const costModel = args.cost_model && validCostModels.includes(args.cost_model as string)
      ? (args.cost_model as string)
      : 'Not defined';

    const validRiskLevels = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
    const journeyRiskLevel = (normalizeRiskLevel(args.risk_level) || [])
      .filter(v => v && !v.includes('[') && !v.includes(']') && validRiskLevels.includes(v));

    let journeySkills: string[] = [];
    if (Array.isArray(args.skills)) {
      journeySkills = args.skills.filter(s => typeof s === 'string');
    } else if (typeof args.skills === 'string') {
      try {
        const parsed = JSON.parse(args.skills);
        journeySkills = Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string') : [];
      } catch {
        journeySkills = [];
      }
    }

    const { data: journeyId, error: rpcError } = await supabase.rpc('insert_journey_with_risk', {
      p_boat_id: args.boat_id as string,
      p_name: args.name as string,
      p_start_date: (args.start_date as string) || null,
      p_end_date: (args.end_date as string) || null,
      p_description: (args.description as string) || null,
      p_risk_level: journeyRiskLevel,
      p_skills: journeySkills,
      p_min_experience_level: (args.min_experience_level as number) ?? 1,
      p_cost_model: costModel,
      p_cost_info: (args.cost_info as string) || null,
      p_state: 'In planning',
      p_ai_prompt: aiPrompt || null,
      p_is_ai_generated: !!aiPrompt,
    });

    if (rpcError || !journeyId) {
      results.push({
        name: toolCall.name,
        result: null,
        error: `Failed to create journey: ${rpcError?.message || 'Unknown error'}`,
      });
      continue;
    }

    results.push({
      name: toolCall.name,
      result: {
        success: true,
        journeyId,
        journeyName: args.name,
        message: `Journey "${args.name}" created successfully`,
      },
    });
        continue;
      }

      if (toolCall.name === 'create_leg') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'Authentication required to create a leg. Please sign up first.',
          });
          continue;
        }

        const journey_id = args.journey_id as string;
        const name = args.name as string;
        const waypoints = args.waypoints as Array<{
          index: number;
          name: string;
          geocode: { type: 'Point'; coordinates: [number, number] };
        }>;
        const start_date = args.start_date as string | undefined;
        const end_date = args.end_date as string | undefined;
        const crew_needed = args.crew_needed as number | undefined || 1;

        if (!journey_id || !name || !waypoints || waypoints.length < 2) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'journey_id, name, and at least 2 waypoints are required',
          });
          continue;
        }

        // Verify journey ownership
        const { data: journey, error: journeyError } = await supabase
          .from('journeys')
          .select(`
            id,
            boats!inner (
              owner_id
            )
          `)
          .eq('id', journey_id)
          .eq('boats.owner_id', authenticatedUserId!)
          .single();

        if (journeyError || !journey) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'Journey not found or you do not own this journey',
          });
          continue;
        }

        // Create leg
        const { data: leg, error: legError } = await supabase
          .from('legs')
          .insert({
            journey_id,
            name,
            start_date: start_date || null,
            end_date: end_date || null,
            crew_needed,
          })
          .select('id, name')
          .single();

        if (legError) {
          results.push({
            name: toolCall.name,
            result: null,
            error: `Failed to create leg: ${legError.message}`,
          });
          continue;
        }

        // Create waypoints using RPC function (handles PostGIS geometry conversion properly)
        // Convert GeoJSON format to RPC format: {index, name, lng, lat}
        const waypointsForRPC = waypoints.map(wp => ({
          index: wp.index,
          name: wp.name,
          lng: wp.geocode.coordinates[0],
          lat: wp.geocode.coordinates[1],
        }));

        const { error: waypointsError } = await supabase.rpc('insert_leg_waypoints', {
          leg_id_param: leg.id,
          waypoints_param: waypointsForRPC,
        });

        if (waypointsError) {
          log('Warning: Failed to create waypoints:', waypointsError);
          // Don't fail the leg creation, but log the error
        }

        results.push({
          name: toolCall.name,
          result: {
            success: true,
            legId: leg.id,
            legName: leg.name,
            waypointCount: waypoints.length,
            message: `Leg "${leg.name}" created successfully with ${waypoints.length} waypoint(s)`,
          },
        });
        continue;
      }

      // Unknown tool
      results.push({
        name: toolCall.name,
        result: null,
        error: `Unknown tool: ${toolCall.name}`,
      });
    } catch (e: any) {
      log(`Error executing tool ${toolCall.name}:`, e);
      results.push({
        name: toolCall.name,
        result: null,
        error: e.message || 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Main owner chat function
 */
export async function ownerChat(
  supabase: SupabaseClient,
  request: OwnerChatRequest
): Promise<OwnerChatResponse> {
  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║           OWNER CHAT - NEW REQUEST                          ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log('📥 USER MESSAGE:', request.message);
  log('📋 Session ID:', request.sessionId || '(new session)');
  log('📜 Conversation history length:', request.conversationHistory?.length || 0);
  log('👤 Profile completion mode:', request.profileCompletionMode || false);
  log('🔐 Authenticated user ID:', request.authenticatedUserId || '(none)');

  const sessionId = request.sessionId || `owner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let preferences = request.gatheredPreferences || {};
  const history = request.conversationHistory || [];
  const authenticatedUserId = request.authenticatedUserId || null;
  const userProfile = request.userProfile || null;
  const isProfileCompletionMode = request.profileCompletionMode && !!authenticatedUserId;

  // Check completion status (only if authenticated)
  let hasProfile = false;
  let hasBoat = false;
  let hasJourney = false;

  if (authenticatedUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, roles')
      .eq('id', authenticatedUserId)
      .maybeSingle();

    if (profile) {
      hasProfile = true;
      const roles = profile.roles as string[] | null;
      if (!roles || !roles.includes('owner')) {
        // User doesn't have owner role yet - will be set during profile creation
      }
    }

    const { data: boats } = await supabase
      .from('boats')
      .select('id')
      .eq('owner_id', authenticatedUserId)
      .limit(1);

    hasBoat = (boats?.length || 0) > 0;

    const { data: journeys } = await supabase
      .from('journeys')
      .select(`
        id,
        boats!inner (
          owner_id
        )
      `)
      .eq('boats.owner_id', authenticatedUserId)
      .limit(1);

    hasJourney = (journeys?.length || 0) > 0;
  }

  const currentStep = deriveOwnerStep(authenticatedUserId, hasProfile, hasBoat, hasJourney);
  const allowedToolNames = new Set(TOOLS_BY_STEP[currentStep]);
  log('📊 Completion status:', { hasProfile, hasBoat, hasJourney, currentStep });

  // For post_journey step, load boat id and name to inject into prompt (AI does not call get_owner_boats)
  let boatId: string | undefined;
  let boatName: string | undefined;
  if (authenticatedUserId && currentStep === 'post_journey') {
    const { data: boats } = await supabase
      .from('boats')
      .select('id, name')
      .eq('owner_id', authenticatedUserId)
      .limit(1);
    if (boats?.length) {
      boatId = boats[0].id;
      boatName = boats[0].name ?? undefined;
    }
  }

  // Handle approved action (requires authentication)
  if (request.approvedAction) {
    if (!authenticatedUserId) {
      return {
        sessionId,
        message: {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: 'You need to sign up before you can perform this action. Please sign up to continue.',
          timestamp: new Date().toISOString(),
        },
        extractedPreferences: undefined,
      };
    }
    const actionName = request.approvedAction.toolName;
    log('✅ Executing approved action:', actionName);

    const toolCall: ToolCall = {
      id: `approved_${Date.now()}`,
      name: actionName,
      arguments: request.approvedAction.arguments,
    };

    const now = new Date();
    const systemPrompt = buildOwnerPromptForStep(currentStep, {
      currentDate: now.toISOString().split('T')[0],
      userProfile: userProfile ?? null,
      preferences,
      boatId,
      boatName,
      isProfileCompletionMode,
    });
    const approvedActionPrompt = `${systemPrompt}\n\nuser: ${request.message}`;
    const toolResults = await executeOwnerTools(supabase, [toolCall], authenticatedUserId, allowedToolNames, approvedActionPrompt);
    const result = toolResults[0];

    let responseContent: string;
    let profileCreated = false;
    let boatCreated = false;
    let journeyCreated = false;

    if (result?.error) {
      responseContent = `There was an issue: ${result.error}\n\nPlease try again.`;
    } else {
      if (actionName === 'update_user_profile') {
        profileCreated = true;
        responseContent = `Your profile has been saved successfully! You're now set up as a boat owner.`;
      } else if (actionName === 'create_boat') {
        boatCreated = true;
        const createdBoatName = (result?.result as { boatName?: string })?.boatName || 'your boat';
        responseContent = `Your boat "${createdBoatName}" has been created successfully!`;
      } else if (actionName === 'create_journey' || actionName === 'generate_journey_route') {
        journeyCreated = true;
        const routeData = result?.result as { journeyName?: string; legsCreated?: number };
        const journeyName = routeData?.journeyName || 'your journey';
        const legsCount = routeData?.legsCreated ?? 0;
        responseContent = `Your journey "${journeyName}" has been created successfully!${legsCount ? ` ${legsCount} leg(s) created.` : ''}`;
      } else {
        responseContent = `Action completed successfully!`;
      }
    }

    const responseMessage: OwnerMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date().toISOString(),
    };

    return {
      sessionId,
      message: responseMessage,
      extractedPreferences: undefined,
      profileCreated,
      boatCreated,
      journeyCreated,
    };
  }

  const now = new Date();
  const systemPrompt = buildOwnerPromptForStep(currentStep, {
    currentDate: now.toISOString().split('T')[0],
    userProfile: userProfile ?? null,
    preferences,
    boatId,
    boatName,
    isProfileCompletionMode,
  });

  // Build messages for AI
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (limit to last N messages)
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
  for (const msg of recentHistory) {
    if (msg.role !== 'system') {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: request.message,
  });

  // Process with tool loop
  let allToolCalls: ToolCall[] = [];
  let currentMessages = [...messages];
  let iterations = 0;
  let finalContent = '';
  let profileCreated = false;
  let boatCreated = false;
  let journeyCreated = false;
  let addBoatNudgeCount = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    log('');
    log(`🔄 ITERATION ${iterations}/${MAX_TOOL_ITERATIONS}`);

    // Build prompt text for AI call
    const promptText = currentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    
    // Build full prompt text for saving to database (includes system prompt + conversation)
    // This will be passed to tool execution to save with journeys
    const fullPromptText = currentMessages
      .map(m => `${m.role === 'system' ? 'system' : m.role}: ${m.content}`)
      .join('\n\n');

    const result = await callAI({
      useCase: 'owner-chat',
      prompt: promptText,
    });

    log('📥 AI RESPONSE:', `${result.text.length} chars from ${result.provider}/${result.model}`);
    log('📄 RAW AI RESPONSE TEXT:');
    log('─'.repeat(60));
    log(result.text);
    log('─'.repeat(60));

    const { content, toolCalls } = parseToolCalls(result.text);

    log('🔧 PARSED TOOL CALLS:', toolCalls.length);

    if (toolCalls.length === 0) {
      // Add boat step: if user confirmed and AI either showed a boat summary or claimed boat was created (without calling create_boat), nudge once
      const lastUserMessage = request.message.trim().toLowerCase();
      const looksLikeConfirmation = /^(yes|yeah|yep|ok|okay|confirm|looks good|sounds good|correct|go ahead|create it|do it|please call create_boat|please create the boat)$/.test(lastUserMessage) || lastUserMessage.length < 60 && (/\b(yes|ok|confirm|good|correct|go ahead)\b/.test(lastUserMessage)) || (lastUserMessage.length < 80 && /\bconfirm\b.*\bboat\b/i.test(lastUserMessage));
      const looksLikeBoatSummary = (/\b(name|type|capacity|make|model):\s*\S+/i.test(result.text) || /boat.*summary|here('s| is) (your|the) boat/i.test(result.text)) && !/create_boat|tool_call/.test(result.text);
      const looksLikeBoatCreatedWithoutTool = /(?:created successfully|boat profile.*created|your boat.*has been created|boat has been created)/i.test(result.text) && !/create_boat|tool_call/.test(result.text);
      if (currentStep === 'add_boat' && looksLikeConfirmation && (looksLikeBoatSummary || looksLikeBoatCreatedWithoutTool)) {
        if (addBoatNudgeCount >= 2) {
          log('⚠️ Add boat: nudge cap reached - suggesting boat may already exist');
          currentMessages.push(
            { role: 'assistant', content: result.text },
            { role: 'user', content: 'The boat may already be in the user\'s fleet. Respond briefly that they can proceed to create their first journey and suggest "Create your first journey" as the next step. Do not call any tools.' }
          );
          continue;
        }
        log('⚠️ Add boat: user confirmed but no create_boat call - nudging AI');
        addBoatNudgeCount += 1;
        currentMessages.push(
          { role: 'assistant', content: result.text },
          { role: 'user', content: 'The user confirmed. You MUST call the create_boat tool in this response. Use exactly this structure with the boat details from your last message: ```tool_call\n{"name": "create_boat", "arguments": {"name": "...", "type": "...", "make_model": "...", "capacity": ...}}\n``` Replace the ... with the actual name, type, make_model, and capacity you already showed. No other tool is allowed in this step.' }
        );
        continue;
      }

      // Check if AI tried to call a tool but failed to parse
      const attemptedToolCall = /(?:tool_call|generate_journey_route|create_boat|create_journey|update_user_profile)/i.test(result.text);
      const hasToolCallSyntax = /```(?:tool_calls?|tool_code)/i.test(result.text) || /<tool_call>/i.test(result.text);
      
      if (attemptedToolCall || hasToolCallSyntax) {
        // AI tried to call a tool but it failed to parse
        log('⚠️ AI attempted tool call but parsing failed - providing feedback');
        const feedbackMessage = `\n\n**ERROR: Your tool call failed to parse. Please try again with complete, valid JSON.**\n\nCommon issues:\n- Missing required arguments (use {...} placeholders)\n- Invalid JSON format\n- Incomplete tool call syntax\n\nPlease retry the tool call with all required arguments filled in. Do not use placeholder text like {...} - provide actual values.`;
        
        currentMessages.push(
          { role: 'assistant', content: result.text },
          { role: 'user', content: feedbackMessage }
        );
        
        // Continue loop to retry instead of breaking
        continue;
      }
      
      // Sanitize content to remove any malformed tool call syntax
      finalContent = sanitizeContent(content, false);
      
      // Solution 4: Detect and prevent hallucination
      // Only add correction when AI claims a tool was called but there was no successful call for that action in this request.
      // If the tool actually succeeded in a previous iteration (e.g. create_boat), the follow-up message describing that success is not a hallucination.
      const claimedToolCall = /(?:created|called|executed|ran|completed|I've created|I've called).*?(?:generate_journey_route|create_journey|create_boat|update_user_profile|journey|boat|profile)/i;
      const contentClaimsToolSuccess = claimedToolCall.test(finalContent) && toolCalls.length === 0;
      if (contentClaimsToolSuccess) {
        const describesActualSuccess =
          (/\b(boat|create_boat)\b/i.test(finalContent) && boatCreated) ||
          (/\b(profile|update_user_profile)\b/i.test(finalContent) && profileCreated) ||
          (/\b(journey|generate_journey_route|create_journey)\b/i.test(finalContent) && journeyCreated);
        if (!describesActualSuccess) {
          log('⚠️ AI hallucinated tool call success - adding correction');
          finalContent += '\n\n**Note:** I attempted to call the tool, but the tool call format was incorrect and could not be parsed. Please try again or let me know if you need help with the correct format.';
        }
      }
      
      log('✅ No tool calls, final content ready');
      break;
    }

    allToolCalls.push(...toolCalls);
    const toolResults = await executeOwnerTools(supabase, toolCalls, authenticatedUserId, allowedToolNames, fullPromptText);

    log('📊 TOOL RESULTS:');
    toolResults.forEach((r, i) => {
      if (r.error) {
        log(`  [${i}] ${r.name}: ❌ Error: ${r.error}`);
      } else {
        const resultStr = JSON.stringify(r.result);
        log(`  [${i}] ${r.name}: ✅ ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);
      }
    });

    // Check for successful creations
    const profileResult = toolResults.find(r => r.name === 'update_user_profile' && !r.error);
    const boatResult = toolResults.find(r => r.name === 'create_boat' && !r.error);
    const journeyResult = toolResults.find(r => r.name === 'create_journey' && !r.error);
    const routeResult = toolResults.find(r => r.name === 'generate_journey_route' && !r.error);

    if (profileResult) {
      profileCreated = true;
      log('🎉 Profile created successfully!');
    }
    if (boatResult) {
      boatCreated = true;
      log('🎉 Boat created successfully!');
    }
    if (journeyResult) {
      journeyCreated = true;
      log('🎉 Journey created successfully!');
    }
    if (routeResult && (routeResult.result as { journeyCreated?: boolean })?.journeyCreated) {
      journeyCreated = true;
      log('🎉 Journey and legs created via generate_journey_route!');
      
      // Journey is already created - return final success message directly
      // No need to call AI again since journey creation is complete
      const routeResultData = routeResult.result as { journeyName?: string; legsCreated?: number; journeyId?: string };
      finalContent = `🎉 **Congratulations! Your journey has been created successfully!**

**Journey:** ${routeResultData.journeyName || 'Your journey'}
**Legs created:** ${routeResultData.legsCreated || 0}

Your journey is now ready for you to review and manage. You can:
- View and edit your journey details
- Manage legs and waypoints
- Start accepting crew registrations when ready

**You've completed the onboarding process!** You're now ready to start planning and managing your sailing adventures.`;
      
      log('✅ Journey created via generate_journey_route - returning final response directly');
      break;
    }

    // Add tool results for next iteration (only if journey wasn't created)
    const toolResultsText = formatToolResultsForAI(toolResults);
    const contextMessage = `Tool results:\n${toolResultsText}\n\nNow provide a helpful response to the user.`;

    currentMessages.push(
      { role: 'assistant', content: result.text },
      { role: 'user', content: contextMessage }
    );
  }

  // Create response message
  const responseMessage: OwnerMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    content: finalContent,
    timestamp: new Date().toISOString(),
    metadata: {
      toolCalls: allToolCalls.length > 0 ? allToolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments as Record<string, unknown>,
      })) : undefined,
    },
  };

  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║           OWNER CHAT - COMPLETE                              ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log('📤 FINAL RESPONSE:', `${finalContent.length} chars`);
  log('📊 Tool calls:', allToolCalls.length);
  log('✅ Created:', { profile: profileCreated, boat: boatCreated, journey: journeyCreated });

  return {
    sessionId,
    message: responseMessage,
    extractedPreferences: undefined,
    profileCreated,
    boatCreated,
    journeyCreated,
  };
}
