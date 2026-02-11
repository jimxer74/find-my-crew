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
  normalizeDateArgs,
  normalizeLocationArgs,
  normalizeBboxArgs,
  formatToolResultsForAI,
  ToolCall,
  // Tool registry
  getToolsForUser,
  toolsToPromptFormat,
} from '../shared';
import {
  OwnerMessage,
  OwnerChatRequest,
  OwnerChatResponse,
  OwnerPreferences,
} from './types';
import { searchLocation, LocationSearchResult } from '@/app/lib/geocoding/locations';
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
 * Extract location mentions from a message using exact (case-insensitive) matching
 * against the predefined LocationRegion names and aliases.
 */
function extractMatchedLocations(message: string): LocationSearchResult[] {
  return searchLocation(message);
}

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

/**
 * Normalize risk_level field to ensure it's a proper array
 */
function normalizeRiskLevel(value: unknown): string[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (Array.isArray(value)) {
    return value.filter(v => typeof v === 'string' && v.length > 0);
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(v => typeof v === 'string' && v.length > 0);
        }
        if (typeof parsed === 'string') {
          return [parsed];
        }
      } catch {
        // If JSON parsing fails, treat as single string value
      }
    }
    
    return trimmed.length > 0 ? [trimmed] : null;
  }
  
  return [String(value)];
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
 * Build system prompt for owner onboarding chat
 */
