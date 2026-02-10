/**
 * Prospect AI Chat Service
 *
 * Simplified AI service for unauthenticated prospect users.
 * - No database writes (conversation stored in localStorage on client)
 * - Focused on discovering sailing preferences
 * - Returns matching legs based on gathered preferences
 *
 * Uses shared AI utilities from @/app/lib/ai/shared for tool parsing,
 * bounding box handling, and leg search.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { callAI } from '../service';
import {
  parseToolCalls,
  normalizeDateArgs,
  normalizeLocationArgs,
  normalizeBboxArgs,
  formatToolResultsForAI,
  searchPublishedLegs,
  searchLegsByBbox,
  ToolCall,
  LegSearchOptions,
  // Tool registry
  getToolsForProspect,
  getToolsForProspectProfileCompletion,
  toolsToPromptFormat,
} from '../shared';
import {
  ProspectMessage,
  ProspectChatRequest,
  ProspectChatResponse,
  ProspectPreferences,
  ProspectLegReference,
} from './types';
import { searchLocation, LocationSearchResult } from '@/app/lib/geocoding/locations';
import skillsConfig from '@/app/config/skills-config.json';

const MAX_HISTORY_MESSAGES = 15;
const MAX_LEG_REFERENCES = 8;
const MAX_TOOL_ITERATIONS = 5;

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Prospect Chat Service] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Extract location mentions from a message using exact (case-insensitive) matching
 * against the predefined LocationRegion names and aliases.
 *
 * Only returns matches where the user's message contains an exact region name or alias.
 * Any locations not in the registry are left for the AI/LLM to geocode.
 */
function extractMatchedLocations(message: string): LocationSearchResult[] {
  return searchLocation(message);
}


/**
 * Build system prompt for prospect onboarding chat
 * @param preferences - User's gathered preferences
 * @param matchedLocations - Pre-resolved locations from the location registry
 */
