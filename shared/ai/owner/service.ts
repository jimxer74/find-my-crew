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

import { logger } from '@shared/logging';
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
import { getAllRegions } from '@shared/utils/geocoding/locations';
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
    logger.debug(`[Owner Chat Service] ${message}`, data !== undefined ? (data as Record<string, any>) : undefined);
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
  signup: ['search_matching_crew', 
    'get_experience_level_definitions', 
    'get_risk_level_definitions', 
    'get_skills_definitions'],
  create_profile: [
    'search_matching_crew', 
    'update_user_profile', 
    'get_experience_level_definitions', 
    'get_risk_level_definitions', 
    'get_skills_definitions',
    // Disabled for now to keep the processing time in control, Vercel default is 60 seconds, so until
    // there is a robust backend queue based solution for running long AI jobs, keep this simpler
    //'fetch_boat_details_from_sailboatdata',
    //'create_boat',
  ],
  add_boat: [
    'fetch_boat_details_from_sailboatdata', 
    'create_boat',
    // Allow journey creation if user provides journey details during boat setup
    // Disabled for now to keep the processing time in control, Vercel default is 60 seconds, so until
    // there is a robust backend queue based solution for running long AI jobs, keep this simpler
    //'generate_journey_route',
  ],
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
    skipperProfile?: string | null;
    crewRequirements?: string | null;
    journeyDetails?: string | null;
    importedProfile?: { url: string; source: string; content: string } | null;
  }
): string {
  const tools = getToolsForOwnerStep(step);
  const toolsBlock = formatStepToolsForPrompt(tools);
  const { currentDate, userProfile, boatId, boatName, isProfileCompletionMode, skipperProfile, crewRequirements, journeyDetails, importedProfile } = opts;

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
**Goal:** Be welcoming. Show platform value by ALLWAYS providing examples of 
matching crew by using the tool search_matching_crew, resolve and deep reason the search
criteria based on given information if available from user input, do not ask for more information at this step.
Encourage sign-up. Do not call any profile/boat/journey tools.`;
      stepInstructions = userInfo ? `**From signup/OAuth (if known):**\n${userInfo}\n` : '';
      extra = `You may use definition tools (get_experience_level_definitions, get_risk_level_definitions, get_skills_definitions) only to answer general questions.`;
      break;
    case 'create_profile':
      stateAndGoal = `## CURRENT STEP: Create profile
**State:** Profile not created yet. Boat: none. Journey: none.
**Goal:** Gather full_name, user_description, sailing_experience (and optionally risk_level, skills). Then call \`update_user_profile\` with **roles: ['owner']** (required).
**DATA SOURCE:** Extract ALL profile fields EXCLUSIVELY from [SKIPPER PROFILE]. The [CREW REQUIREMENTS] section describes what the skipper wants FROM crew — it must NEVER be used to populate the skipper's own profile fields (experience, skills, certifications, description).
When the user gives their full name, include [OWNER_NAME: Their Full Name] in your message.
**SAVING THE PROFILE:** Present the profile summary to the user and ask them to confirm (e.g. "Does this look correct? Shall I save your profile?"). **Only call \`update_user_profile\` after the user explicitly confirms** (says "yes", "looks good", "save", "go ahead", or similar). Never save without confirmation.
**NEVER say "profile saved", "profile created", or similar unless you have actually called update_user_profile in THIS exact response.**
**AFTER PROFILE IS SAVED:** Check conversation history for boat details (name, make/model, home port). If boat details are already available, present a brief boat summary and suggest adding the boat.`;
      stepInstructions = userInfo ? `**From signup/OAuth:**\n${userInfo}\n` : '';
      extra = `## LABELLED SECTIONS IN FIRST MESSAGE
The user's first message may contain clearly-labelled sections: [SKIPPER PROFILE], [CREW REQUIREMENTS], and [JOURNEY DETAILS].
- Use ONLY the [SKIPPER PROFILE] section to extract the skipper's name, description, experience, certifications, and risk level.
- Do NOT use [CREW REQUIREMENTS] or [JOURNEY DETAILS] content for the skipper profile.
- [JOURNEY DETAILS] contains structured route data; acknowledge it exists but save it for the journey step.

## SKILLS (optional)
**CRITICAL:** Only include skills that the **skipper/owner themselves** possesses. Do NOT include skills from [CREW REQUIREMENTS]. Skills optional.
Use ONLY exact skill names from config. Format in profile: [{"skill_name": "exact_name", "description": "..."}].
${getSkillsStructure()}
Then suggest adding a boat next.`;
      if (isProfileCompletionMode) {
        extra += `\n**Profile completion mode:** Extract info from conversation history. Present summary and ask for confirmation. Do NOT call update_user_profile until the user explicitly confirms.`;
      }
      break;
    case 'add_boat':
      stateAndGoal = `## CURRENT STEP: Add boat
**State:** Profile created. Boat: none. Journey: none.
**Goal:** Collect boat make/model and name from the user, fetch specs, present a summary, and save when confirmed.
**STEP 1 — COLLECT MAKE/MODEL FIRST:**
- Check the conversation history and [SKIPPER PROFILE] stored context for boat details (make/model, name, home port).
- If a specific make/model IS clearly present (e.g. "Baltic 35", "Bavaria 46"), call \`fetch_boat_details_from_sailboatdata\` with that exact string — do NOT announce intent, just call it.
- If make/model is NOT available or unclear, ask the user for it before fetching. Do NOT guess or invent a make/model.
**STEP 2 — PRESENT SUMMARY AND CONFIRM:** After fetching specs, show the boat summary and ask for confirmation before saving.
**STEP 3 — SAVE (CRITICAL):** When the user confirms (says "yes", "confirm", "looks good", "save", "create it", or similar):
  - You MUST call \`create_boat\` tool IMMEDIATELY in the same response
  - Do NOT just say "I will save" or "boat has been saved" — you must actually CALL THE TOOL
  - Include ALL available fields from fetch_boat_details_from_sailboatdata results
**AFTER BOAT IS SAVED:** Confirm success and suggest creating a journey next.`;
      stepInstructions = `**Required fields for create_boat:** name (boat's own name), type, make_model, capacity (number)
**IMPORTANT - Include ALL available data from fetch_boat_details_from_sailboatdata:**
- home_port, country_flag (if provided by user or in [SKIPPER PROFILE])
- loa_m, beam_m, max_draft_m, displcmt_m, average_speed_knots
- link_to_specs
- characteristics, capabilities, accommodations (CRITICAL — do NOT invent these if not returned by the tool; omit them instead)
- sa_displ_ratio, ballast_displ_ratio, displ_len_ratio, comfort_ratio, capsize_screening, hull_speed_knots, ppi_pounds_per_inch
**NEVER present made-up or placeholder specs.** If fetch_boat_details_from_sailboatdata returns no data, tell the user the specs could not be found and ask them to provide the details manually.`;
      extra = `**create_boat (CRITICAL — CALL THIS TOOL IMMEDIATELY WHEN USER CONFIRMS):** When the user confirms the boat summary with words like "yes", "confirm", "looks good", "save", or "create it":
1. You MUST call the create_boat tool in the same response — do NOT say you will save it, ACTUALLY CALL IT
2. Include ALL available fields from fetch_boat_details_from_sailboatdata:
   - Required: name, type, make_model, capacity
   - Optional but IMPORTANT: home_port, country_flag, loa_m, beam_m, max_draft_m, displcmt_m, average_speed_knots, link_to_specs, characteristics, capabilities, accommodations, sa_displ_ratio, ballast_displ_ratio, displ_len_ratio, comfort_ratio, capsize_screening, hull_speed_knots, ppi_pounds_per_inch

Example (replace with actual values from fetch_boat_details results):
\`\`\`tool_call
{"name": "create_boat", "arguments": {"name": "Boat Name", "type": "Coastal cruisers", "make_model": "Bavaria 46", "capacity": 6, "home_port": "Stockholm", "country_flag": "SE", "loa_m": 14.0, "beam_m": 4.2, "max_draft_m": 2.1, "displcmt_m": 12000, "average_speed_knots": 6.5, "link_to_specs": "https://sailboatdata.com/sailboat/bavaria-46", "characteristics": "Modern hull design with fin keel and spade rudder...", "capabilities": "Equipped for offshore passages with full electronics...", "accommodations": "Spacious saloon with 3 cabins and 2 heads..."}}
\`\`\`

**CRITICAL:** If you claim the boat was saved or created but did not call create_boat, the system will detect this and force you to call the tool. To avoid wasting iterations, CALL THE TOOL IMMEDIATELY WHEN USER CONFIRMS.

After create_boat succeeds, suggest creating a journey next.`;
      break;
    case 'post_journey':
      stateAndGoal = `## CURRENT STEP: Plan journey
**State:** Profile created. Boat: ${boatName ?? 'N/A'} (id: ${boatId ?? 'N/A'}). Journey: none.
**Goal:** Check conversation history for journey details, show summary, and CALL generate_journey_route immediately when user confirms. The journey will be created as a DRAFT—the user will need to verify it and publish it themselves.
**STEP 1 — CHECK FOR JOURNEY DATA FIRST:** Look in conversation history and [JOURNEY DETAILS] stored context for:
- Start and end locations (name, lat, lng)
- Dates (startDate, endDate in YYYY-MM-DD format)
- Waypoints (optional)
- Crew requirements from [CREW REQUIREMENTS]
**STEP 2 — SHOW SUMMARY:** Present the journey details back to the user for confirmation.
**STEP 3 — GENERATE (CRITICAL):** When user confirms (says "yes", "looks good", "save", "create", etc.):
- You MUST call \`generate_journey_route\` IMMEDIATELY in the same response
- Do NOT just say "journey saved" — you must actually CALL THE TOOL
- Include boatId: "${boatId ?? 'N/A'}", startLocation, endLocation, and all dates/waypoints/crew requirements
**CRITICAL:** If the user mentions dates anywhere (e.g., "01/05/2026 - 30/05/2026" or "May 1st to May 30th"), you MUST convert to ISO format (YYYY-MM-DD).`;
      stepInstructions = `To create a journey from a route (e.g. Jamaica to San Blas), you MUST call generate_journey_route with startLocation, endLocation, boatId, and optional waypoints/dates. Do NOT call create_journey for route-based journeys; create_journey is not available in this step.

generate_journey_route creates the journey and all legs as a DRAFT. After it succeeds, tell the user their journey plan is ready and they should review it in their journeys section. They will need to verify and publish it themselves before crew can see or join it. waypointDensity: "moderate" default.
**REQUIRED FIELDS ONLY:** The only required inputs are startLocation and endLocation. Do NOT ask for a journey name, journey description, or any other 
field—these are not parameters of generate_journey_route and are not needed.
**[JOURNEY DETAILS] SECTION (CRITICAL):** The user's first message may contain a [JOURNEY DETAILS] section with structured route data 
(start/end locations with lat/lng coordinates, dates, waypoints). This is the PRIMARY source for route information. Use the exact coordinates 
and dates from that section—do NOT ask again for information already present there.
**COORDINATES:** If the first message contains a [JOURNEY DETAILS] section with coordinates in parentheses 
(e.g. "Start location: Kingston, Jamaica (lat 18.0, lng -76.8)"), use those exact lat/lng values. 
Otherwise supply lat and lng from your knowledge of geography. Do NOT ask the user for latitude/longitude.
**DATES:** If the conversation contains any dates 
(e.g., "May 1-30", "01/05/2026 to 30/05/2026", "starting May 1st", or dates in the [JOURNEY DETAILS] section), you MUST:
1. Convert them to ISO format: YYYY-MM-DD (e.g., "2026-05-01")
2. Pass them as startDate and endDate parameters in your generate_journey_route call
3. Do NOT ask for dates again if they were already provided
**CREW REQUIREMENTS (CRITICAL):** The [CREW REQUIREMENTS] section in STORED CONTEXT contains what the skipper wants from crew. You MUST extract and include all relevant fields in generate_journey_route — do NOT ask the user again:
- skills: map mentioned crew skills to valid names: safety_and_mob, heavy_weather, night_sailing, watch_keeping, navigation, sailing_experience, certifications, physical_fitness, seasickness_management, first_aid, technical_skills, cooking, survival_skills
- min_experience_level: integer 1–4 (1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper)
- cost_model: one of "Shared contribution", "Owner covers all costs", "Crew pays a fee", "Delivery/paid crew", "Not defined"
- cost_info: free text about cost details
**IMPORTANT:** Always include skills and min_experience_level if [CREW REQUIREMENTS] mentions them, even if vaguely (e.g. "experienced sailors" → min_experience_level: 2 or 3; "navigation skills" → skills: ["navigation"]).
**Example with crew requirements:**
\`\`\`tool_call
{"name": "generate_journey_route", "arguments": {"startLocation": {...}, "endLocation": {...}, "boatId": "...", "startDate": "2026-05-01", "endDate": "2026-05-30", "waypointDensity": "moderate", "skills": ["navigation", "night_sailing", "heavy_weather"], "min_experience_level": 2, "cost_model": "Shared contribution"}}
\`\`\``;
      extra = `**generate_journey_route (CRITICAL — CALL THIS TOOL IMMEDIATELY WHEN USER CONFIRMS):** When the user confirms the journey summary with words like "yes", "confirm", "looks good", "save", or "create":
1. You MUST call generate_journey_route in the same response — do NOT say "journey saved" without calling the tool
2. Required fields:
   - startLocation: {name: "...", lat: number, lng: number}
   - endLocation: {name: "...", lat: number, lng: number}
   - boatId: "${boatId ?? ''}" (CRITICAL — required)
3. Optional but important fields:
   - startDate: "YYYY-MM-DD" (MUST convert dates to ISO format)
   - endDate: "YYYY-MM-DD" (MUST convert dates to ISO format)
   - intermediateWaypoints: [{name: "...", lat: ..., lng: ...}, ...]
   - waypointDensity: "moderate" (default) or "minimal"
   - skills: array of crew skills from [CREW REQUIREMENTS]
   - min_experience_level: 1-4 (from [CREW REQUIREMENTS])
   - cost_model: one of "Shared contribution", "Owner covers all costs", "Crew pays a fee", "Delivery/paid crew", "Not defined"
   - cost_info: free text about costs (if provided in [CREW REQUIREMENTS])

Example (replace with actual values from journey summary and [JOURNEY DETAILS]/[CREW REQUIREMENTS]):
\`\`\`tool_call
{"name": "generate_journey_route", "arguments": {"startLocation": {"name": "Colombo, Sri Lanka", "lat": 6.9271, "lng": 80.7789}, "endLocation": {"name": "Richards Bay, South Africa", "lat": -28.78, "lng": 32.08}, "boatId": "${boatId ?? ''}", "startDate": "2026-05-01", "endDate": "2026-05-30", "intermediateWaypoints": [{"name": "Malé, Maldives", "lat": 4.1755, "lng": 73.5093}], "waypointDensity": "moderate", "skills": ["navigation", "night_sailing"], "min_experience_level": 2}}
\`\`\`

**CRITICAL:** If you claim the journey was saved or created but did not call generate_journey_route, the system will detect this and force you to call the tool. To avoid wasting iterations, CALL THE TOOL IMMEDIATELY WHEN USER CONFIRMS.

**IMPORTANT - DRAFT JOURNEY:** After generate_journey_route succeeds, always tell the user:
1. Their journey has been created as a DRAFT
2. They need to review and verify it in their journeys section
3. They must PUBLISH the journey themselves before crew can see or join it
4. AI will NOT publish the journey automatically—this is a deliberate design choice to let the user review first
Do NOT suggest connecting with crew until they confirm the journey is published.`;
      break;
    case 'completed':
      stateAndGoal = `## CURRENT STEP: Completed
**State:** Profile, boat(s), and journey(s) exist. Onboarding complete.
**Goal:** Be helpful. No creation tools available. You can suggest they review journeys or invite crew.`;
      stepInstructions = '';
      extra = '';
      break;
  }

  // Build stored context block so AI always has the raw input text even if conversation history is long
  const storedContextParts: string[] = [];
  if (importedProfile?.content?.trim()) {
    const importedContent = `Source: ${importedProfile.source}\nURL: ${importedProfile.url}\n\n${importedProfile.content.trim()}`;
    storedContextParts.push(`[IMPORTED_PROFILE]:\n${importedContent}`);
  }
  if (skipperProfile?.trim()) storedContextParts.push(`[SKIPPER PROFILE]:\n${skipperProfile.trim()}`);
  if (crewRequirements?.trim()) storedContextParts.push(`[CREW REQUIREMENTS]:\n${crewRequirements.trim()}`);
  if (journeyDetails?.trim()) storedContextParts.push(`[JOURNEY DETAILS]:\n${journeyDetails.trim()}`);
  const storedContextBlock = storedContextParts.length > 0
    ? `\n## STORED CONTEXT (from initial search — always authoritative)\n\n` +
      `⚠️ DATA SOURCE RULES — apply strictly:\n` +
      `- [IMPORTED_PROFILE] → user-shared content from external platform (Facebook, etc.). Use for profile information and context only; do NOT use for crew requirements.\n` +
      `- [SKIPPER PROFILE] → use ONLY for the skipper's own details: name, bio, experience level, certifications, skills, boat info.\n` +
      `- [CREW REQUIREMENTS] → use ONLY when creating a journey to set crew skill/experience requirements. NEVER read crew requirements as the skipper's own skills or experience.\n` +
      `- [JOURNEY DETAILS] → use ONLY for the journey/route step (locations, dates, waypoints). Ignore for profile and boat steps.\n\n` +
      storedContextParts.join('\n\n') + '\n'
    : '';

  return `You are SailSmart's AI assistant for owner onboarding. CURRENT DATE: ${currentDate}
${storedContextBlock}
${stateAndGoal}
${stepInstructions}

## AVAILABLE TOOLS (only these):
${toolsBlock}
${TOOL_CALL_FORMAT}
${extra ? `\n${extra}` : ''}

## RULES
- Be concise. Preferably on one at a time. Confirm before creating (profile/boat/journey).
- **Use conversation history:** Before asking for any detail, check if the user already provided it earlier in the conversation 
(e.g. boat name, make/model, profile info). If they did, use that information and do not ask again—proceed to the next action 
(e.g. look up boat, show summary, or create).
- **ALWAYS propose the next onboarding step:** After completing the current step (profile created, boat created, or journey created) 
- Include ALLWAYS [SUGGESTIONS] either to confirm pending action or ask missing information (e.g. "Save your profile", "Save boat details", "Create your first journey").
Never end with only generic tips—always offer the concrete action to peform.
- At the end of every response, add [SUGGESTIONS] with 1 item: that is either confirm pending action (e.g. "Save your profile", "Save boat details", "Create your first journey"); 
or proposed value for a missing field (e.g. "Confirm 1. Beginner experience level"). [/SUGGESTIONS]
- Do not show tool_call JSON to the user; describe in plain language.
- **CRITICAL - NEVER claim success without calling the tool:** If you need to create/update something (profile, boat, journey), you MUST call the appropriate tool (update_user_profile, create_boat, generate_journey_route). Do NOT say "saved successfully" or "created successfully" without actually calling the tool. If you claim success without calling the tool, the system will force you to call it anyway, wasting iterations.`;
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

      // Crew search tool
      if (toolCall.name === 'search_matching_crew') {
        try {
          const { searchMatchingCrew } = await import('@/app/lib/crew/matching-service');
          
          // Build search parameters
          const params: any = {
            experienceLevel: args.experienceLevel as number | undefined,
            riskLevels: args.riskLevels as string[] | undefined,
            skills: args.skills as string[] | undefined,
            limit: args.limit as number | undefined,
            includePrivateInfo: !!authenticatedUserId,
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
          
          results.push({
            name: toolCall.name,
            result: {
              success: true,
              matches: result.matches,
              totalCount: result.totalCount,
              isAuthenticated: !!authenticatedUserId,
              note: authenticatedUserId 
                ? 'Full crew profiles shown (authenticated user)'
                : 'Anonymized profiles shown (sign up to see full details)',
            },
          });
        } catch (error) {
          log('Error searching for crew:', error);
          results.push({
            name: toolCall.name,
            result: { success: false, matches: [], totalCount: 0 },
            error: error instanceof Error ? error.message : 'Failed to search crew',
          });
        }
        continue;
      }

      // Boat tools
      if (toolCall.name === 'fetch_boat_details_from_sailboatdata') {
        // Normalize: accept separate make/model args and combine into make_model
        const make_model = (args.make_model as string) ||
          ((args.make && args.model) ? `${args.make} ${args.model}`.trim() : undefined) ||
          (args.make as string | undefined) ||
          (args.model as string | undefined);
        const slug = args.slug as string | undefined;

        if (!make_model) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'make_model is required (e.g. "Bavaria 46" or "Vindö 40")',
          });
          continue;
        }

        try {
          // Call fetchSailboatDetails directly (avoids HTTP self-call which fails in serverless)
          const { fetchSailboatDetails } = await import('@/app/lib/sailboatdata_queries');
          const details = await fetchSailboatDetails(make_model.trim(), slug?.trim());

          // Check if we need AI fallback for missing text fields (capabilities, accommodations)
          const needsAIFallback = !details || 
            !details.capabilities || details.capabilities.trim() === '' ||
            !details.accommodations || details.accommodations.trim() === '';

          if (details && !needsAIFallback) {
            // Screenscraping succeeded and has all fields
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

          // Screenscraping returned null OR missing capabilities/accommodations - use AI fallback
          // If screenscraping succeeded but missing text fields, merge AI results with screenscraping data
          const { callAI } = await import('@shared/ai');
          const { parseJsonObjectFromAIResponse } = await import('@shared/ai');
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
          
          // Merge screenscraping data (if available) with AI results
          // Prioritize screenscraping for numeric/spec data, but use AI for text descriptions
          const mergedResult = {
            type: details?.type || boatDetails.type || null,
            capacity: details?.capacity ?? boatDetails.capacity ?? null,
            loa_m: details?.loa_m ?? boatDetails.loa_m ?? null,
            beam_m: details?.beam_m ?? boatDetails.beam_m ?? null,
            max_draft_m: details?.max_draft_m ?? boatDetails.max_draft_m ?? null,
            displcmt_m: details?.displcmt_m ?? boatDetails.displcmt_m ?? null,
            average_speed_knots: details?.average_speed_knots ?? boatDetails.average_speed_knots ?? null,
            // Use screenscraping characteristics if available and non-empty, otherwise AI
            characteristics: (details?.characteristics && details.characteristics.trim() !== '') 
              ? details.characteristics 
              : (boatDetails.characteristics || ''),
            // Always use AI for capabilities and accommodations (screenscraping doesn't extract these)
            capabilities: boatDetails.capabilities || '',
            accommodations: boatDetails.accommodations || '',
            link_to_specs: details?.link_to_specs || boatDetails.link_to_specs || '',
            sa_displ_ratio: details?.sa_displ_ratio ?? boatDetails.sa_displ_ratio ?? null,
            ballast_displ_ratio: details?.ballast_displ_ratio ?? boatDetails.ballast_displ_ratio ?? null,
            displ_len_ratio: details?.displ_len_ratio ?? boatDetails.displ_len_ratio ?? null,
            comfort_ratio: details?.comfort_ratio ?? boatDetails.comfort_ratio ?? null,
            capsize_screening: details?.capsize_screening ?? boatDetails.capsize_screening ?? null,
            hull_speed_knots: details?.hull_speed_knots ?? boatDetails.hull_speed_knots ?? null,
            ppi_pounds_per_inch: details?.ppi_pounds_per_inch ?? boatDetails.ppi_pounds_per_inch ?? null,
          };
          
          // Save merged result to registry so it's not re-fetched next time
          try {
            const { saveBoatRegistry } = await import('@/app/lib/boat-registry/service');
            // Extract slug from link_to_specs URL if available (e.g. "https://sailboatdata.com/sailboat/garcia-exploration-60")
            const slugFromLink = mergedResult.link_to_specs
              ? mergedResult.link_to_specs.match(/\/sailboat\/([^\/\?#]+)/)?.[1]
              : undefined;
            await saveBoatRegistry(make_model.trim(), mergedResult as any, slugFromLink);
            log(`✅ Saved AI-fallback boat details to registry: ${make_model}`);
          } catch (registryErr) {
            logger.error(`⚠️ Failed to save AI-fallback result to registry: ${registryErr instanceof Error ? registryErr.message : 'Unknown error'}`);
          }

          results.push({
            name: toolCall.name,
            result: mergedResult,
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

        // Normalize boat type to match enum values
        const normalizeBoatType = (type: string): string => {
          const normalized = type.toLowerCase().trim();
          if (normalized === 'multihull' || normalized === 'catamaran' || normalized === 'trimaran') {
            return 'Multihulls';
          }
          if (normalized.includes('daysail')) return 'Daysailers';
          if (normalized.includes('coastal')) return 'Coastal cruisers';
          if (normalized.includes('offshore') || normalized.includes('traditional')) return 'Traditional offshore cruisers';
          if (normalized.includes('performance')) return 'Performance cruisers';
          if (normalized.includes('expedition')) return 'Expedition sailboats';
          return type; // Return as-is if no match, let DB validation catch it
        };

        const boatData: Record<string, unknown> = {
          owner_id: authenticatedUserId,
          name: args.name as string,
          type: normalizeBoatType(args.type as string),
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
          // Update existing boat with any missing details from the new call
          const updateData: Record<string, unknown> = {};
          let hasUpdates = false;

          // Only update fields that are provided and not null/undefined
          const fieldsToUpdate = [
            'type', 'make_model', 'capacity', 'home_port', 'country_flag',
            'loa_m', 'beam_m', 'max_draft_m', 'displcmt_m', 'average_speed_knots',
            'link_to_specs', 'characteristics', 'capabilities', 'accommodations',
            'sa_displ_ratio', 'ballast_displ_ratio', 'displ_len_ratio',
            'comfort_ratio', 'capsize_screening', 'hull_speed_knots', 'ppi_pounds_per_inch'
          ];

          for (const field of fieldsToUpdate) {
            const newValue = boatData[field];
            if (newValue !== undefined && newValue !== null && newValue !== '') {
              updateData[field] = newValue;
              hasUpdates = true;
            }
          }

          if (hasUpdates) {
            // Update the existing boat with new details
            const { data: updatedBoat, error: updateError } = await supabase
              .from('boats')
              .update(updateData)
              .eq('id', duplicateByName.id)
              .eq('owner_id', authenticatedUserId)
              .select('id, name')
              .single();

            if (updateError) {
              log(`⚠️ Failed to update existing boat: ${updateError.message}`);
              // Still treat as success so user can proceed
            } else {
              log(`✅ Updated existing boat "${updatedBoat.name}" with additional details`);
            }
          }

          // Treat "boat already exists" as step success so user can advance to journey
          results.push({
            name: toolCall.name,
            result: {
              boatAlreadyExists: true,
              boatName: duplicateByName.name,
              boatId: duplicateByName.id,
              updated: hasUpdates,
              message: hasUpdates 
                ? `Boat "${duplicateByName.name}" already exists. Updated with additional details. You can proceed to create your journey.`
                : `This boat is already in your fleet. You can proceed to create your journey.`,
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
            // Update existing boat with any missing details from the new call
            const updateData: Record<string, unknown> = {};
            let hasUpdates = false;

            // Only update fields that are provided and not null/undefined
            const fieldsToUpdate = [
              'name', 'type', 'capacity', 'home_port', 'country_flag',
              'loa_m', 'beam_m', 'max_draft_m', 'displcmt_m', 'average_speed_knots',
              'link_to_specs', 'characteristics', 'capabilities', 'accommodations',
              'sa_displ_ratio', 'ballast_displ_ratio', 'displ_len_ratio',
              'comfort_ratio', 'capsize_screening', 'hull_speed_knots', 'ppi_pounds_per_inch'
            ];

            for (const field of fieldsToUpdate) {
              const newValue = boatData[field];
              if (newValue !== undefined && newValue !== null && newValue !== '') {
                updateData[field] = newValue;
                hasUpdates = true;
              }
            }

            if (hasUpdates) {
              // Update the existing boat with new details
              const { data: updatedBoat, error: updateError } = await supabase
                .from('boats')
                .update(updateData)
                .eq('id', duplicateByMakeModel.id)
                .eq('owner_id', authenticatedUserId)
                .select('id, name')
                .single();

              if (updateError) {
                log(`⚠️ Failed to update existing boat: ${updateError.message}`);
                // Still treat as success so user can proceed
              } else {
                log(`✅ Updated existing boat "${updatedBoat.name}" with additional details`);
              }
            }

            // Treat "boat already exists" as step success so user can advance
            results.push({
              name: toolCall.name,
              result: {
                boatAlreadyExists: true,
                boatName: duplicateByMakeModel.name,
                boatId: duplicateByMakeModel.id,
                updated: hasUpdates,
                message: hasUpdates
                  ? `Boat "${duplicateByMakeModel.name}" already exists. Updated with additional details. You can proceed to create your journey.`
                  : `This boat is already in your fleet. You can proceed to create your journey.`,
              },
            });
            continue;
          }
        }

        log(`📝 Creating boat with data:`, JSON.stringify(boatData, null, 2));
        
        const { data, error } = await supabase
          .from('boats')
          .insert(boatData)
          .select('id, name, loa_m, beam_m, max_draft_m, displcmt_m, average_speed_knots, home_port, country_flag, link_to_specs')
          .single();

        if (error) {
          log(`❌ Failed to create boat: ${error.message}`);
          results.push({
            name: toolCall.name,
            result: null,
            error: `Failed to create boat: ${error.message}`,
          });
          continue;
        }

        log(`✅ Boat created successfully:`, JSON.stringify(data, null, 2));
        
        // Update boat_registry with AI-generated fields
        if (boatData.make_model) {
          try {
            const { saveBoatRegistry } = await import('@/app/lib/boat-registry/service');
            
            // Prepare boat data for registry (including AI-generated fields)
            const registryBoatData: any = {
              type: boatData.type,
              capacity: boatData.capacity,
              loa_m: boatData.loa_m,
              beam_m: boatData.beam_m,
              max_draft_m: boatData.max_draft_m,
              displcmt_m: boatData.displcmt_m,
              average_speed_knots: boatData.average_speed_knots,
              link_to_specs: boatData.link_to_specs,
              characteristics: boatData.characteristics,
              capabilities: boatData.capabilities,
              accommodations: boatData.accommodations,
              sa_displ_ratio: boatData.sa_displ_ratio,
              ballast_displ_ratio: boatData.ballast_displ_ratio,
              displ_len_ratio: boatData.displ_len_ratio,
              comfort_ratio: boatData.comfort_ratio,
              capsize_screening: boatData.capsize_screening,
              hull_speed_knots: boatData.hull_speed_knots,
              ppi_pounds_per_inch: boatData.ppi_pounds_per_inch,
              make_model: boatData.make_model,
            };
            
            // Extract slug from link_to_specs if available
            const slugFromSpecs = boatData.link_to_specs
              ? (boatData.link_to_specs as string).match(/\/sailboat\/([^\/\?#]+)/)?.[1]
              : undefined;
            await saveBoatRegistry(
              boatData.make_model as string,
              registryBoatData,
              slugFromSpecs
            );
            
            log(`✅ Boat registry updated for make_model: ${boatData.make_model}`);
          } catch (registryError) {
            logger.error(`⚠️ Failed to update boat registry: ${registryError instanceof Error ? registryError.message : 'Unknown error'}`);
          }
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
            
            // Ensure speed is at least 5 knots, this is safe assumption for most boats
            if(speed && speed < 5) {
              speed = 5;
            }
          }

          // Call shared function directly (avoids HTTP self-call which fails in serverless)
          // Use speed planning if speed is available (defaults to true)
          const { generateJourneyRoute } = await import('@shared/ai');
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
  const skipperProfile = request.skipperProfile ?? null;
  const crewRequirements = request.crewRequirements ?? null;
  const journeyDetails = request.journeyDetails ?? null;
  const importedProfile = request.importedProfile ?? null;

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
  let allowedToolNames = new Set(TOOLS_BY_STEP[currentStep]);
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
      skipperProfile,
      crewRequirements,
      journeyDetails,
      importedProfile,
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
    skipperProfile,
    crewRequirements,
    journeyDetails,
    importedProfile,
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
  let allToolResults: Array<{ name: string; result: unknown; error?: string }> = [];
  let intermediateMessages: OwnerMessage[] = [];
  let currentMessages = [...messages];
  let iterations = 0;
  let finalContent = '';
  let profileCreated = false;
  let boatCreated = false;
  let journeyCreated = false;
  let addBoatNudgeCount = 0;
  let addProfileNudgeCount = 0;
  let addJourneyNudgeCount = 0;

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

    const parsed = parseToolCalls(result.text);
    const { content } = parsed;
    let toolCalls = parsed.toolCalls;

    log('🔧 PARSED TOOL CALLS:', toolCalls.length);

    if (toolCalls.length === 0) {
      // Add boat step: if user confirmed and AI either showed a boat summary or claimed boat was created (without calling create_boat), nudge once
      const lastUserMessage = request.message.trim().toLowerCase();
      const looksLikeConfirmation = /^(yes|yeah|yep|ok|okay|confirm|looks good|sounds good|correct|go ahead|create it|do it|save|save it|save boat|please call create_boat|please create the boat)$/.test(lastUserMessage) || lastUserMessage.length < 60 && (/\b(yes|ok|confirm|good|correct|go ahead|save)\b/.test(lastUserMessage)) || (lastUserMessage.length < 100 && /\bconfirm\b.*\bsave\b.*\bboat\b/i.test(lastUserMessage)) || (lastUserMessage.length < 100 && /\bconfirm\b.*\bboat\b/i.test(lastUserMessage)) || (lastUserMessage.length < 100 && /\bsave\b.*\bboat\b/i.test(lastUserMessage));
      const looksLikeBoatSummary = (/\b(name|type|capacity|make|model):\s*\S+/i.test(result.text) || /boat.*summary|here('s| is) (your|the) boat/i.test(result.text)) && !/create_boat|tool_call/.test(result.text);
      const looksLikeBoatCreatedWithoutTool = /(?:created successfully|saved successfully|boat profile.*created|your boat.*has been created|boat has been created|already been saved|have been saved|has been saved)/i.test(result.text) && !/create_boat|tool_call/.test(result.text);
      if (!boatCreated && currentStep === 'add_boat' && looksLikeConfirmation && (looksLikeBoatSummary || looksLikeBoatCreatedWithoutTool)) {
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
          { role: 'user', content: 'The user confirmed. You MUST call the create_boat tool in this response. Include ALL available fields from fetch_boat_details_from_sailboatdata results, especially characteristics, capabilities, and accommodations. Use this structure: ```tool_call\n{"name": "create_boat", "arguments": {"name": "...", "type": "...", "make_model": "...", "capacity": ..., "home_port": "...", "loa_m": ..., "beam_m": ..., "characteristics": "...", "capabilities": "...", "accommodations": "..."}}\n``` Replace the ... with actual values from your summary and fetch_boat_details results. Include all fields that were returned by fetch_boat_details_from_sailboatdata. No other tool is allowed in this step.' }
        );
        continue;
      }

      // Create profile step: if user confirmed but AI claimed profile was saved without calling update_user_profile, nudge once
      const looksLikeProfileSummary = /\b(full.?name|user.?description|sailing.?experience|experience.?level|profile.?summary)\b/i.test(result.text) && !/update_user_profile|tool_call/.test(result.text);
      const looksLikeProfileSavedWithoutTool = /(?:profile.*(?:saved|created|stored|updated).*successfully|already been saved|has been saved|have been saved|saved successfully)/i.test(result.text) && !/update_user_profile|tool_call/.test(result.text);
      if (!profileCreated && currentStep === 'create_profile' && looksLikeConfirmation && (looksLikeProfileSummary || looksLikeProfileSavedWithoutTool)) {
        if (addProfileNudgeCount >= 2) {
          log('⚠️ Create profile: nudge cap reached - profile may already exist');
          currentMessages.push(
            { role: 'assistant', content: result.text },
            { role: 'user', content: 'The profile may already exist. Respond briefly that the user can proceed to add their boat and suggest "Add your boat" as the next step. Do not call any tools.' }
          );
          continue;
        }
        log('⚠️ Create profile: user confirmed but no update_user_profile call - nudging AI');
        addProfileNudgeCount += 1;
        currentMessages.push(
          { role: 'assistant', content: result.text },
          { role: 'user', content: 'The user confirmed. You MUST call the update_user_profile tool NOW to save the profile. Use this structure: ```tool_call\n{"name": "update_user_profile", "arguments": {"full_name": "...", "user_description": "...", "sailing_experience": ..., "risk_level": [...], "skills": [...], "roles": ["owner"]}}\n``` Fill in the actual values from your summary. The roles field MUST include ["owner"]. Do not call any other tool.' }
        );
        continue;
      }

      // add_boat step: detect when AI announces intent to fetch boat details but doesn't call the tool
      if (!boatCreated && currentStep === 'add_boat') {
        const looksLikeFetchBoatIntent =
          /\b(?:i will|i'll|i am going to|let me|now|please hold on)\b.{0,60}\b(?:fetch|get|gather|look.?up|find|search)\b.{0,60}\b(?:boat|vessel|specifications?|specs|details)\b/i.test(result.text) ||
          /\b(?:fetching|gathering|looking up)\b.{0,60}\b(?:boat|vessel|specifications?|specs|details|sailboatdata)\b/i.test(result.text) ||
          /please hold on.{0,60}\b(?:gather|fetch|collect|find|get)\b/i.test(result.text);
        if (looksLikeFetchBoatIntent && !/tool_call|fetch_boat_details_from_sailboatdata|create_boat/.test(result.text)) {
          log('⚠️ Add boat: AI announced fetch intent without calling tool - forcing fetch_boat_details_from_sailboatdata');
          currentMessages.push(
            { role: 'assistant', content: result.text },
            { role: 'user', content: 'You mentioned fetching boat details but did not call the tool. If a specific make/model is present in the conversation or [SKIPPER PROFILE], call fetch_boat_details_from_sailboatdata now with that exact make/model. If no make/model is available, ask the user for it instead.' }
          );
          continue;
        }
      }

      // post_journey step: if user confirmed but AI claimed journey was saved without calling generate_journey_route, nudge once
      const looksLikeJourneySummary = (/\b(start|end|location|date|waypoint|summary)\b/i.test(result.text)) && !/generate_journey_route|tool_call/.test(result.text);
      const looksLikeJourneySavedWithoutTool = /(?:journey.*(?:saved|created|generated).*successfully|has been.*created|have been created|successfully saved|your journey|trip.*created)/i.test(result.text) && !/generate_journey_route|tool_call/.test(result.text);
      if (!journeyCreated && currentStep === 'post_journey' && looksLikeConfirmation && (looksLikeJourneySummary || looksLikeJourneySavedWithoutTool)) {
        if (addJourneyNudgeCount >= 2) {
          log('⚠️ Post journey: nudge cap reached - journey may already exist');
          currentMessages.push(
            { role: 'assistant', content: result.text },
            { role: 'user', content: 'The journey may already have been created. Respond briefly that the onboarding is complete and suggest "Explore connecting with crew members" as the next step. Do not call any tools.' }
          );
          continue;
        }
        log('⚠️ Post journey: user confirmed but no generate_journey_route call - nudging AI');
        addJourneyNudgeCount += 1;
        currentMessages.push(
          { role: 'assistant', content: result.text },
          { role: 'user', content: `The user confirmed. You MUST call the generate_journey_route tool in this response. Use this structure: \`\`\`tool_call\n{"name": "generate_journey_route", "arguments": {"startLocation": {"name": "...", "lat": ..., "lng": ...}, "endLocation": {"name": "...", "lat": ..., "lng": ...}, "boatId": "${boatId || 'BOAT_ID'}", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "waypointDensity": "moderate"}}\n\`\`\` Fill in all actual values from the journey summary. Include crew skills and experience level from [CREW REQUIREMENTS] if available. Do not call any other tool.` }
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
          log('⚠️ AI hallucinated tool call success - silently correcting without user-facing note');
          // Don't add technical note to user - just let AI continue
          // The AI will naturally correct course in the next iteration
        }
      }
      
      log('✅ No tool calls, final content ready');
      break;
    }

    allToolCalls.push(...toolCalls);

    // Capture intermediate message (AI response with tool calls)
    const intermediateMsg: OwnerMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: content, // Content without tool calls
      timestamp: new Date().toISOString(),
      metadata: {
        toolCalls: toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments as Record<string, unknown>,
        })),
        isIntermediate: true,
      },
    };
    intermediateMessages.push(intermediateMsg);

    // Prevent duplicate create_boat calls: if boat was already created successfully in this request, stop the AI from calling it again
    const previousBoatResults = allToolResults.filter(r => r.name === 'create_boat' && !r.error);
    const boatAlreadyCreatedInThisRequest = previousBoatResults.length > 0 && 
      previousBoatResults.some(r => {
        const result = r.result as { success?: boolean; boatAlreadyExists?: boolean };
        return result?.success === true || result?.boatAlreadyExists === true;
      });
    
    if (boatAlreadyCreatedInThisRequest && toolCalls.some(tc => tc.name === 'create_boat')) {
      log('⚠️ Boat already created in this request - preventing duplicate create_boat call');
      log(`   Previous boat results: ${JSON.stringify(previousBoatResults.map(r => ({ name: r.name, success: (r.result as any)?.success, boatAlreadyExists: (r.result as any)?.boatAlreadyExists })))}`);
      // Remove create_boat calls from this iteration
      toolCalls = toolCalls.filter(tc => tc.name !== 'create_boat');
      if (toolCalls.length === 0) {
        // Add a message to inform AI that boat was already created
        const previousResult = previousBoatResults[0]?.result as { boatName?: string; boatId?: string };
        const boatName = previousResult?.boatName || 'the boat';
        const toolResultsText = formatToolResultsForAI(previousBoatResults);
        currentMessages.push(
          { role: 'assistant', content: result.text },
          { role: 'user', content: `Tool results from previous step:\n${toolResultsText}\n\nThe boat "${boatName}" was already created successfully. Do not call create_boat again. Instead, acknowledge that the boat is ready and suggest the next step: creating a journey.` }
        );
        continue; // Continue loop to get AI response without tool call
      }
    }
    
    const toolResults = await executeOwnerTools(supabase, toolCalls, authenticatedUserId, allowedToolNames, fullPromptText);
    allToolResults.push(...toolResults);

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
      // Unlock boat tools so AI can auto-chain to boat creation in the same request
      allowedToolNames.add('fetch_boat_details_from_sailboatdata');
      allowedToolNames.add('create_boat');
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
    let contextMessage: string;
    if (profileResult && !boatCreated) {
      contextMessage = `Tool results:\n${toolResultsText}\n\nProfile saved! Check the conversation history and [SKIPPER PROFILE] for boat details (make/model, name, home port). If a specific make/model is present (e.g. "Baltic 35", "Bavaria 46"), call fetch_boat_details_from_sailboatdata with that make/model. If no make/model is found, congratulate the user on saving their profile and ask for their boat's make/model to continue.`;
    } else if (boatResult && !journeyCreated) {
      contextMessage = `Tool results:\n${toolResultsText}\n\nBoat saved! Confirm the boat was added successfully and let the user know the next step is creating their first journey. Do NOT attempt to call generate_journey_route — journey creation is handled in the next step after this response.`;
    } else {
      contextMessage = `Tool results:\n${toolResultsText}\n\nNow provide a helpful response to the user.`;
    }

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
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
    },
  };

  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║           OWNER CHAT - COMPLETE                              ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log('📤 FINAL RESPONSE:', `${finalContent.length} chars`);
  log('📊 Tool calls:', allToolCalls.length);
  log('📬 Intermediate messages:', intermediateMessages.length);
  log('✅ Created:', { profile: profileCreated, boat: boatCreated, journey: journeyCreated });

  return {
    sessionId,
    message: responseMessage,
    intermediateMessages: intermediateMessages.length > 0 ? intermediateMessages : undefined,
    extractedPreferences: undefined,
    profileCreated,
    boatCreated,
    journeyCreated,
  };
}