function buildOwnerSystemPrompt(
  preferences: OwnerPreferences,
  matchedLocations?: LocationSearchResult[],
  hasProfile?: boolean,
  hasBoat?: boolean,
  hasJourney?: boolean,
  isProfileCompletionMode?: boolean,
  userProfile?: { fullName?: string | null; email?: string | null; phone?: string | null; avatarUrl?: string | null } | null,
  isAuthenticated?: boolean
): string {
  const hasPreferences = Object.keys(preferences).some(
    key => preferences[key as keyof OwnerPreferences] !== undefined
  );

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentYear = now.getFullYear();

  const isUserAuthenticated = isAuthenticated ?? false;
  
  let prompt = `You are SailSmart's friendly AI assistant helping boat owners and skippers complete their onboarding.

CURRENT DATE: ${currentDate}

## AUTHENTICATION STATUS:
${isUserAuthenticated ? '✅ User is signed up and authenticated' : '❌ User is NOT signed up yet - SIGNUP IS REQUIRED FIRST'}

## PRIMARY GOAL: Complete Owner Onboarding (CRITICAL)

${isUserAuthenticated ? `
**FOR AUTHENTICATED USERS:** Your goal is to guide the user through three main steps:
1. **Profile Creation** - Gather owner profile information and save it (if not already done)
2. **Boat Creation** - Help create their boat with detailed specifications (if not already done)
3. **First Journey Creation** - Assist in creating their first sailing journey with legs (if not already done)

**CRITICAL FIRST STEP:** When you receive a message from an authenticated user, you MUST immediately check what's already completed by calling these tools:
- get_profile_completion_status
- get_boat_completion_status
- get_journey_completion_status
- get_owner_boats
- get_owner_journeys

**COMPLETION STATUS:**
${hasProfile ? '✅ Profile: Created' : '❌ Profile: Not created'}
${hasBoat ? '✅ Boat: Created' : '❌ Boat: Not created'}
${hasJourney ? '✅ Journey: Created' : '❌ Journey: Not created'}

**FLEXIBLE FLOW:** Guide the user based on what's missing. Check completion status FIRST, then guide them to the next missing piece. The user can complete these in any order - adapt to their needs.
` : `
**FOR UNAUTHENTICATED USERS (NOT SIGNED UP YET):**

**CRITICAL: DO NOT CALL ANY COMPLETION STATUS TOOLS OR DATA TOOLS**
- The user has NOT signed up yet
- They have NO profile, boats, or journeys
- Calling get_profile_completion_status, get_boat_completion_status, get_journey_completion_status, get_owner_boats, or get_owner_journeys will FAIL

**YOUR PRIMARY GOAL:** Guide them to sign up first!
1. Welcome them warmly
2. Explain the benefits of signing up (create profile, add boat, create journeys)
3. Encourage them to click "Sign Up" or "Log In" button
4. Once they sign up, THEN you can help with profile/boat/journey creation

**DO NOT:**
- Call any completion status tools
- Ask about their boat or journey details yet
- Try to create profiles/boats/journeys before signup

**DO:**
- Be friendly and welcoming
- Explain what SailSmart offers
- Guide them to sign up
- Answer general questions about the platform
`}

## CONVERSATION STYLE:
- Be warm, enthusiastic, and conversational
- Ask one or two questions at a time, not long lists
- Gather information naturally through conversation
- Confirm before creating (boat, journey) - present summary and get user approval
- Keep responses concise and focused

## SKILLS HANDLING (CRITICAL):
When users mention skills, you MUST use ONLY the exact skill names from the skills config:
${getSkillsStructure()}

**SKILLS RULES:**
- You MUST use ONLY the exact skill names listed above
- Do NOT create custom skills
- When storing skills in profile, use format: [{"skill_name": "exact_name_from_config", "description": "user's description"}]

## PROFILE CREATION:
${isProfileCompletionMode ? `
**PROFILE COMPLETION MODE**

You are helping an authenticated user complete their profile after signing up.

**CRITICAL: EXTRACT INFORMATION FROM CONVERSATION HISTORY**

You MUST carefully review the ENTIRE conversation history above. Extract:
- Bio/description: Personal story, background, journey, personality traits
- Experience: Sailing courses, trips, crossings, time on water
- Skills: Map to exact skill names from config
- Certifications: Any sailing qualifications mentioned
- Comfort zones: Based on experience level
- Preferences: What kind of sailing they do/prefer

${(() => {
  const known: string[] = [];
  if (userProfile?.fullName) known.push(`- **Name:** "${userProfile.fullName}"`);
  if (userProfile?.email) known.push(`- **Email:** "${userProfile.email}"`);
  if (userProfile?.phone) known.push(`- **Phone:** "${userProfile.phone}"`);
  if (userProfile?.avatarUrl) known.push(`- **Profile photo:** Already set`);
  if (known.length > 0) {
    return `\n**FROM SIGNUP/OAUTH:**\n${known.join('\n')}\n`;
  }
  return '';
})()}

**PRIORITY:** Present profile summary FIRST, get confirmation, then call \`update_user_profile\` with roles: ['owner'].
` : `
- Gather minimal needed information: [full_name, user_description, sailing_experience, sailing_preferences, risk_level]
- When user confirms, call \`update_user_profile\` with roles: ['owner'] (CRITICAL - must set owner role)
- **When the user tells you their full name**, include tag: [OWNER_NAME: Their Full Name]
`}