function buildProspectSystemPrompt(
  preferences: ProspectPreferences,
  matchedLocations?: LocationSearchResult[]
): string {
  const hasPreferences = Object.keys(preferences).some(
    key => preferences[key as keyof ProspectPreferences] !== undefined
  );

  // Get current date for context
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentYear = now.getFullYear();

  return `You are SailSmart's friendly AI assistant helping potential crew members in onboarding process.

CURRENT DATE: ${currentDate}
IMPORTANT: Today's date is ${currentDate}. When users ask about sailing trips, use ${currentYear} or later for date searches. Do NOT use past years like 2024 or 2025 - always search for upcoming trips.

## PRIMARY GOAL: FAST AND EFFICIENT SIGN-UP and PROFILE CREATION (CRITICAL)
- Your end goal is onboarding the user to the platform, by suggesting sign-up and gathering minimal needed information to create a user profile
- Gather understanding of user's profile information and restrictions through natural conversation by asking questions and listening to user's answers
- MAIN GOAL is to get minimal information for profile, guide user to sign-up and create profile as soon as possibl, DO NOT ITERATE OVER THE SAME QUESTIONS
- IMPORTANT: Minimal information for profile is: [full_name, user_description, sailing_experience, sailing_preferences, risk_level], all other are optional and can be update later by user
- Never assume they have a profile until they have completed signup and saved their profile in this chat

## SKILLS HANDLING (CRITICAL):
When users mention skills, you MUST use ONLY the exact skill names from the skills config:
${getSkillsStructure()}

**SKILLS RULES:**
- You MUST use ONLY the exact skill names listed above
- Do NOT create custom skills like "carpentry", "mechanics", "yoga", "languages", etc.
- If user mentions skills not in the config, map them to the closest matching skill from the config:
  - "carpentry", "mechanics", "electrical" → "technical_skills"
  - "yoga", "fitness" → "physical_fitness"
  - "cooking", "chef" → "cooking"
  - Any sailing-related skill → map to the closest sailing skill from config
- When storing skills in profile, use format: [{"skill_name": "exact_name_from_config", "description": "user's description"}]
- The "skill_name" field MUST match exactly one of the skill names from the config above

## SECONDARY GOAL: SHOW VALUE OF THE PLATFORM AND CONVINCE USER TO SIGN UP (IMPORTANT)
- Help users to find the best sailing opportunities that match their interests and show the matching results to user early

## CONVERSATION STYLE:
- Be warm, enthusiastic, and conversational
- Ask one or two questions at a time, not long lists
- Show matching sailing legs as soon as you have enough information
- Keep responses concise and focused

## SUGGESTED PROMPTS (CRITICAL):
- At the end of your response, include 2-3 suggested follow-up questions or prompts the user could ask to continue the conversation. This helps guide them through the onboarding process.
- IMPORTANT: Allways suggest sign-up if user is not signed up and Save profile if profile does not exist yet

Format suggestions like this at the very end of your message:
[SUGGESTIONS]
- "What sailing skills should I have?"
- "Show me trips in the Mediterranean"
[/SUGGESTIONS]

Make suggestions contextual based on:
- What information is still missing (if early in conversation)
- What they've already shared (suggest exploring related options)
- Their experience level (beginners: learning opportunities, experienced: advanced trips)
- Their interests (if they mentioned a region, suggest exploring it more)
- Next logical step in the onboarding flow as suggestions

Examples:
- Early conversation: "Tell me about your sailing experience", "What regions interest you?", "When are you available?"
- After sharing preferences: "Show me trips matching my preferences", "What skills would help me join these trips?", "Tell me more about [specific leg]"
- After showing legs: "Show me more options", "What about [different region/dates]", "What skills do I need for these trips?"

${hasPreferences ? `
GATHERED PREFERENCES SO FAR:
${preferences.sailingGoals ? `- Sailing goals: ${preferences.sailingGoals}` : ''}
${preferences.experienceLevel ? `- Experience level: ${preferences.experienceLevel}/4` : ''}
${preferences.preferredDates?.start ? `- Available: ${preferences.preferredDates.start} to ${preferences.preferredDates.end}` : ''}
${preferences.preferredLocations?.length ? `- Preferred locations: ${preferences.preferredLocations.join(', ')}` : ''}
${preferences.skills?.length ? `- Skills: ${preferences.skills.join(', ')}` : ''}
${preferences.riskLevels?.length ? `- Comfort level: ${preferences.riskLevels.join(', ')}` : ''}
` : ''}

RESPONSE FORMAT:
When showing sailing opportunities, use this format for leg references:
[[leg:LEG_UUID:Leg Name]]

Example: "I found some great options for you! Check out [[leg:abc-123:Mediterranean Crossing]] - a 10-day adventure from Spain to Greece."

IMPORTANT:
- Always format leg references exactly as [[leg:UUID:Name]] so they appear as clickable badges
- After showing interesting legs, suggest creating a profile if they haven't (e.g. "To save your search and create your crew profile so you can register for legs, sign up above!").
- Keep the conversation flowing naturally - don't overwhelm with too many legs at once
- If the user shares details about themselves, acknowledge and use that information
- **When the user tells you their full name** (e.g. "I'm John Smith", "My name is Maria", "Call me Alex"), include exactly this tag in your reply so we can prefill the signup form: [PROSPECT_NAME: Their Full Name]. Use the name they gave; put the tag at the end of your message. Example: "Nice to meet you! [PROSPECT_NAME: John Smith]"

## CRITICAL: NO HALLUCINATION RULE

**YOU MUST ONLY REFERENCE LEGS THAT WERE RETURNED FROM TOOL CALLS.**

- NEVER invent, fabricate, or imagine sailing legs or journeys
- NEVER create fictional leg names, UUIDs, dates, durations, or any other details
- NEVER describe specific legs (with names, durations, descriptions) that weren't in the tool results
- ONLY use the exact leg information (ID, name, dates, locations) provided in tool results
- The [[leg:UUID:Name]] format MUST use the exact UUID and name from the tool results

**WHEN TOOL RETURNS 0 RESULTS OR AN ERROR:**
- Say honestly: "I couldn't find any sailing legs matching your criteria in that area."
- Do NOT list fictional alternatives like "Mediterranean Breeze - 7 Days" or similar made-up legs
- Do NOT describe what legs "might" exist or "would be available"
- Instead, suggest: trying different dates, expanding the search area, or checking back later
- You can describe the REGION (e.g., "The French Riviera is beautiful for sailing") but NOT specific legs

**EXAMPLE OF WHAT NOT TO DO (BAD):**
"Here are some legs: Mediterranean Breeze - 7 Days, Coastal Explorer - 10 Days..."
(These are made up and don't exist!)

**EXAMPLE OF CORRECT RESPONSE WHEN NO RESULTS:**
"I searched the French Riviera area but couldn't find any available sailing legs matching your dates. This could mean trips haven't been posted yet for that period. Would you like me to try different dates, or search a broader Mediterranean area?"

**VIOLATION OF THIS RULE CREATES A TERRIBLE USER EXPERIENCE - USERS CANNOT REGISTER FOR LEGS THAT DON'T EXIST.**

${matchedLocations && matchedLocations.length > 0 ? `
## PRE-RESOLVED LOCATIONS - COPY THESE TOOL CALLS EXACTLY

The following locations were detected and pre-resolved. **COPY THE TOOL CALL EXACTLY AS SHOWN - do not retype the coordinates manually to avoid typos.**

${matchedLocations.map(match => `**${match.region.name}** (matched on: "${match.matchedTerm}")

READY-TO-USE TOOL CALL (copy this exactly, just add your date filters):
\`\`\`tool_call
{"name": "search_legs_by_location", "arguments": {"departureBbox": {"minLng": ${match.region.bbox.minLng}, "minLat": ${match.region.bbox.minLat}, "maxLng": ${match.region.bbox.maxLng}, "maxLat": ${match.region.bbox.maxLat}}, "departureDescription": "${match.region.name}", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}}
\`\`\`
`).join('\n')}
**CRITICAL: Copy the departureBbox object exactly as shown above. Do NOT retype the numbers manually - this causes typos like missing maxLat.**
` : ''}
## LOCATION-BASED SEARCH (CRITICAL)

When users mention locations, you MUST resolve them to geographic bounding boxes and use the \`search_legs_by_location\` tool.
${matchedLocations && matchedLocations.length > 0 ? '\n**For the locations listed in PRE-RESOLVED LOCATIONS above, use those exact bounding boxes.**\n' : ''}
For other locations not pre-resolved above, use your geographic knowledge to create appropriate bounding boxes:

**How to resolve locations to bounding boxes:**
You have geographic knowledge of sailing regions. Convert location names to bounding box coordinates:
- Format: {"minLng": number, "minLat": number, "maxLng": number, "maxLat": number}
- Add padding to cover the entire region (smaller regions need more relative padding)

**Common sailing region bounding boxes:**
- Mediterranean: {"minLng": -6, "minLat": 30, "maxLng": 36, "maxLat": 46}
- Western Mediterranean: {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}
- Eastern Mediterranean: {"minLng": 10, "minLat": 30, "maxLng": 36, "maxLat": 42}
- Caribbean: {"minLng": -85, "minLat": 10, "maxLng": -59, "maxLat": 27}
- Greek Islands: {"minLng": 19, "minLat": 34, "maxLng": 30, "maxLat": 42}
- Croatia/Adriatic: {"minLng": 13, "minLat": 42, "maxLng": 20, "maxLat": 46}
- Canary Islands: {"minLng": -18.5, "minLat": 27.5, "maxLng": -13.3, "maxLat": 29.5}
- Balearic Islands: {"minLng": 1.0, "minLat": 38.5, "maxLng": 4.5, "maxLat": 40.5}
- Barcelona area: {"minLng": 1.5, "minLat": 41.0, "maxLng": 2.5, "maxLat": 41.8}
- French Riviera: {"minLng": 5.5, "minLat": 43.0, "maxLng": 7.5, "maxLat": 43.8}
- Italy/Sardinia: {"minLng": 8.0, "minLat": 38.8, "maxLng": 10.0, "maxLat": 41.3}
- Thailand: {"minLng": 97, "minLat": 5, "maxLng": 106, "maxLat": 21}
- Australia East Coast: {"minLng": 150, "minLat": -38, "maxLng": 154, "maxLat": -23}

**Tool call format:**
\`\`\`tool_call
{"name": "search_legs_by_location", "arguments": {"departureBbox": {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}, "departureDescription": "Western Mediterranean", "startDate": "2026-01-01", "endDate": "2026-12-31"}}
\`\`\`

**Location intent detection:**
- Departure: "from", "departing", "starting from", "leaving", "sailing out of", "in the [region]"
- Arrival: "to", "arriving", "going to", "ending in", "heading to"
- If only one location without direction words, assume it's the departure area

**ALWAYS prefer search_legs_by_location over search_legs** when the user mentions a specific geographic location, as it provides more accurate results using spatial coordinates.`;
}

/**
 * Build tool instructions for the AI using shared tool registry.
 * When profileCompletion is true (authenticated user in profile completion mode), includes only profile tools (no registration).
 */
