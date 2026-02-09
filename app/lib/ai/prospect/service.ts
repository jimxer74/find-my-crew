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

  return `You are SailSmart's friendly AI assistant helping potential crew members discover sailing opportunities.

CURRENT DATE: ${currentDate}
IMPORTANT: Today's date is ${currentDate}. When users ask about sailing trips, use ${currentYear} or later for date searches. Do NOT use past years like 2024 or 2025 - always search for upcoming trips.

## PRIMARY INTENT DETECTION (CRITICAL)

**There are TWO possible primary user intents. Detect which one applies and act accordingly:**

### Intent A: REGISTER FOR A SPECIFIC LEG (Highest Priority)
**Triggered when:**
- User says "I want to join [leg name]" or mentions a specific leg ID
- User clicks a "Join" button on a leg card (you'll see messages like "I want to join the 'X' leg. [Leg ID: uuid]")
- User expresses clear intent to register for a particular sailing leg they've seen

**Your goal for Intent A:**
- FOCUS ENTIRELY on helping them register for THAT specific leg
- DO NOT suggest other legs - they've already chosen
- Guide them to sign up so they can complete registration
- If they're not signed in, explain they need to create an account first
- Be enthusiastic about their choice and help them proceed

### Intent B: DISCOVER SAILING OPPORTUNITIES (Default)
**Triggered when:**
- User is browsing, exploring, asking general questions
- User hasn't expressed intent to join a specific leg
- User wants to find legs matching their preferences

**Your goal for Intent B:**
- Help users find sailing trips that match their interests
- Gather preferences through natural conversation
- Show matching legs and encourage exploration
- Eventually guide them to sign up to get full access

## CONVERSATION STYLE:
- Be warm, enthusiastic, and conversational
- Ask one or two questions at a time, not long lists
- Show matching sailing legs as soon as you have enough information
- Keep responses concise and focused

## WHAT TO DISCOVER (for Intent B - discovery flow):
1. What kind of sailing experience they're looking for (adventure, learning, relaxation, etc.)
2. Their experience level (beginner to experienced)
3. When they're available to sail
4. Where they'd like to sail (departure/arrival areas)
5. Any specific skills or certifications they have

${hasPreferences ? `
GATHERED PREFERENCES SO FAR:
${preferences.sailingGoals ? `- Sailing goals: ${preferences.sailingGoals}` : ''}
${preferences.experienceLevel ? `- Experience level: ${preferences.experienceLevel}/4` : ''}
${preferences.preferredDates?.start ? `- Available: ${preferences.preferredDates.start} to ${preferences.preferredDates.end}` : ''}
${preferences.preferredLocations?.length ? `- Preferred locations: ${preferences.preferredLocations.join(', ')}` : ''}
${preferences.skills?.length ? `- Skills: ${preferences.skills.join(', ')}` : ''}
${preferences.riskLevels?.length ? `- Comfort level: ${preferences.riskLevels.join(', ')}` : ''}
${(preferences as any).targetLegId ? `
**TARGET LEG FOR REGISTRATION:**
- Leg ID: ${(preferences as any).targetLegId}
- Leg Name: ${(preferences as any).targetLegName || 'Unknown'}
- **IMPORTANT:** User has clicked "Join" on this specific leg. Focus on helping them register for THIS leg. Do not suggest alternatives.
` : ''}
` : ''}

RESPONSE FORMAT:
When showing sailing opportunities, use this format for leg references:
[[leg:LEG_UUID:Leg Name]]

Example: "I found some great options for you! Check out [[leg:abc-123:Mediterranean Crossing]] - a 10-day adventure from Spain to Greece."

IMPORTANT:
- Always format leg references exactly as [[leg:UUID:Name]] so they appear as clickable badges
- After showing interesting legs, gently encourage users to sign up to register and get more details
- Keep the conversation flowing naturally - don't overwhelm with too many legs at once
- If the user shares details about themselves, acknowledge and use that information

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

## REGISTRATION INTENT HANDLING (Intent A - CRITICAL)

**IMPORTANT: When a user wants to join a SPECIFIC leg, THIS IS YOUR PRIMARY GOAL. Do not get distracted.**

**Registration intent indicators:**
- "I want to register for..."
- "I'd like to join..."
- "I want to join the '[leg name]' leg. [Leg ID: xxx]" (from clicking Join button)
- "How do I sign up for..."
- "I want to book..."
- "Can I register..."
- "Sign me up for..."

**When registration intent is detected for a SPECIFIC leg:**
1. **ACKNOWLEDGE their excellent choice** - be enthusiastic about the leg they chose
2. **DO NOT suggest other legs** - they've already made their choice
3. **EXPLAIN the signup requirement**: "To register for this leg, you'll need to create an account first. Click the **Sign up** button above to get started - it only takes a minute!"
4. **HIGHLIGHT the benefits**: Their sailing preferences will be saved, they can communicate with the boat owner
5. **STAY FOCUSED**: If they ask follow-up questions, answer them. Don't redirect to other opportunities.
6. **After signup**: They'll return and can complete registration for THIS leg

**Example response when user clicks "Join" on a specific leg:**
"Excellent choice! 🌊 [Leg Name] looks like a fantastic adventure!

To register for this sailing leg, you'll need to create a free account first. Click the **Sign up** button at the top of our chat - it only takes a minute!

Once you're signed up, you'll be able to complete your registration and the boat owner will be notified of your interest. I'll remember that you want to join this specific leg, so we can continue from there.

Is there anything specific you'd like to know about this journey while you create your account?"

**CRITICAL: Once a user has expressed intent to join a SPECIFIC leg, DO NOT:**
- Suggest alternative legs
- Ask "would you like to see other options?"
- Show leg carousels with other opportunities
- Redirect the conversation away from their chosen leg

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
 * Build tool instructions for the AI using shared tool registry
 */
function buildToolInstructions(): string {
  const tools = getToolsForProspect();
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
 * Available sailing skills
 */
const SAILING_SKILLS = [
  'Helming',
  'Navigation',
  'Sail trimming',
  'Anchoring',
  'Line handling',
  'Winching',
  'Docking/Mooring',
  'Weather forecasting',
  'Diesel engine maintenance',
  'Electrical systems',
  'Plumbing/Watermaker',
  'Cooking/Provisioning',
  'First aid',
  'Radio operation (VHF)',
  'Radar operation',
  'Spinnaker handling',
  'Heavy weather sailing',
  'Night sailing',
  'Man overboard recovery',
  'Emergency procedures',
];

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
            note: 'These are common sailing skills. Users can also add custom skills.',
          },
        });
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
          'avatar_url': 'profile_image_url',
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
            args[canonical] = args[alias];
          }
        }

        for (const field of allowedFields) {
          if (args[field] !== undefined) {
            updates[field] = args[field];
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

  // Handle approved action - execute the held tool call directly
  if (request.approvedAction && authenticatedUserId) {
    log('✅ Executing approved action:', request.approvedAction.toolName);

    const toolCall: ToolCall = {
      id: `approved_${Date.now()}`,
      name: request.approvedAction.toolName,
      arguments: request.approvedAction.arguments,
    };

    const toolResults = await executeProspectTools(supabase, [toolCall], authenticatedUserId);
    const result = toolResults[0];

    let responseContent: string;
    if (result?.error) {
      responseContent = `There was an issue saving your profile: ${result.error}\n\nPlease try again or you can complete your profile manually on the profile page.`;
    } else {
      const updatedFields = (result?.result as { updatedFields?: string[] })?.updatedFields || [];
      responseContent = `Your profile has been saved successfully! Updated fields: ${updatedFields.join(', ')}.\n\nYou can now browse sailing opportunities and boat owners will be able to see your profile. You can always edit your profile later from the profile page to add more details.`;
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

  // Add profile completion instructions if in that mode
  if (isProfileCompletionMode) {
    systemPrompt += `