## BOAT CREATION:
**Workflow:**
1. Ask about boat make/model (e.g., "Bavaria 46", "Hallberg-Rassy 38").
3. Verify the make/model is correct and find a match in sailboatdata.com database or other sources.
4. **Call \`fetch_boat_details_from_sailboatdata\` tool** when user provides make/model:
   - This screenscrapes sailboatdata.com for detailed specs
   - Pre-fills: type, capacity, LOA, beam, displacement, performance metrics, characteristics, capabilities, accommodations
5. Gather additional info: boat name, home port, country flag
6. Present complete boat summary to user for confirmation
7. Call \`create_boat\` tool after user confirms

**Boat Fields:**
- Required: name, type, make_model, capacity
- Optional: home_port, country_flag, all specs from screenscraping

## JOURNEY CREATION:
**Workflow:**
1. Ask about route: start location, end location, waypoints, dates
2. **Call \`generate_journey_route\` tool** when user describes route:
   - This generates the journey structure and **automatically creates the journey and all legs in the database**
   - No need to call create_journey or create_leg - the system creates them from the generated route
   - Pass optional risk_level, skills, min_experience_level, cost_model, cost_info if user has specified them
   - Returns confirmation that journey and legs were created
3. After generate_journey_route succeeds, inform the user their journey is ready

**Journey Fields:**
- Required: boat_id, name
- Optional: start_date, end_date, description, risk_level, skills, min_experience_level, cost_model (Shared contribution, Owner covers all costs, Crew pays a fee, Delivery/paid crew, Not defined), cost_info (free text for crew about costs)

${hasPreferences ? `
GATHERED PREFERENCES SO FAR:
${preferences.fullName ? `- Name: ${preferences.fullName}` : ''}
${preferences.boatMakeModel ? `- Boat: ${preferences.boatMakeModel}` : ''}
${preferences.journeyName ? `- Journey: ${preferences.journeyName}` : ''}
` : ''}

## SUGGESTED PROMPTS:
At the end of your response, include 2-3 suggested follow-up questions:
[SUGGESTIONS]
- Contextual suggestions based on what's missing
- [IMPORTANT] tag for most critical next step
[/SUGGESTIONS]

**When the user tells you their full name**, include tag: [OWNER_NAME: Their Full Name] at the end of your message.

## TOOLS AVAILABLE:
- Profile: update_user_profile, get_profile_completion_status
- Boat: fetch_boat_details_from_sailboatdata, create_boat, get_owner_boats, get_boat_completion_status
- Journey: generate_journey_route (creates journey + legs automatically), get_owner_journeys
- Definitions: get_experience_level_definitions, get_risk_level_definitions, get_skills_definitions

**CRITICAL:** Always check completion status before proceeding. Guide user to next missing piece.`;

  return prompt;
}

/**
 * Build tool instructions for the AI
 */
