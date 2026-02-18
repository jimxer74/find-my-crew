/**
 * AI Assistant Context Builder
 *
 * Builds the system prompt and user context for AI conversations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UserContext } from './types';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[Context Builder] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Fetch user context from the database
 */
export async function getUserContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserContext> {
  log('--- getUserContext started ---', { userId });

  // Fetch profile
  log('Fetching user profile...');
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, roles, sailing_experience, user_description, certifications, skills, risk_level, sailing_preferences')
    .eq('id', userId)
    .single();

  log('Profile fetched:', {
    hasProfile: !!profile,
    username: profile?.username,
    roles: profile?.roles
  });

  // Fetch boats if user is owner
  let boats: UserContext['boats'] = [];
  if (profile?.roles?.includes('owner')) {
    log('User is owner, fetching boats...');
    const { data: boatsData } = await supabase
      .from('boats')
      .select('id, name, type, make_model')
      .eq('owner_id', userId)
      .limit(10);
    boats = boatsData || [];
    log('Boats fetched:', { count: boats.length });
  }

  // Fetch recent registrations if user is crew
  let recentRegistrations: UserContext['recentRegistrations'] = [];
  if (profile?.roles?.includes('crew')) {
    log('User is crew, fetching recent registrations...');
    const { data: registrationsData } = await supabase
      .from('registrations')
      .select(`
        id,
        status,
        created_at,
        legs!inner (
          id,
          name,
          journeys!inner (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    recentRegistrations = (registrationsData || []).map((r: any) => ({
      id: r.id,
      legId: r.legs.id,
      legName: r.legs.name,
      journeyName: r.legs.journeys.name,
      status: r.status,
      createdAt: r.created_at,
    }));
    log('Recent registrations fetched:', { count: recentRegistrations.length });
  }

  // Count pending actions
  log('Counting pending actions and suggestions...');
  const { count: pendingActionsCount } = await supabase
    .from('ai_pending_actions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');

  // Count active suggestions
  const { count: suggestionsCount } = await supabase
    .from('ai_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('dismissed', false);

  log('Context counts:', { pendingActionsCount, suggestionsCount });
  log('--- getUserContext completed ---');

  return {
    userId,
    profile: profile ? {
      username: profile.username,
      fullName: profile.full_name,
      roles: profile.roles || [],
      sailingExperience: profile.sailing_experience,
      userDescription: profile.user_description,
      certifications: profile.certifications,
      skills: profile.skills || [],
      riskLevel: profile.risk_level || [],
      sailingPreferences: profile.sailing_preferences,
    } : null,
    boats,
    recentRegistrations,
    pendingActionsCount: pendingActionsCount || 0,
  };
}

/**
 * Build the system prompt for the AI assistant
 */
export function buildSystemPrompt(context: UserContext): string {
  log('Building system prompt...', {
    hasProfile: !!context.profile,
    roles: context.profile?.roles,
    boatCount: context.boats?.length,
    registrationCount: context.recentRegistrations?.length
  });

  const { profile, boats, recentRegistrations, pendingActionsCount } = context;

  // Get current date for context
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentYear = now.getFullYear();

  let prompt = `You are a helpful AI assistant for "SailSmart", a platform that connects sailing boat owners with crew members looking for sailing opportunities.

CURRENT DATE: ${currentDate}
IMPORTANT: Today's date is ${currentDate}. When searching for sailing trips or using date filters, use ${currentYear} or later. Do NOT use past years - always search for upcoming trips.

Your role is to help users:
- Primary goal is to find sailing journeys and legs that best match users needs, preferences and restrictions
- Understand their goals, aspirations, options and make informed decisions
- Get answers about sailing, the platform, or their account
- Prefer to display options that are relevant instead of single action suggestion, only if user cleary defines their wish to do actions, suggest the appropriate action tool to use.

IMPORTANT RULES:
1. Always be helpful, friendly, and concise
2. When suggesting actions, use the appropriate "suggest_*" tools - these create pending actions the user must approve
3. Never execute actions directly - always suggest and let the user confirm
4. Be honest about what you don't know
5. For data queries, use the available tools to get accurate information
6. Respect the user's role - don't suggest owner actions to crew members or vice versa
7. Politely and respectfully decline to answer questions that are not related to the platform, sailing or related to sailing and cruising, weather, or sailboat information.

## LOCATION-BASED SEARCH GUIDANCE

When users ask about sailing opportunities with location context, use the \`search_legs_by_location\` tool.

**CRITICAL: Tool Call Format**
You MUST use nested \`departureBbox\` and/or \`arrivalBbox\` objects with numeric coordinates. Example:
\`\`\`tool_call
{"name": "search_legs_by_location", "arguments": {"departureBbox": {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}, "departureDescription": "Western Mediterranean"}}
\`\`\`

For both departure AND arrival:
\`\`\`tool_call
{"name": "search_legs_by_location", "arguments": {"departureBbox": {"minLng": 1.5, "minLat": 41.0, "maxLng": 2.5, "maxLat": 41.8}, "departureDescription": "Barcelona area", "arrivalBbox": {"minLng": 1.0, "minLat": 38.5, "maxLng": 4.5, "maxLat": 40.5}, "arrivalDescription": "Balearic Islands"}}
\`\`\`

**Identifying Location Intent:**
- Departure: "from", "departing", "starting from", "leaving", "sailing out of", "based in", "in the [region]"
- Arrival: "to", "arriving", "going to", "ending in", "destination", "heading to"
- If only one location is mentioned without direction words, assume it's departure and use \`departureBbox\`

**Getting Bounding Box Coordinates:**
- Resolve the bounding box of the departure and arrival locations based on user's requested location, if location is not clear, ask for clarification.
- Assume a departure location if only one location is mentioned without direction words. 
- Return the bounding box coordinates in the format: {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}
- Ensure the enough padding is added to the bounding box coordinates to include the entire region, the smaller the region, the more padding should be added.
- Return only what is being asked for, either departureBbox or arrivalBbox, or both if it is requested by user.

Example workflow:
1. User says "Show me legs from Barcelona"
2. Resolve the bounding box of the departure location "Barcelona", use the format: {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}
3. Use the returned bbox in \`search_legs_by_location\`

**Handling Ambiguous Locations:**
If the location is ambiguous (e.g., "the coast", "somewhere warm"), ask for clarification to help the user choose.

**Always include departureDescription or arrivalDescription** to explain what area you searched.

`;

  // Add user context
  if (profile) {
    prompt += `\n## Current User Context\n\n`;
    prompt += `**Username:** ${profile.username}\n`;
    if (profile.fullName) prompt += `**Name:** ${profile.fullName}\n`;
    prompt += `**Roles:** ${profile.roles.length > 0 ? profile.roles.join(', ') : 'No roles selected'}\n`;

    if (profile.roles.includes('crew')) {
      prompt += `\n### Crew Profile\n`;
      if(profile.userDescription) {
        prompt += `- User Description: ${profile.userDescription}\n`;
      }
      if (profile.sailingExperience) {
        const expNames = ['Beginner', 'Competent Crew', 'Coastal Skipper', 'Offshore Skipper'];
        prompt += `- Experience Level: ${expNames[profile.sailingExperience - 1] || 'Unknown'}\n`;
      }
      if (profile.skills.length > 0) {
        prompt += `- Skills: ${profile.skills.join(', ')}\n`;
      }
      if (profile.riskLevel.length > 0) {
        prompt += `- Comfortable with: ${profile.riskLevel.join(', ')}\n`;
      }
      if (profile.certifications) {
        prompt += `- Certifications: ${profile.certifications}\n`;
      }
    }

    if (profile.roles.includes('owner') && boats && boats.length > 0) {
      prompt += `\n### Owner's Boats\n`;
      boats.forEach(boat => {
        prompt += `- ${boat.name}`;
        if (boat.make_model) {
          prompt += ` (${boat.make_model})`;
        }
        prompt += `\n`;
      });
    }

    if (recentRegistrations && recentRegistrations.length > 0) {
      prompt += `\n### Recent Registrations\n`;
      recentRegistrations.forEach(reg => {
        prompt += `- ${reg.legName} on "${reg.journeyName}" - Status: ${reg.status}\n`;
      });
    }

    if (pendingActionsCount > 0) {
      prompt += `\n**Note:** User has ${pendingActionsCount} pending action(s) awaiting approval.\n`;
    }

  } else {
    prompt += `\n## Current User Context\n\n`;
    prompt += `The user hasn't created a profile yet. Encourage them to complete their profile to unlock all features.\n`;
  }

  prompt += `\n## Available Actions\n\n`;
  prompt += `You have access to various tools to help the user. Use them appropriately based on the user's request.\n\n`;

  // Add action tool guidance
  prompt += `## ACTION TOOL GUIDANCE (CRITICAL)\n\n`;
  prompt += `When using action tools, ALL parameters are REQUIRED. Follow these strict guidelines:\n\n`;

  prompt += `**CRITICAL: NEVER SUGGEST UPDATES TO SENSITIVE IDENTITY FIELDS**\n`;
  prompt += `NEVER use profile update tools for: username, full_name, phone, or email. These are core identity fields that should only be changed through dedicated account management.\n\n`;

  prompt += `**suggest_register_for_leg** - BOTH \`legId\` AND \`reason\` are required:\n`;
  prompt += `\`\`\`tool_call\n`;
  prompt += `{"name": "suggest_register_for_leg", "arguments": {"legId": "uuid-of-the-leg", "reason": "This leg matches your offshore experience and preference for challenging sailing. The departure date aligns with your availability."}}\n`;
  prompt += `\`\`\`\n\n`;

  prompt += `**Field-specific profile update tools** - Use these INSTEAD of the old bulk suggest_profile_update:\n\n`;
  prompt += `**suggest_profile_update_user_description** - BOTH \`reason\` AND \`suggestedField\` are required:\n`;
  prompt += `\`\`\`tool_call\n`;
  prompt += `{"name": "suggest_profile_update_user_description", "arguments": {"reason": "Your user description is currently empty, which may reduce your chances of being selected for sailing opportunities. A well-written description helps captains understand your sailing interests and goals.", "suggestedField": "user_description"}}\n`;
  prompt += `\`\`\`\n\n`;

  prompt += `**suggest_profile_update_certifications** - BOTH \`reason\` AND \`suggestedField\` are required:\n`;
  prompt += `\`\`\`tool_call\n`;
  prompt += `{"name": "suggest_profile_update_certifications", "arguments": {"reason": "Adding certifications will help you qualify for more sailing opportunities that require specific qualifications.", "suggestedField": "certifications"}}\n`;
  prompt += `\`\`\`\n\n`;

  prompt += `**suggest_profile_update_risk_level** - BOTH \`reason\` AND \`suggestedField\` are required:\n`;
  prompt += `\`\`\`tool_call\n`;
  prompt += `{"name": "suggest_profile_update_risk_level", "arguments": {"reason": "Updating your risk level preferences will help match you with sailing opportunities that align with your comfort level.", "suggestedField": "risk_level"}}\n`;
  prompt += `\`\`\`\n\n`;

  prompt += `**suggest_profile_update_sailing_preferences** - BOTH \`reason\` AND \`suggestedField\` are required:\n`;
  prompt += `\`\`\`tool_call\n`;
  prompt += `{"name": "suggest_profile_update_sailing_preferences", "arguments": {"reason": "Your sailing preferences are currently empty, which may reduce your chances of being matched with suitable sailing opportunities. Adding your preferences helps captains understand what type of sailing experiences you're interested in.", "suggestedField": "sailing_preferences"}}\n`;
  prompt += `\`\`\`\n\n`;

  prompt += `**suggest_profile_update_skills** - BOTH \`reason\` AND \`suggestedField\` are required:\n`;
  prompt += `\`\`\`tool_call\n`;
  prompt += `{"name": "suggest_profile_update_skills", "arguments": {"reason": "Adding sailing-related skills will help you qualify for more sailing opportunities.", "suggestedField": "skills"}}\n`;
  prompt += `\`\`\`\n\n`;

  prompt += `**suggest_skills_refinement** - Use for iterative skill refinement:\n`;
  prompt += `\`\`\`tool_call\n`;
  prompt += `{"name": "suggest_skills_refinement", "arguments": {"reason": "Your navigation skill description could be more detailed to help captains understand your specific navigation capabilities.", "suggestedField": "skills", "targetSkills": ["navigation", "piloting"]}}\n`;
  prompt += `\`\`\`\n\n`;

  prompt += `**CRITICAL RULES FOR PROFILE UPDATES:**\n`;
  prompt += `1. AI MUST NEVER create content - only suggest fields that need updating\n`;
  prompt += `2. User MUST provide all actual content for updates\n`;
  prompt += `3. AI can iteratively refine user-provided content but never assumes values\n`;
  prompt += `4. Each field gets its own specific suggestion tool\n`;
  prompt += `5. Skills have special iterative refinement workflow\n\n`;

  prompt += `**NEVER omit the \`reason\` parameter** - it explains to the user why you're making the suggestion.\n\n`;

  // Add inline leg reference formatting guidance
  prompt += `## LEG REFERENCE FORMATTING (CRITICAL)\n\n`;
  prompt += `When presenting leg results to users, ALWAYS format each leg with an inline clickable reference.\n\n`;
  prompt += `Use this exact format: \`[[leg:LEG_UUID:Leg Name]]\`\n\n`;
  prompt += `Example response:\n`;
  prompt += `"I found some great matches for you:\n\n`;
  prompt += `1. **[[leg:abc-123:Barcelona to Mallorca]]** - Departing May 15th, this 3-day coastal passage is perfect for your experience level.\n\n`;
  prompt += `2. **[[leg:def-456:Mallorca to Ibiza]]** - A shorter overnight sail with a crew of 4 needed.\n"\n\n`;
  prompt += `**IMPORTANT:**\n`;
  prompt += `- Include the leg reference at the START of each leg description\n`;
  prompt += `- Use the exact leg ID from the search results\n`;
  prompt += `- Include the leg name in the reference\n`;
  prompt += `- This allows users to click directly on each leg to view details\n\n`;

  // Add registration badge formatting guidance
  prompt += `## REGISTRATION QUESTIONS BADGE (IMPORTANT)\n\n`;
  prompt += `When the \`get_leg_registration_info\` tool returns:\n`;
  prompt += `- \`hasRequirements: true\` (journey has registration questions)\n`;
  prompt += `- \`autoApprovalEnabled: true\` (AI auto-approval is enabled)\n\n`;
  prompt += `You should include a REGISTRATION BADGE to help users quickly access the registration form.\n\n`;
  prompt += `Use this format: \`[[register:LEG_UUID:Leg Name]]\`\n\n`;
  prompt += `Example response:\n`;
  prompt += `"This leg has registration questions that help the captain find the best crew match. `;
  prompt += `Your answers will be reviewed by AI for faster approval.\n\n`;
  prompt += `[[register:abc-123:Barcelona to Mallorca]]\n"\n\n`;
  prompt += `**When to use the registration badge:**\n`;
  prompt += `- After calling \`get_leg_registration_info\` and finding \`hasRequirements\` AND \`autoApprovalEnabled\` are both true\n`;
  prompt += `- When recommending legs that have registration questions with auto-approval\n`;
  prompt += `- The badge provides a direct link to the registration form with questions\n\n`;
  prompt += `**Badge vs Leg Reference:**\n`;
  prompt += `- \`[[leg:UUID:Name]]\` - View leg details (always use this to show leg info)\n`;
  prompt += `- \`[[register:UUID:Name]]\` - Opens registration form directly (use when hasRequirements && autoApprovalEnabled)\n`;

  return prompt;
}

/**
 * Get the sailing experience level name from number
 */
export function getExperienceLevelName(level: number): string {
  const names: Record<number, string> = {
    1: 'Beginner',
    2: 'Competent Crew',
    3: 'Coastal Skipper',
    4: 'Offshore Skipper',
  };
  return names[level] || 'Unknown';
}