## PROFILE COMPLETION MODE

You are now helping an authenticated user complete their profile after signing up. The user's preferences from your previous conversation have been gathered.
${(() => {
  const known: string[] = [];
  if (userProfile?.fullName) known.push(`- **Name:** "${userProfile.fullName}"`);
  if (userProfile?.email) known.push(`- **Email:** "${userProfile.email}"`);
  if (userProfile?.phone) known.push(`- **Phone:** "${userProfile.phone}"`);
  if (userProfile?.avatarUrl) known.push(`- **Profile photo:** Already set from their account`);
  if (known.length > 0) {
    return `\n**ALREADY KNOWN (from signup/OAuth - do NOT ask for these again):**\n${known.join('\n')}\n\nUse this information directly when building the profile. Greet the user by name if known.\n`;
  }
  return '';
})()}
**Your goals in this mode:**
1. Welcome the user back by name (if known) and acknowledge they've signed up
2. Summarize what you know about their sailing preferences
3. Help them fill in any missing profile fields through natural conversation
4. Present a profile summary for the user to approve before saving
5. Show profile completion progress

**Available profile tools:**
- \`get_profile_completion_status\` - Check which fields are filled and missing
- \`update_user_profile\` - Save profile field updates (REQUIRES USER APPROVAL - see below)
- \`get_experience_level_definitions\` - Explain experience levels if needed
- \`get_risk_level_definitions\` - Explain risk levels if needed
- \`get_skills_definitions\` - Show available skills

**Profile fields to gather (in conversation order):**
1. **full_name** (required) - ${userProfile?.fullName ? `Already known: "${userProfile.fullName}". Use this value directly, do NOT ask again.` : 'Ask for their full name if not already known'}
2. **user_description** (required) - A short bio about their sailing background, experience, and who they are as a sailor. This is what boat owners will read first. Guide them to write 2-3 sentences.
3. **sailing_preferences** (required) - What they're looking for: types of sailing (coastal cruising, offshore passages, racing), preferred regions, time of year, trip duration preferences, what makes a trip appealing to them.
4. **sailing_experience** (required) - 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper
5. **risk_level** (required) - Array of comfort zones: "Coastal sailing", "Offshore sailing", "Extreme sailing"
6. **skills** (optional) - Array of sailing skills. Ask about these but make it clear this is optional and can be filled in later on their profile page.
7. **certifications** (optional) - Free text for sailing certifications (RYA, ASA, etc.)
8. **phone** (optional) - ${userProfile?.phone ? `Already known: "${userProfile.phone}". Include in the profile save, do NOT ask again.` : 'Phone number. Only ask if not already provided.'}
9. **profile_image_url** (auto) - ${userProfile?.avatarUrl ? `Already set from OAuth provider. Include "${userProfile.avatarUrl}" in the profile save automatically, do NOT ask about it.` : 'Profile photo URL. Skip this field - user can set it later on their profile page.'}

**CRITICAL: APPROVAL REQUIRED FOR PROFILE UPDATES**
- Do NOT call \`update_user_profile\` immediately after gathering information
- Instead, FIRST present a clear summary of ALL the profile data you plan to save
- Format the summary as a readable list showing each field and its value
- Ask the user to review and confirm: "Does this look correct? I'll save it once you confirm."
- ONLY call \`update_user_profile\` AFTER the user explicitly confirms/approves
- If the user wants to change something, update the values and present the summary again

**Workflow:**
1. First, call \`get_profile_completion_status\` to see current state
2. Greet the user and summarize what you already know from the conversation
3. Ask about missing required fields one or two at a time (don't overwhelm)
4. For \`user_description\`: Help them craft a good bio. Suggest something based on what you know and ask if they'd like to adjust it.
5. For \`sailing_preferences\`: Ask what they're looking for in sailing opportunities - regions, trip types, duration, time of year.
6. For \`skills\`: Mention you can add skills but reassure them it's optional and can be done later.
7. Once you have enough info, present a COMPLETE SUMMARY of the proposed profile data
8. Wait for explicit user approval before calling \`update_user_profile\`
9. After saving, remind user they can continue to the full profile page for more detailed editing

**Important notes on pre-filled data:**
- When including known data (name, email, phone, avatar) in the profile save, mention them in the summary so the user sees them but make clear these came from their signup.
- Do NOT ask questions about data you already have. Focus conversation on the fields you still need.

**Example summary format:**
"Here's your profile summary for review:

• **Name:** John Smith
• **Bio:** Experienced coastal sailor with 5 years on the water. Comfortable in Mediterranean conditions and eager to gain offshore experience.
• **Sailing preferences:** Looking for Mediterranean coastal cruising and short offshore passages, preferably in summer months. Open to 1-2 week trips.
• **Experience level:** 3 - Coastal Skipper
• **Comfort zones:** Coastal sailing, Offshore sailing
• **Skills:** Navigation, Helming, Sail trimming (optional - can add more later)
• **Certifications:** RYA Day Skipper
• **Phone:** +358 40 123 4567 (from signup)

Does this look correct? I'll save your profile once you confirm."`;
  }

  const toolInstructions = buildToolInstructions();
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

  // Tools that require user approval before execution (action tools)
  const APPROVAL_REQUIRED_TOOLS = ['update_user_profile'];

  // Process with tool loop
  let allToolCalls: ToolCall[] = [];
  let allLegRefs: ProspectLegReference[] = [];
  let pendingAction: { toolName: string; arguments: Record<string, unknown> } | undefined;
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

    // Separate approval-required tool calls from auto-executable ones
    const autoExecuteTools: ToolCall[] = [];
    for (const tc of toolCalls) {
      if (isProfileCompletionMode && APPROVAL_REQUIRED_TOOLS.includes(tc.name)) {
        // Hold this tool call as pending - requires user approval
        log(`⏸️ Holding ${tc.name} as pending action (requires user approval)`);
        pendingAction = {
          toolName: tc.name,
          arguments: tc.arguments as Record<string, unknown>,
        };
      } else {
        autoExecuteTools.push(tc);
      }
    }

    // If we have a pending action and content, break the loop - show content + pending action to user
    if (pendingAction && content.trim()) {
      finalContent = content;
      allToolCalls.push(...autoExecuteTools);
      // Execute any remaining auto-execute tools (e.g. get_profile_completion_status)
      if (autoExecuteTools.length > 0) {
        await executeProspectTools(supabase, autoExecuteTools, authenticatedUserId);
      }
      log('✅ Content ready with pending action for user approval');
      break;
    }

    // If only a pending action and no content, tell the AI to present a summary
    if (pendingAction && !content.trim()) {
      currentMessages.push(
        { role: 'assistant', content: result.text },
        { role: 'user', content: 'SYSTEM: Present the profile data summary to the user for review before saving. Do NOT call update_user_profile yet. Show a clear summary and ask the user to confirm.' }
      );
      pendingAction = undefined; // Reset - let the AI present summary first
      continue;
    }

    // Execute auto-executable tools
    allToolCalls.push(...autoExecuteTools);
    const toolResults = await executeProspectTools(supabase, autoExecuteTools.length > 0 ? autoExecuteTools : toolCalls, authenticatedUserId);

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
      pendingAction: pendingAction ? {
        toolName: pendingAction.toolName,
        arguments: pendingAction.arguments,
        label: 'Save Profile',
      } : undefined,
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
  log('⏸️ Pending action:', pendingAction ? `${pendingAction.toolName}` : 'none');
  log('');

  return {
    sessionId,
    message: responseMessage,
    extractedPreferences: undefined,
  };
}