function buildToolInstructions(
  isAuthenticated: boolean = false,
  hasProfile?: boolean,
  hasBoat?: boolean,
  hasJourney?: boolean
): string {
  // Get tools for owner role
  let tools = getToolsForUser(['owner']);

  // Exclude create_journey and create_leg - journey creation is handled by generate_journey_route
  // (tools remain in definitions for future use)
  tools = tools.filter(tool => tool.name !== 'create_journey' && tool.name !== 'create_leg');
  
  // Filter out tools that are no longer needed based on completion status
  if (hasProfile) {
    // Profile is complete, don't offer update_user_profile tool
    tools = tools.filter(tool => tool.name !== 'update_user_profile');
  }
  
  if (hasBoat) {
    // Boat is already created, don't offer create_boat tool
    tools = tools.filter(tool => tool.name !== 'create_boat');
  }
  
  const toolsDescription = toolsToPromptFormat(tools);

  if (!isAuthenticated) {
    return `
AVAILABLE TOOLS:
${toolsDescription}

**CRITICAL: USER IS NOT AUTHENTICATED YET**

**DO NOT CALL THESE TOOLS FOR UNAUTHENTICATED USERS:**
- get_profile_completion_status (will fail - no profile exists)
- get_boat_completion_status (will fail - no boats exist)
- get_journey_completion_status (will fail - no journeys exist)
- get_owner_boats (will fail - user not signed up)
- get_owner_journeys (will fail - user not signed up)
- create_boat (requires authentication)
- create_journey (requires authentication)
- update_user_profile (requires authentication)

**ONLY USE THESE TOOLS AFTER USER SIGNS UP:**
- get_experience_level_definitions (public - OK to use)
- get_risk_level_definitions (public - OK to use)
- get_skills_definitions (public - OK to use)

**YOUR FOCUS:** Guide the user to sign up first. Do not call completion status tools.
`;
  }

  // Build completion status message
  const completionStatus = [];
  if (hasProfile) completionStatus.push('✅ Profile: Already created');
  if (hasBoat) completionStatus.push('✅ Boat: Already created');
  if (hasJourney) completionStatus.push('✅ Journey: Already created');
  
  const completionMessage = completionStatus.length > 0 
    ? `\n**COMPLETION STATUS:**\n${completionStatus.join('\n')}\n\n**NOTE:** Tools for already completed items (${hasProfile ? 'update_user_profile' : ''}${hasProfile && hasBoat ? ', ' : ''}${hasBoat ? 'create_boat' : ''}) are NOT available since they're already done.\n`
    : '';

  return `
AVAILABLE TOOLS:
${toolsDescription}
${completionMessage}
**CRITICAL: USER IS AUTHENTICATED - YOU CAN USE ALL AVAILABLE TOOLS**

When the user greets you or asks about onboarding, you MUST immediately check what's missing by calling these tools:
1. get_profile_completion_status
2. get_boat_completion_status  
3. get_journey_completion_status
4. get_owner_boats (to see if they have boats)
5. get_owner_journeys (to see if they have journeys)

**TO USE A TOOL, wrap it in a code block like this:**

\`\`\`tool_call
{"name": "get_profile_completion_status", "arguments": {}}
\`\`\`

**MULTIPLE TOOLS: You can call multiple tools at once:**

\`\`\`tool_call
{"name": "get_profile_completion_status", "arguments": {}}
\`\`\`

\`\`\`tool_call
{"name": "get_boat_completion_status", "arguments": {}}
\`\`\`

\`\`\`tool_call
{"name": "get_journey_completion_status", "arguments": {}}
\`\`\`

\`\`\`tool_call
{"name": "get_owner_boats", "arguments": {}}
\`\`\`

\`\`\`tool_call
{"name": "get_owner_journeys", "arguments": {}}
\`\`\`

**IMPORTANT:**
- Each tool call MUST be in its own separate code block
- The format is: \`\`\`tool_call followed by a newline, then JSON, then \`\`\`
- JSON must have "name" (string) and "arguments" (object) keys
- Empty arguments use {} not null or undefined
- After calling tools, wait for the results before responding to the user

**TOOL USAGE GUIDELINES:**
- ALWAYS check completion status tools FIRST when starting a conversation
- Use tools to gather information before making recommendations
- Always confirm with user before creating boat or journey
- Use fetch_boat_details_from_sailboatdata before create_boat
- **JOURNEY:** generate_journey_route automatically creates the journey AND all legs - do NOT call create_journey or create_leg after it. Just inform the user their journey is ready.
`;
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
  }
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

  const journeyData = {
    boat_id: boatId,
    name: routeData.journeyName,
    description: routeData.description || null,
    start_date: firstLeg?.start_date ?? metadata.startDate ?? null,
    end_date: lastLeg?.end_date ?? metadata.endDate ?? null,
    risk_level: metadata.risk_level || [],
    skills: metadata.skills || [],
    min_experience_level: metadata.min_experience_level ?? 1,
    cost_model: metadata.cost_model && ['Shared contribution', 'Owner covers all costs', 'Crew pays a fee', 'Delivery/paid crew', 'Not defined'].includes(metadata.cost_model)
      ? metadata.cost_model
      : 'Not defined',
    cost_info: metadata.cost_info || null,
    state: 'In planning',
  };

  const { data: journey, error: journeyError } = await supabase
    .from('journeys')
    .insert(journeyData)
    .select('id, name')
    .single();

  if (journeyError || !journey) {
    return {
      journeyId: '',
      journeyName: routeData.journeyName,
      legsCreated: 0,
      error: `Failed to create journey: ${journeyError?.message || 'Unknown error'}`,
    };
  }

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
 * Execute owner tool calls
 * Requires authentication for action tools (create_boat, create_journey, create_leg, update_user_profile)
 * Data tools can work without authentication
 */