function buildToolInstructions(profileCompletion?: boolean): string {
  const tools = profileCompletion ? getToolsForProspectProfileCompletion() : getToolsForProspect();
  const toolsDescription = toolsToPromptFormat(tools);

  return `
AVAILABLE TOOLS:
${toolsDescription}

TO USE A TOOL, respond with a JSON code block like this:

For geographic location searches (PREFERRED when user mentions a place):
\`\`\`tool_call
{"name": "search_legs_by_location", "arguments": {"departureBbox": {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}, "departureDescription": "Western Mediterranean", "startDate": "2026-01-01", "endDate": "2026-12-31"}}
\`\`\`

For simple text searches:
\`\`\`tool_call
{"name": "search_legs", "arguments": {"query": "adventure sailing", "startDate": "2026-06-01", "endDate": "2026-08-31"}}
\`\`\`

**TOOL SELECTION GUIDE:**
- User mentions a PLACE (Mediterranean, Greece, Caribbean, Barcelona, etc.) → Use \`search_legs_by_location\` with bounding box
- User mentions only dates or general terms (summer, adventure, learning) → Use \`search_legs\` with text query

After receiving tool results, provide a helpful response to the user using the [[leg:UUID:Name]] format for any legs you want to highlight.

IMPORTANT: Always use a tool when the user mentions wanting to sail somewhere or asks about available trips. Don't just respond conversationally - search for actual legs!`;
}

/**
 * Experience level definitions
 */
const EXPERIENCE_LEVEL_DEFINITIONS = {
  1: {
    name: 'Beginner',
    description: 'New to sailing or has only been on a few day sails. Learning basic terminology and boat handling.',
    skills: 'Basic understanding of wind direction, can assist with simple tasks under supervision.',
  },
  2: {
    name: 'Competent Crew',
    description: 'Has sailing experience and can handle various crew duties confidently. Comfortable in moderate conditions.',
    skills: 'Can helm in fair weather, assist with sail changes, handle lines, and stand watches.',
  },
  3: {
    name: 'Coastal Skipper',
    description: 'Experienced sailor who can skipper a yacht safely in coastal waters during daylight and fair weather.',
    skills: 'Navigation, passage planning, weather interpretation, crew management, can handle most coastal conditions.',
  },
  4: {
    name: 'Offshore Skipper',
    description: 'Highly experienced sailor capable of offshore passages including ocean crossings and challenging conditions.',
    skills: 'Advanced navigation, heavy weather sailing, emergency procedures, long-distance passage planning, crew leadership.',
  },
};

/**
 * Risk level definitions
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
 * CRITICAL: Only use these exact skill names. Do not create custom skills.
 */
const SAILING_SKILLS = skillsConfig.general.map(skill => skill.name);

/**
 * Get skills structure from config for AI instructions
 */
function getSkillsStructure(): string {
  return skillsConfig.general.map(skill => 
    `- **${skill.name}**: ${skill.infoText}`
  ).join('\n');
}

/**
 * Normalize risk_level field to ensure it's a proper array
 * Handles: JSON strings, single strings, arrays, null/undefined
 */
function normalizeRiskLevel(value: unknown): string[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's already an array, return it
  if (Array.isArray(value)) {
    return value.filter(v => typeof v === 'string' && v.length > 0);
  }
  
  // If it's a string, try to parse as JSON first
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Try parsing as JSON (handles cases like "["Coastal sailing"]")
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(v => typeof v === 'string' && v.length > 0);
        }
        // If parsed to a single value, wrap in array
        if (typeof parsed === 'string') {
          return [parsed];
        }
      } catch {
        // If JSON parsing fails, treat as single string value
      }
    }
    
    // If not JSON, treat as single string value
    return trimmed.length > 0 ? [trimmed] : null;
  }
  
  // For any other type, convert to string and wrap in array
  return [String(value)];
}

/**
 * Get registration requirements and auto-approval settings for a leg.
 * Used so the AI can guide the user through registration (with or without questions).
 */
async function getLegRegistrationInfo(supabase: SupabaseClient, legId: string) {
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

  const { data: requirements, error: reqError } = await supabase
    .from('journey_requirements')
    .select('id, question_text, question_type, is_required, options')
    .eq('journey_id', journey.id)
    .order('order', { ascending: true });

  if (reqError) {
    throw new Error('Failed to fetch requirements');
  }

  const hasRequirements = requirements && requirements.length > 0;
  const requirementIds = (requirements || []).map((r: { id: string }) => r.id);

  return {
    legId,
    legName: leg.name,
    journeyId: journey.id,
    journeyName: journey.name,
    hasRequirements,
    requirementsCount: requirements?.length || 0,
    requirements: requirements || [],
    /** Exact UUIDs to use as requirement_id in submit_leg_registration answers. Do not invent or substitute other values. */
    requirementIds,
    autoApprovalEnabled: journey.auto_approval_enabled === true,
    autoApprovalThreshold: journey.auto_approval_threshold || 80,
    registrationMethod: hasRequirements ? 'ui_form' : 'assistant_action',
    message: hasRequirements
      ? 'This leg requires answering registration questions. Direct the user to complete registration through the leg details page in the UI.'
      : 'No requirements. You can use suggest_register_for_leg to register the user.',
  };
}

/**
 * Execute prospect tool calls
 */