async function executeOwnerTools(
  supabase: SupabaseClient,
  toolCalls: ToolCall[],
  authenticatedUserId: string | null,
  hasProfile?: boolean,
  hasBoat?: boolean,
  hasJourney?: boolean
): Promise<Array<{ name: string; result: unknown; error?: string }>> {
  const results: Array<{ name: string; result: unknown; error?: string }> = [];

  for (const toolCall of toolCalls) {
    log('Executing tool:', toolCall.name);
    log('Raw arguments:', JSON.stringify(toolCall.arguments));

    // Reject tools that are filtered out based on completion status
    if (hasProfile && toolCall.name === 'update_user_profile') {
      results.push({
        name: toolCall.name,
        result: null,
        error: 'Profile is already complete. This tool is no longer available.',
      });
      continue;
    }

    if (hasBoat && toolCall.name === 'create_boat') {
      results.push({
        name: toolCall.name,
        result: null,
        error: 'A boat already exists. This tool is no longer available. Use get_owner_boats to view your existing boat.',
      });
      continue;
    }

    if (hasJourney && toolCall.name === 'create_journey') {
      results.push({
        name: toolCall.name,
        result: null,
        error: 'A journey already exists. This tool is no longer available. Use get_owner_journeys to view your existing journeys.',
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
          'phone', 'profile_image_url'
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
          // Call internal API endpoint
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sailboatdata/fetch-details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ make_model, slug }),
          });

          if (!response.ok) {
            // Try AI fallback
            const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/fill-boat-details`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ make_model }),
            });

            if (!aiResponse.ok) {
              results.push({
                name: toolCall.name,
                result: null,
                error: 'Failed to fetch boat details from both screenscraping and AI',
              });
              continue;
            }

            const aiData = await aiResponse.json();
            results.push({
              name: toolCall.name,
              result: aiData.boatDetails || null,
            });
            continue;
          }

          const data = await response.json();
          results.push({
            name: toolCall.name,
            result: data.boatDetails || null,
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
          results.push({
            name: toolCall.name,
            result: null,
            error: `A boat named "${duplicateByName.name}" already exists. Please use a different name or update the existing boat.`,
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
            results.push({
              name: toolCall.name,
              result: null,
              error: `A boat with make/model "${duplicateByMakeModel.make_model}" already exists (named "${duplicateByMakeModel.name}"). Please use a different make/model or update the existing boat.`,
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
        const useSpeedPlanning = args.useSpeedPlanning as boolean | undefined;
        const boatSpeed = args.boatSpeed as number | undefined;

        if (!startLocation || !endLocation || !boatId) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'startLocation, endLocation, and boatId are required',
          });
          continue;
        }

        try {
          // Get boat speed if not provided but useSpeedPlanning is true
          let speed = boatSpeed;
          if (useSpeedPlanning && !speed) {
            const { data: boat } = await supabase
              .from('boats')
              .select('average_speed_knots')
              .eq('id', boatId)
              .eq('owner_id', authenticatedUserId!)
              .single();

            speed = boat?.average_speed_knots || undefined;
          }

          // Call internal API endpoint
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/generate-journey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startLocation,
              endLocation,
              intermediateWaypoints,
              boatId,
              startDate,
              endDate,
              useSpeedPlanning: useSpeedPlanning && !!speed,
              boatSpeed: speed,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            results.push({
              name: toolCall.name,
              result: null,
              error: errorData.error || 'Failed to generate journey route',
            });
            continue;
          }

          const data = await response.json();
          const routeData = data.data;

          if (!routeData || !routeData.journeyName || !routeData.legs) {
            results.push({
              name: toolCall.name,
              result: null,
              error: 'Invalid response format from journey generation',
            });
            continue;
          }

          // Normalize risk_level (AI may pass string "["Offshore sailing"]" instead of array)
          const validRiskLevels = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
          const normalizedRiskLevel = (normalizeRiskLevel(args.risk_level) || [])
            .filter(v => validRiskLevels.includes(v));

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
              risk_level: normalizedRiskLevel,
              skills: normalizedSkills,
              min_experience_level: args.min_experience_level as number | undefined,
              cost_model: args.cost_model as string | undefined,
              cost_info: args.cost_info as string | undefined,
              startDate: startDate as string | undefined,
              endDate: endDate as string | undefined,
            }
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
          results.push({
            name: toolCall.name,
            result: {
              journeyCreated: true,
              journeyId: createResult.journeyId,
              journeyName: createResult.journeyName,
              legsCreated: createResult.legsCreated,
              message: `Journey "${createResult.journeyName}" and ${createResult.legsCreated} leg(s) have been created successfully. [SYSTEM: Proceed with responding to the user - inform them their journey is ready. No need to call create_journey or create_leg tools.]`,
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
      .filter(v => validRiskLevels.includes(v));

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

    const journeyData: Record<string, unknown> = {
          boat_id: args.boat_id as string,
          name: args.name as string,
          start_date: args.start_date as string | undefined || null,
          end_date: args.end_date as string | undefined || null,
          description: args.description as string | undefined || null,
          risk_level: journeyRiskLevel,
          skills: journeySkills,
          min_experience_level: args.min_experience_level as number | undefined || 1,
          cost_model: costModel,
          cost_info: (args.cost_info as string) || null,
          state: 'In planning',
        };

        // Verify boat ownership
        const { data: boat, error: boatError } = await supabase
          .from('boats')
          .select('owner_id')
          .eq('id', journeyData.boat_id)
          .eq('owner_id', authenticatedUserId!)
          .single();

        if (boatError || !boat) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'Boat not found or you do not own this boat',
          });
          continue;
        }

        const { data, error } = await supabase
          .from('journeys')
          .insert(journeyData)
          .select('id, name')
          .single();

        if (error) {
          results.push({
            name: toolCall.name,
            result: null,
            error: `Failed to create journey: ${error.message}`,
          });
          continue;
        }

        results.push({
          name: toolCall.name,
          result: {
            success: true,
            journeyId: data.id,
            journeyName: data.name,
            message: `Journey "${data.name}" created successfully`,
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

  log('📊 Completion status:', { hasProfile, hasBoat, hasJourney });

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

    const toolResults = await executeOwnerTools(supabase, [toolCall], authenticatedUserId, hasProfile, hasBoat, hasJourney);
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
        const boatName = (result?.result as { boatName?: string })?.boatName || 'your boat';
        responseContent = `Your boat "${boatName}" has been created successfully!`;
      } else if (actionName === 'create_journey') {
        journeyCreated = true;
        const journeyName = (result?.result as { journeyName?: string })?.journeyName || 'your journey';
        responseContent = `Your journey "${journeyName}" has been created successfully!`;
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

  // Extract matched locations
  const matchedLocations = extractMatchedLocations(request.message);
  if (matchedLocations.length > 0) {
    log('📍 PRE-RESOLVED LOCATIONS:', matchedLocations.map(m => `${m.region.name} (matched: "${m.matchedTerm}")`));
  }

  // Build system prompt
  let systemPrompt = buildOwnerSystemPrompt(
    preferences,
    matchedLocations,
    hasProfile,
    hasBoat,
    hasJourney,
    isProfileCompletionMode,
    userProfile,
    !!authenticatedUserId
  );

  // Add tool instructions (conditional based on authentication and completion status)
  systemPrompt += buildToolInstructions(!!authenticatedUserId, hasProfile, hasBoat, hasJourney);

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

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    log('');
    log(`🔄 ITERATION ${iterations}/${MAX_TOOL_ITERATIONS}`);

    const promptText = currentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');

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
      finalContent = content;
      log('✅ No tool calls, final content ready');
      break;
    }

    allToolCalls.push(...toolCalls);
    const toolResults = await executeOwnerTools(supabase, toolCalls, authenticatedUserId, hasProfile, hasBoat, hasJourney);

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
    }

    // Add tool results for next iteration
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