async function executeProspectTools(
  supabase: SupabaseClient,
  toolCalls: ToolCall[],
  authenticatedUserId?: string | null
): Promise<Array<{ name: string; result: unknown; error?: string }>> {
  const results: Array<{ name: string; result: unknown; error?: string }> = [];

  for (const toolCall of toolCalls) {
    log('Executing tool:', toolCall.name);
    log('Raw arguments:', JSON.stringify(toolCall.arguments));

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
            note: 'CRITICAL: You MUST use ONLY these exact skill names from the config. Do NOT create custom skills. Each skill should be stored as an object with "skill_name" (the exact name from config) and "description" (user-provided text describing their experience with that skill).',
          },
        });
        continue;
      }

      // Leg registration info (used in profile completion to guide registration)
      if (toolCall.name === 'get_leg_registration_info') {
        const legId = args.legId as string;
        if (!legId) {
          results.push({ name: toolCall.name, result: null, error: 'legId is required' });
          continue;
        }
        try {
          const info = await getLegRegistrationInfo(supabase, legId);
          results.push({ name: toolCall.name, result: info });
        } catch (e: any) {
          results.push({ name: toolCall.name, result: null, error: e.message || 'Failed to get leg registration info' });
        }
        continue;
      }

      // Authenticated user tools
      if (toolCall.name === 'get_profile_completion_status') {
        if (!authenticatedUserId) {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'User must be authenticated to get profile completion status',
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
        const optionalFields = ['sailing_preferences', 'certifications', 'phone'];

        for (const field of requiredFields) {
          const value = profile?.[field];
          if (value && (Array.isArray(value) ? value.length > 0 : true)) {
            completionStatus.filledFields.push(field);
          } else {
            completionStatus.missingFields.push(field);
          }
        }

        for (const field of optionalFields) {
          const value = profile?.[field];
          if (value && (Array.isArray(value) ? value.length > 0 : true)) {
            completionStatus.filledFields.push(field);
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
              sailing_preferences: profile?.sailing_preferences,
              certifications: profile?.certifications,
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
            error: 'User must be authenticated to update profile',
          });
          continue;
        }

        // Field alias mapping to handle AI naming variations
        const fieldAliases: Record<string, string> = {
          'risk_levels': 'risk_level',
          'comfort_zones': 'risk_level',
          'comfort_level': 'risk_level',
          'avatar_url': 'profile_image_url',
          'bio': 'user_description',
          'description': 'user_description',
          'about': 'user_description',
          'experience_level': 'sailing_experience',
          'experience': 'sailing_experience',
          'level': 'sailing_experience',
        };

        // Build update object from provided fields
        const updates: Record<string, unknown> = {};
        const allowedFields = [
          'full_name', 'user_description', 'sailing_experience',
          'risk_level', 'skills', 'sailing_preferences', 'certifications',
          'phone', 'profile_image_url'
        ];

        // First, map any aliased field names to their canonical names
        for (const [alias, canonical] of Object.entries(fieldAliases)) {
          if (args[alias] !== undefined && args[canonical] === undefined) {
            log(`Field alias mapping: ${alias} -> ${canonical}`);
            let mappedValue = args[alias];
            
            // Special handling for comfort_zones -> risk_level conversion
            if (alias === 'comfort_zones' && typeof mappedValue === 'string') {
              // Convert comma-separated string to array and map to risk level values
              const zones = mappedValue.split(',').map(z => z.trim());
              const riskLevels: string[] = [];
              
              for (const zone of zones) {
                const lowerZone = zone.toLowerCase();
                if (lowerZone.includes('coastal')) {
                  riskLevels.push('Coastal sailing');
                } else if (lowerZone.includes('offshore') || lowerZone.includes('open-ocean')) {
                  riskLevels.push('Offshore sailing');
                } else if (lowerZone.includes('extreme')) {
                  riskLevels.push('Extreme sailing');
                }
              }
              
              // If no matches found but contains "beginner" or "learning", default to Coastal
              if (riskLevels.length === 0 && (mappedValue.toLowerCase().includes('beginner') || mappedValue.toLowerCase().includes('learning'))) {
                riskLevels.push('Coastal sailing');
              }
              
              mappedValue = riskLevels.length > 0 ? riskLevels : null;
            }
            
            args[canonical] = mappedValue;
          }
        }

        for (const field of allowedFields) {
          if (args[field] !== undefined) {
            let value = args[field];
            
            // Normalize array fields that might come as JSON strings
            if (field === 'risk_level') {
              value = normalizeRiskLevel(value);
            } else if (field === 'skills') {
              // Skills should be an array of skill objects with skill_name and description
              // CRITICAL: Validate that skill_name matches exactly with skills-config.json
              let skillsArray: unknown[] = [];
              
              if (typeof value === 'string') {
                try {
                  const parsed = JSON.parse(value);
                  skillsArray = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  // If parsing fails, treat as single value
                  skillsArray = [value];
                }
              } else if (Array.isArray(value)) {
                skillsArray = value;
              } else {
                skillsArray = [value];
              }
              
              // Validate and normalize skills to use only config skill names
              const validSkillNames = new Set(SAILING_SKILLS);
              const normalizedSkills: Array<{ skill_name: string; description: string }> = [];
              
              for (const skill of skillsArray) {
                if (typeof skill === 'string') {
                  // If it's just a string, check if it's a valid skill name
                  if (validSkillNames.has(skill)) {
                    normalizedSkills.push({ skill_name: skill, description: '' });
                  }
                } else if (skill && typeof skill === 'object') {
                  // If it's an object, validate skill_name
                  const skillObj = skill as Record<string, unknown>;
                  const skillName = (skillObj.skill_name || skillObj.name || skillObj.skillName) as string | undefined;
                  if (skillName && typeof skillName === 'string' && validSkillNames.has(skillName)) {
                    normalizedSkills.push({
                      skill_name: skillName,
                      description: (skillObj.description || skillObj.desc || '') as string,
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

        // Check if profile row exists (newly signed-up users may not have one yet)
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, username, roles')
          .eq('id', authenticatedUserId)
          .single();

        let operationType: 'insert' | 'update';

        if (existingProfile) {
          // Profile exists - update it
          operationType = 'update';

          // Ensure the 'crew' role is set if roles are empty (prospect flow = crew)
          const existingRoles = existingProfile.roles as string[] | null;
          if (!existingRoles || existingRoles.length === 0) {
            updates.roles = ['crew'];
            log('Profile has no roles set, adding default crew role');
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
            log('⚠️ Profile update matched 0 rows despite profile existing - possible RLS issue');
            results.push({
              name: toolCall.name,
              result: null,
              error: 'Profile update failed: no rows were affected. This may be a permissions issue.',
            });
            continue;
          }
        } else {
          // Profile doesn't exist yet - insert a new one
          operationType = 'insert';

          // Generate a username from full_name or user ID
          const baseName = (updates.full_name as string)
            ? (updates.full_name as string).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)
            : `user_${authenticatedUserId.substring(0, 8)}`;
          const username = `${baseName}_${Date.now().toString(36)}`;

          // Get user email from auth for the profile
          let email: string | undefined;
          try {
            const { data: authUser } = await supabase.auth.getUser();
            email = authUser?.user?.email || undefined;
          } catch {
            // Email is optional, continue without it
          }

          const insertData: Record<string, unknown> = {
            id: authenticatedUserId,
            username,
            ...updates,
            created_at: new Date().toISOString(),
            roles: ['crew'], // Default role for prospects
          };

          if (email) {
            insertData.email = email;
          }

          log('Profile does not exist, inserting new profile:', insertData);

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
        log(`Profile ${operationType}d successfully:`, updates);
        results.push({
          name: toolCall.name,
          result: {
            success: true,
            operation: operationType,
            updatedFields: updatedFieldNames,
            message: operationType === 'insert'
              ? 'Profile created and populated successfully'
              : 'Profile updated successfully',
          },
        });
        continue;
      }

      // Leg registration (profile completion: user approved suggest_register_for_leg or submit_leg_registration)
      if (
        (toolCall.name === 'suggest_register_for_leg' || toolCall.name === 'submit_leg_registration') &&
        authenticatedUserId
      ) {
        const legId = args.legId as string;
        if (!legId) {
          results.push({ name: toolCall.name, result: null, error: 'legId is required' });
          continue;
        }

        const { data: leg, error: legErr } = await supabase
          .from('legs')
          .select(`
            id,
            name,
            journey_id,
            journeys!inner ( id, state )
          `)
          .eq('id', legId)
          .single();

        if (legErr || !leg) {
          results.push({ name: toolCall.name, result: null, error: 'Leg not found' });
          continue;
        }

        const journey = (leg as any).journeys;
        if (journey?.state !== 'Published') {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'This journey is not currently accepting registrations.',
          });
          continue;
        }

        const { data: existing } = await supabase
          .from('registrations')
          .select('id, status')
          .eq('leg_id', legId)
          .eq('user_id', authenticatedUserId)
          .single();

        if (existing && existing.status !== 'Cancelled') {
          results.push({
            name: toolCall.name,
            result: null,
            error: 'You are already registered for this leg.',
          });
          continue;
        }

        // For submit_leg_registration with answers: validate requirement_id values (or correct by index)
        const rawAnswers = (args.answers as any[] | undefined) ?? [];
        let answers = rawAnswers;
        if (toolCall.name === 'submit_leg_registration' && rawAnswers.length > 0) {
          const { data: requirements } = await supabase
            .from('journey_requirements')
            .select('id')
            .eq('journey_id', journey.id)
            .order('order', { ascending: true });
          const reqList = requirements || [];
          const validRequirementIds = new Set(reqList.map((r: { id: string }) => r.id));
          const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const allValid = rawAnswers.every((a: any) => {
            const rid = a?.requirement_id;
            return typeof rid === 'string' && uuidLike.test(rid) && validRequirementIds.has(rid);
          });
          if (!allValid && rawAnswers.length === reqList.length) {
            // Fallback: AI sent invented IDs (e.g. req_001). Map answers to requirement UUIDs by index.
            log('Correcting requirement_id by index (AI sent non-UUIDs); requirement count matches.');
            answers = rawAnswers.map((a: any, i: number) => ({
              ...a,
              requirement_id: reqList[i].id,
            }));
          } else if (!allValid) {
            const invalidAnswer = rawAnswers.find((a: any) => {
              const rid = a?.requirement_id;
              return typeof rid !== 'string' || !uuidLike.test(rid) || !validRequirementIds.has(rid);
            });
            const bad = invalidAnswer ? (typeof invalidAnswer.requirement_id === 'string' ? invalidAnswer.requirement_id : JSON.stringify(invalidAnswer.requirement_id)) : '?';
            const exampleId = validRequirementIds.size ? Array.from(validRequirementIds)[0] : '(call get_leg_registration_info to get IDs)';
            results.push({
              name: toolCall.name,
              result: null,
              error: `Invalid requirement_id in answers. Each requirement_id must be the exact UUID returned by get_leg_registration_info for each question (e.g. ${exampleId}). Do not use placeholders. Invalid value received: "${bad}". Call get_leg_registration_info(legId) to get the correct requirement IDs and use those exact UUIDs in submit_leg_registration.`,
            });
            continue;
          }
        }

        const notes = (args.notes as string) || null;
        const { data: registration, error: insertErr } = await supabase
          .from('registrations')
          .insert({
            leg_id: legId,
            user_id: authenticatedUserId,
            status: 'Pending approval',
            notes,
          })
          .select()
          .single();

        if (insertErr) {
          results.push({
            name: toolCall.name,
            result: null,
            error: insertErr.message || 'Failed to create registration',
          });
          continue;
        }

        if (toolCall.name === 'submit_leg_registration' && answers.length > 0 && registration) {
          const answersToInsert = answers.map((a: any) => ({
            registration_id: registration.id,
            requirement_id: a.requirement_id,
            answer_text: a.answer_text ?? null,
            answer_json: a.answer_json ?? null,
          }));
          const { error: answersErr } = await supabase.from('registration_answers').insert(answersToInsert);
          if (answersErr) {
            log('Error saving registration answers:', answersErr);
          }
        }

        results.push({
          name: toolCall.name,
          result: {
            success: true,
            message: `Successfully registered for ${leg.name}! Your registration is pending approval. The boat owner has been notified.`,
            legName: leg.name,
            registrationId: registration?.id,
          },
        });
        continue;
      }

      if (toolCall.name === 'search_legs') {
        // Text-based search using shared utilities
        const dateArgs = normalizeDateArgs(args);
        const locationArgs = normalizeLocationArgs(args);

        log('Normalized date args:', dateArgs);
        log('Normalized location args:', locationArgs);

        const searchOptions: LegSearchOptions = {
          startDate: dateArgs.startDate,
          endDate: dateArgs.endDate,
          locationQuery: locationArgs.locationQuery,
          riskLevel: args.riskLevel as string,
          limit: (args.limit as number) || 5,
          crewNeeded: true,
        };

        const searchResult = await searchPublishedLegs(supabase, searchOptions);
        log('Found legs:', searchResult.count);
        results.push({
          name: toolCall.name,
          result: { legs: searchResult.legs, total: searchResult.count },
        });

      } else if (toolCall.name === 'search_legs_by_location') {
        // Geographic bounding box search using shared utilities
        const dateArgs = normalizeDateArgs(args);
        const bboxArgs = normalizeBboxArgs(args);

        log('Normalized date args:', dateArgs);
        log('Normalized bbox args:', bboxArgs);

        // Validate that at least one bbox was successfully parsed
        if (!bboxArgs.departureBbox && !bboxArgs.arrivalBbox) {
          // Check if the AI tried to provide bbox but with missing coordinates
          const providedDeparture = args.departureBbox as Record<string, unknown> | undefined;
          const providedArrival = args.arrivalBbox as Record<string, unknown> | undefined;

          let errorDetails = 'No valid bounding box provided.';
          if (providedDeparture) {
            const missing = ['minLng', 'minLat', 'maxLng', 'maxLat'].filter(
              (k) => providedDeparture[k] === undefined
            );
            if (missing.length > 0) {
              errorDetails = `departureBbox is missing required coordinates: ${missing.join(', ')}. You provided: ${JSON.stringify(providedDeparture)}`;
            }
          }
          if (providedArrival) {
            const missing = ['minLng', 'minLat', 'maxLng', 'maxLat'].filter(
              (k) => providedArrival[k] === undefined
            );
            if (missing.length > 0) {
              errorDetails = `arrivalBbox is missing required coordinates: ${missing.join(', ')}. You provided: ${JSON.stringify(providedArrival)}`;
            }
          }

          results.push({
            name: toolCall.name,
            result: null,
            error: `${errorDetails} Each bounding box must have all 4 coordinates: minLng, minLat, maxLng, maxLat.`,
          });
          continue;
        }

        const searchOptions: LegSearchOptions = {
          startDate: dateArgs.startDate,
          endDate: dateArgs.endDate,
          departureBbox: bboxArgs.departureBbox,
          arrivalBbox: bboxArgs.arrivalBbox,
          departureDescription: bboxArgs.departureDescription,
          arrivalDescription: bboxArgs.arrivalDescription,
          limit: (args.limit as number) || 5,
          crewNeeded: true,
        };

        const searchResult = await searchLegsByBbox(supabase, searchOptions);
        log('Found legs:', searchResult.count);
        if (searchResult.dateAvailability) {
          log('Date availability info:', searchResult.dateAvailability);
        }
        results.push({
          name: toolCall.name,
          result: {
            legs: searchResult.legs,
            total: searchResult.count,
            searchedDeparture: searchResult.searchedDeparture,
            searchedArrival: searchResult.searchedArrival,
            message: searchResult.message,
            dateAvailability: searchResult.dateAvailability,
          },
        });

      } else {
        results.push({ name: toolCall.name, result: null, error: `Unknown tool: ${toolCall.name}` });
      }
    } catch (error: any) {
      log('Tool execution error:', error);
      results.push({ name: toolCall.name, result: null, error: error.message });
    }
  }

  return results;
}

/**
 * Validate and filter leg references in AI response content.
 * Removes any [[leg:UUID:Name]] references that don't match valid leg IDs from tool results.
 * This prevents hallucinated legs from appearing as clickable links.
 */
function validateAndFilterLegReferences(
  content: string,
  validLegIds: Set<string>
): { filteredContent: string; removedCount: number } {
  const legRefRegex = /\[\[leg:([a-f0-9-]+):([^\]]+)\]\]/gi;
  let removedCount = 0;

  const filteredContent = content.replace(legRefRegex, (match, uuid, name) => {
    if (validLegIds.has(uuid)) {
      return match; // Keep valid references
    } else {
      removedCount++;
      // Replace with just the name (no link) so the text still makes sense
      return name;
    }
  });

  return { filteredContent, removedCount };
}

/**
 * Detect potential plain-text hallucinated leg descriptions.
 * Returns true if the content appears to describe specific legs when none should exist.
 * This is a heuristic check - not perfect but catches common patterns.
 */
function detectPlainTextHallucination(content: string, hasValidLegs: boolean): boolean {
  if (hasValidLegs) return false; // If we have valid legs, descriptions are expected

  // Patterns that suggest the AI is describing specific (fake) legs
  const hallucinationPatterns = [
    /\b\d+[-\s]?days?\b.*(?:trip|cruise|journey|adventure|sailing)/i,  // "7 days trip", "10-day cruise"
    /(?:trip|cruise|journey|adventure|leg).*\b\d+[-\s]?days?\b/i,      // "trip - 7 days"
    /^[-•*]\s*[A-Z][^-\n]+[-–]\s*\d+\s*[Dd]ays?/m,                     // Bullet: "- Mediterranean Breeze - 7 Days"
    /here\s+(?:are|is)\s+(?:a\s+)?(?:few|some|the)\s+legs?\b/i,        // "Here are some legs"
    /(?:found|discovered|have)\s+(?:a\s+)?(?:few|some|these)\s+(?:great|perfect|ideal)?\s*(?:sailing\s+)?(?:legs?|options?|trips?)/i,
  ];

  for (const pattern of hallucinationPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract leg references from tool results
 */
function extractLegReferences(
  toolResults: Array<{ name: string; result: unknown }>
): ProspectLegReference[] {
  const refs: ProspectLegReference[] = [];
  const seenIds = new Set<string>();

  for (const result of toolResults) {
    if (!result.result) continue;

    const data = result.result as { legs?: any[] };
    if (!data?.legs || !Array.isArray(data.legs)) continue;

    for (const leg of data.legs) {
      if (!leg.id || seenIds.has(leg.id)) continue;
      seenIds.add(leg.id);

      refs.push({
        id: leg.id,
        name: leg.name || 'Unnamed leg',
        journeyName: leg.journeyName,
        journeyId: leg.journeyId,
        boatName: leg.boatName,
        startDate: leg.startDate,
        endDate: leg.endDate,
        departureLocation: leg.departureLocation,
        arrivalLocation: leg.arrivalLocation,
        journeyImages: leg.journeyImages,
        boatImages: leg.boatImages,
      });

      if (refs.length >= MAX_LEG_REFERENCES) return refs;
    }
  }

  return refs;
}

/**
 * Main prospect chat function
 */
export async function prospectChat(
  supabase: SupabaseClient,
  request: ProspectChatRequest
): Promise<ProspectChatResponse> {
  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║           PROSPECT CHAT - NEW REQUEST                        ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log('📥 USER MESSAGE:', request.message);
  log('📋 Session ID:', request.sessionId || '(new session)');
  log('📜 Conversation history length:', request.conversationHistory?.length || 0);
  log('👤 Profile completion mode:', request.profileCompletionMode || false);
  log('🔐 Authenticated user ID:', request.authenticatedUserId || '(none)');
  log('👤 User profile:', request.userProfile || '(none)');

  const sessionId = request.sessionId || `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const preferences = request.gatheredPreferences || {};
  const history = request.conversationHistory || [];
  const authenticatedUserId = request.authenticatedUserId || null;
  const userProfile = request.userProfile || null;
  const isProfileCompletionMode = request.profileCompletionMode && !!authenticatedUserId;

  // Check if user already has a profile (authenticated user with existing profile)
  let hasExistingProfile = false;
  if (authenticatedUserId && !isProfileCompletionMode) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, profile_completion_percentage')
      .eq('id', authenticatedUserId)
      .maybeSingle();
    
    if (profile && profile.roles && profile.roles.length > 0) {
      hasExistingProfile = true;
      log('✅ User already has a profile with roles:', profile.roles);
    }
  }

  // Handle approved action - execute the held tool call directly
  if (request.approvedAction && authenticatedUserId) {
    const actionName = request.approvedAction.toolName;
    log('✅ Executing approved action:', actionName);

    const toolCall: ToolCall = {
      id: `approved_${Date.now()}`,
      name: actionName,
      arguments: request.approvedAction.arguments,
    };

    const toolResults = await executeProspectTools(supabase, [toolCall], authenticatedUserId);
    const result = toolResults[0];

    let responseContent: string;
    if (result?.error) {
      responseContent = `There was an issue saving your profile: ${result.error}\n\nPlease try again or you can complete your profile manually on the profile page.`;
    } else {
      // update_user_profile success
      const updatedFields = (result?.result as { updatedFields?: string[] })?.updatedFields || [];
      responseContent = `Your profile has been saved successfully! Updated fields: ${updatedFields.join(', ')}.\n\nYou can now browse sailing opportunities and boat owners will be able to see your profile. To register for a specific leg, go to the Crew dashboard and use "Register for leg" on the leg you want. You can always edit your profile later from the profile page.`;
    }

    const responseMessage: ProspectMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date().toISOString(),
    };

    return {
      sessionId,
      message: responseMessage,
      extractedPreferences: undefined,
    };
  }

  // Extract and match locations from the user's message against our registry
  const matchedLocations = extractMatchedLocations(request.message);
  if (matchedLocations.length > 0) {
    log('📍 PRE-RESOLVED LOCATIONS:', matchedLocations.map(m => `${m.region.name} (matched: "${m.matchedTerm}")`));
  }

  // Build prompts with pre-resolved locations
  let systemPrompt = buildProspectSystemPrompt(preferences, matchedLocations);

  // Add instructions if user already has a profile
  if (hasExistingProfile && authenticatedUserId) {
    systemPrompt += `

## USER ALREADY HAS A PROFILE

**IMPORTANT:** This user is already logged in and has an existing profile with roles. They can start searching for matching sailing trips right away!

- The user already has an account and profile - no need to suggest signup or profile creation
- Focus on helping them find sailing opportunities that match their interests
- They can register for legs directly from the Crew dashboard
- Be welcoming and acknowledge they're already set up: "Great to see you back! You're all set with your profile. Let me help you find some amazing sailing opportunities."

**Your goal:** Help them discover and explore sailing trips, not onboarding.`;
  }

  // Add profile completion instructions if in that mode
  if (isProfileCompletionMode) {
    systemPrompt += `

## PROFILE COMPLETION MODE

You are now helping an authenticated user complete their profile after signing up.

**CRITICAL: EXTRACT INFORMATION FROM CONVERSATION HISTORY**

You MUST carefully review the ENTIRE conversation history above. The user has likely already shared detailed information about themselves including:
- Their sailing experience and background
- Skills: CRITICAL - Map any mentioned skills to the exact skill names from the config (see skills section below). Do NOT create custom skills.
- Certifications or training
- What kind of sailing they're looking for
- Their availability and preferred locations
- Personal details and bio information

**DO NOT ask for information that was already provided in the conversation!**
Instead, extract this information and use it to build their profile.

${(() => {
  const known: string[] = [];
  if (userProfile?.fullName) known.push(`- **Name:** "${userProfile.fullName}"`);
  if (userProfile?.email) known.push(`- **Email:** "${userProfile.email}"`);
  if (userProfile?.phone) known.push(`- **Phone:** "${userProfile.phone}"`);
  if (userProfile?.avatarUrl) known.push(`- **Profile photo:** Already set from their account`);
  if (known.length > 0) {
    return `\n**FROM SIGNUP/OAUTH:**\n${known.join('\n')}\n`;
  }
  return '';
})()}

**PRIORITY (CRITICAL):**
- Your **FIRST** response MUST be to extract profile from the conversation and **PRESENT the profile summary** to the user. Get the user to confirm, then call \`update_user_profile\` so the profile is stored.

**Your workflow in this mode:**
1. **FIRST:** Carefully read ALL previous messages in the conversation
2. **EXTRACT** all profile-relevant information the user has shared:
   - Bio/description: Any personal story, background, journey, personality traits
   - Experience: Sailing courses, trips, crossings, time on water
   - Skills: CRITICAL - You MUST use ONLY the exact skill names from the skills config (see below). Map user's described skills to the closest matching skill from the config. Each skill should be stored as an object: {"skill_name": "exact_name_from_config", "description": "user's description of their experience"}
   - Certifications: Any sailing qualifications mentioned
   - Comfort zones: Based on experience (if they've done ocean crossings, they're comfortable offshore)
   - Preferences: Where they want to sail, what they're looking for
3. **PRESENT** a comprehensive profile summary based on what you extracted
4. **ASK** only for information that is genuinely missing (not mentioned at all)

**Profile fields to populate:**
1. **full_name** - ${userProfile?.fullName ? `"${userProfile.fullName}"` : 'Extract from conversation or ask'}
2. **user_description** - Create a compelling bio from their story. Include personality, background, journey, and what makes them unique.
3. **sailing_preferences** - What they're looking for: routes, regions, trip types
4. **sailing_experience** - 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper. Determine from their described experience.
5. **risk_level** - Array: "Coastal sailing", "Offshore sailing", "Extreme sailing". Infer from their experience level.
6. **skills** - CRITICAL: Array of skill objects. You MUST use ONLY these exact skill names from the config:
${getSkillsStructure()}

**SKILLS RULES (CRITICAL):**
- You MUST use ONLY the exact skill names listed above
- Do NOT create custom skills like "carpentry", "mechanics", "yoga", etc.
- If user mentions skills not in the config, map them to the closest matching skill from the config (e.g., "carpentry" → "technical_skills", "cooking" → "cooking")
- Each skill must be an object: {"skill_name": "exact_name_from_config", "description": "user's description"}
- The "skill_name" field MUST match exactly one of the skill names from the config above
- Example: {"skill_name": "navigation", "description": "I have 5 years experience using GPS and chartplotters"}

7. **certifications** - Any sailing certifications or courses mentioned

**CRITICAL: AUTO-SAVE ON USER CONFIRMATION**
- FIRST present a clear summary of ALL extracted profile data
- Format as a readable list showing each field and its value
- Ask: "Does this capture your profile correctly? Just say 'yes' or 'ok' and I'll save it for you."
- **YOU must determine the user's intent from their response:**
  - **If the user confirms** (e.g., "yes", "ok", "sounds good", "correct", "save it", "go ahead", "that's right", etc.), **call \`update_user_profile\` immediately** - execute the tool call directly without waiting
  - **If the user rejects or wants changes** (e.g., "no", "wrong", "change", "edit", "not correct", "modify", etc.), help them modify the profile data first - do NOT call update_user_profile
  - **If the user's response is ambiguous or unclear**, present the profile summary again and ask for clear confirmation - do NOT call update_user_profile yet
- **Your decision to call \`update_user_profile\` should be based on your understanding of the user's intent** - if they confirmed, call it immediately; if they rejected or were ambiguous, do not call it
- **Always encourage the user to confirm and save** so their profile is stored; the session goal is to get the profile saved. If they hesitate, explain that saving the profile lets boat owners see their experience when they register for legs.

**Available tools:** (see full list below) include profile tools (update_user_profile, get_profile_completion_status) and search tools. No registration tools – registration is done on the Crew dashboard.

**Registration:** Registration for legs is done on the Crew dashboard (leg details panel), not in this chat. Your only goal here is to gather profile information and save it with \`update_user_profile\`. After the profile is saved, the user can use "Register for leg" on any leg in the Crew dashboard.

**SUGGESTED PROMPTS:**
At the end of your response, include 2-3 suggested follow-up questions to help save the profile in format like this: 
[SUGGESTIONS]
- "Can you add more details about my sailing experience?"
- "What other skills should I include?"
- "Does this profile look complete?"
[/SUGGESTIONS]

Make suggestions contextual:
- If profile is incomplete: suggest what's missing ("Tell me about your certifications", "What sailing skills do you have?")
- If profile is ready: suggest confirming and saving ("Does this look correct?", "Ready to save my profile?")
- After saving: suggest next steps ("How do I register for legs?", "Show me sailing opportunities")

**Example of CORRECT behavior:**
User previously said: "I have 8 years carpentry experience, did a Gibraltar crossing on a Neel 47, took teen sailing courses, I'm a yoga teacher, available now for transatlantic from Canaries"

Your response should be:
"Welcome back! Based on our conversation, here's your profile:

• **Bio:** [Craft a compelling bio from their story]
• **Experience:** Competent Crew (Level 2) - sailing courses, Gibraltar crossing, regular sailing experience
• **Comfort zones:** Coastal sailing, Offshore sailing
• **Skills:** 
  - technical_skills: "8 years carpentry experience, boat maintenance"
  - sailing_experience: "Gibraltar crossing on Neel 47, teen sailing courses"
  - physical_fitness: "Yoga teacher, good physical condition"
• **Preferences:** Transatlantic crossing from Canary Islands, available now

Does this look right?"

Note: Map "carpentry" to "technical_skills", "yoga" to "physical_fitness" - use ONLY config skill names!

**DO NOT** respond with "I still need your bio, experience level..." when the user already provided this information!`;
  }

  const toolInstructions = buildToolInstructions(isProfileCompletionMode);
  const fullSystemPrompt = systemPrompt + '\n\n' + toolInstructions;

  log('');
  log('📝 SYSTEM PROMPT LENGTH:', `${fullSystemPrompt.length} chars`);

  // Build messages for AI
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: fullSystemPrompt },
  ];

  // Add history (limited)
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current user message
  messages.push({ role: 'user', content: request.message });

  log('💬 Total messages for AI:', messages.length);

  // Process with tool loop
  // The AI decides whether to call update_user_profile based on user confirmation intent
  let allToolCalls: ToolCall[] = [];
  let allLegRefs: ProspectLegReference[] = [];
  let currentMessages = [...messages];
  let iterations = 0;
  let finalContent = '';

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    log('');
    log(`🔄 ITERATION ${iterations}/${MAX_TOOL_ITERATIONS}`);

    // Build prompt for AI
    const promptText = currentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');

    // Call AI
    const result = await callAI({
      useCase: 'prospect-chat',
      prompt: promptText,
    });

    log('📥 AI RESPONSE:', `${result.text.length} chars from ${result.provider}/${result.model}`);
    log('');
    log('RESPONSE TEXT:');
    log('─'.repeat(60));
    log(result.text);
    log('─'.repeat(60));

    // Parse tool calls using shared utility
    const { content, toolCalls } = parseToolCalls(result.text);

    log('');
    log('🔧 PARSED TOOL CALLS:', toolCalls.length);
    if (toolCalls.length > 0) {
      toolCalls.forEach((tc, i) => {
        log(`  [${i}] ${tc.name}:`, JSON.stringify(tc.arguments));
      });
    }

    if (toolCalls.length === 0) {
      finalContent = content;
      log('✅ No tool calls, final content ready');
      break;
    }

    // Execute all tool calls - AI decides whether to call update_user_profile based on user confirmation
    // If AI calls update_user_profile, it means it detected user confirmation and we execute it directly
    allToolCalls.push(...toolCalls);
    const toolResults = await executeProspectTools(supabase, toolCalls, authenticatedUserId);

    log('');
    log('📊 TOOL RESULTS:');
    toolResults.forEach((r, i) => {
      if (r.error) {
        log(`  [${i}] ${r.name}: ❌ Error: ${r.error}`);
      } else {
        const resultStr = JSON.stringify(r.result);
        log(`  [${i}] ${r.name}: ✅ ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);
      }
    });

    // Extract leg references
    const newRefs = extractLegReferences(toolResults);
    allLegRefs.push(...newRefs);

    // Add tool results for next iteration using shared utility
    const toolResultsText = formatToolResultsForAI(toolResults);

    // Check if any legs were found in the results
    const foundLegsCount = toolResults.reduce((count, r) => {
      const data = r.result as { legs?: unknown[] } | null;
      return count + (data?.legs?.length || 0);
    }, 0);

    // Build context message with appropriate guidance based on results
    let contextMessage = `Tool results:\n${toolResultsText}\n\n`;
    if (foundLegsCount === 0) {
      contextMessage += `IMPORTANT: The search returned 0 legs. Do NOT make up or describe fictional legs. Honestly tell the user no matching legs were found and suggest alternatives (different dates, broader area, etc.).\n\n`;
    }
    contextMessage += `Now provide a helpful response to the user. ${foundLegsCount > 0 ? 'Format any legs as [[leg:UUID:Name]] using ONLY the exact UUIDs and names from the results above.' : 'Do NOT list any specific leg names since none were found.'}`;

    currentMessages.push(
      { role: 'assistant', content: result.text },
      { role: 'user', content: contextMessage }
    );
  }

  // Validate and filter leg references to prevent hallucinated legs
  // Only allow leg references that were actually returned from tool calls
  const validLegIds = new Set(allLegRefs.map(leg => leg.id));
  const { filteredContent, removedCount } = validateAndFilterLegReferences(finalContent, validLegIds);

  if (removedCount > 0) {
    log(`⚠️ HALLUCINATION DETECTED: Removed ${removedCount} invalid leg reference(s) from AI response`);
  }

  // Check for plain-text hallucinations (describing fake legs without UUID format)
  const hasPlainTextHallucination = detectPlainTextHallucination(filteredContent, allLegRefs.length > 0);
  if (hasPlainTextHallucination) {
    log(`⚠️ PLAIN-TEXT HALLUCINATION SUSPECTED: AI may be describing non-existent legs without proper references`);
    // Note: We log this but don't auto-fix plain text as it's harder to do without breaking legitimate content
  }

  // Create response message with validated content
  const responseMessage: ProspectMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    content: filteredContent,
    timestamp: new Date().toISOString(),
    metadata: {
      toolCalls: allToolCalls.length > 0 ? allToolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments as Record<string, unknown>,
      })) : undefined,
      legReferences: allLegRefs.length > 0 ? allLegRefs : undefined,
    },
  };

  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║           PROSPECT CHAT - COMPLETE                           ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log('📤 FINAL RESPONSE:', `${filteredContent.length} chars`);
  log('📊 Tool calls:', allToolCalls.length);
  log('🦵 Leg refs:', allLegRefs.length);
  log('');

  return {
    sessionId,
    message: responseMessage,
    extractedPreferences: undefined,
  };
}
