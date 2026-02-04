/**
 * AI Assistant Tool Definitions
 *
 * These tools define what the AI assistant can do.
 * Tools are categorized into:
 * - Data retrieval tools (read-only)
 * - Action suggestion tools (require user approval)
 */

import { ToolDefinition } from './types';

// Data retrieval tools - these execute immediately and return data
export const DATA_TOOLS: ToolDefinition[] = [
  {
    name: 'search_journeys',
    description: 'Search for published sailing journeys or voyages. Use this when user wants to find long sailing journeys that span multiple legs, typically taking several weeks or months to complete.',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Filter journeys starting after this date (ISO format YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          description: 'Filter journeys ending before this date (ISO format YYYY-MM-DD)',
        },
        riskLevel: {
          type: 'string',
          description: 'Filter by risk level',
          enum: ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
    },
  },
  {
    name: 'search_legs',
    description: 'Search for sailing opportunities or sailing legs or passages. Use this for general searches without specific location requirements. For location-based searches (e.g., "from Barcelona", "to Caribbean"), use search_legs_by_location instead.',
    parameters: {
      type: 'object',
      properties: {
        journeyId: {
          type: 'string',
          description: 'Filter legs by journey ID',
        },
        startDate: {
          type: 'string',
          description: 'Filter legs starting after this date (ISO format)',
        },
        endDate: {
          type: 'string',
          description: 'Filter legs ending before this date (ISO format)',
        },
        skillsRequired: {
          type: 'string',
          description: 'Comma-separated list of required skills to filter by',
        },
        crewNeeded: {
          type: 'boolean',
          description: 'Only show legs that still need crew (default true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
    },
  },
  {
    name: 'search_legs_by_location',
    description: 'Search for sailing legs by geographic location using bounding box coordinates. Use this when user mentions specific places, regions, or areas for departure or arrival. YOU must determine the appropriate bounding box coordinates for the location. IMPORTANT: Use nested departureBbox/arrivalBbox objects with numeric coordinates. Example: {"departureBbox": {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}, "departureDescription": "Western Mediterranean"}',
    parameters: {
      type: 'object',
      properties: {
        departureBbox: {
          type: 'object',
          description: 'Bounding box for departure/start area. Provide coordinates that encompass the region the user is referring to. Add reasonable margins (~50-100km for cities, larger for regions).',
          properties: {
            minLng: { type: 'number', description: 'Western boundary (longitude)' },
            minLat: { type: 'number', description: 'Southern boundary (latitude)' },
            maxLng: { type: 'number', description: 'Eastern boundary (longitude)' },
            maxLat: { type: 'number', description: 'Northern boundary (latitude)' },
          },
          required: ['minLng', 'minLat', 'maxLng', 'maxLat'],
        },
        departureDescription: {
          type: 'string',
          description: 'Human-readable description of the departure area being searched (e.g., "Barcelona and surrounding area", "Southern coast of Spain from Málaga to Almería")',
        },
        arrivalBbox: {
          type: 'object',
          description: 'Bounding box for arrival/destination area. Provide coordinates that encompass the region the user is referring to.',
          properties: {
            minLng: { type: 'number', description: 'Western boundary (longitude)' },
            minLat: { type: 'number', description: 'Southern boundary (latitude)' },
            maxLng: { type: 'number', description: 'Eastern boundary (longitude)' },
            maxLat: { type: 'number', description: 'Northern boundary (latitude)' },
          },
          required: ['minLng', 'minLat', 'maxLng', 'maxLat'],
        },
        arrivalDescription: {
          type: 'string',
          description: 'Human-readable description of the arrival area being searched (e.g., "Canary Islands", "Western Caribbean including Jamaica and Cayman Islands")',
        },
        startDate: {
          type: 'string',
          description: 'Filter legs starting after this date (ISO format YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          description: 'Filter legs ending before this date (ISO format YYYY-MM-DD)',
        },
        skillsRequired: {
          type: 'string',
          description: 'Comma-separated list of required skills to filter by',
        },
        riskLevels: {
          type: 'string',
          description: 'Comma-separated risk levels to filter by (Coastal sailing, Offshore sailing, Extreme sailing)',
        },
        minExperienceLevel: {
          type: 'number',
          description: 'User experience level for matching: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper. Only returns legs where user qualifies.',
        },
        crewNeeded: {
          type: 'boolean',
          description: 'Only show legs that still need crew (default true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
    },
  },
  {
    name: 'get_leg_details',
    description: 'Get detailed information about a specific leg including waypoints, requirements, and current registrations.',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to get details for',
        },
      },
      required: ['legId'],
    },
  },
  {
    name: 'get_journey_details',
    description: 'Get detailed information about a journey including all its legs and the boat.',
    parameters: {
      type: 'object',
      properties: {
        journeyId: {
          type: 'string',
          description: 'The ID of the journey to get details for',
        },
      },
      required: ['journeyId'],
    },
  },
  {
    name: 'get_user_profile',
    description: 'Get the current user\'s profile information including skills, experience, and preferences.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_user_registrations',
    description: 'Get the current user\'s registration history for sailing legs.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by registration status',
          enum: ['Pending approval', 'Approved', 'Not approved', 'Cancelled'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
    },
  },
  {
    name: 'get_boat_details',
    description: 'Get detailed information about a specific boat.',
    parameters: {
      type: 'object',
      properties: {
        boatId: {
          type: 'string',
          description: 'The ID of the boat to get details for',
        },
      },
      required: ['boatId'],
    },
  },
  {
    name: 'analyze_leg_match',
    description: 'Analyze how well the current user\'s profile matches a specific leg\'s requirements. Returns match percentage and explanation.',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to analyze match for',
        },
      },
      required: ['legId'],
    },
  },
  // Owner-specific tools
  {
    name: 'get_owner_boats',
    description: 'Get all boats owned by the current user. Only available for users with owner role.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_owner_journeys',
    description: 'Get all journeys for boats owned by the current user. Only available for users with owner role.',
    parameters: {
      type: 'object',
      properties: {
        boatId: {
          type: 'string',
          description: 'Filter journeys by boat ID',
        },
        state: {
          type: 'string',
          description: 'Filter by journey state',
          enum: ['In planning', 'Published', 'Archived'],
        },
      },
    },
  },
  {
    name: 'get_leg_registrations',
    description: 'Get all registrations for a specific leg. Only available for the journey owner.',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to get registrations for',
        },
      },
      required: ['legId'],
    },
  },
  {
    name: 'analyze_crew_match',
    description: 'Analyze how well a crew member matches the requirements for a leg. Only available for journey owners.',
    parameters: {
      type: 'object',
      properties: {
        registrationId: {
          type: 'string',
          description: 'The ID of the registration to analyze',
        },
      },
      required: ['registrationId'],
    },
  },
  /*
  // Location lookup tool
  {
    name: 'get_location_bounding_box',
    description: 'Look up the bounding box coordinates for a named sailing region. Use this tool if you are not able to resolve the bounding box coordinates for a location by yourself. Returns coordinates for well-known sailing destinations (Mediterranean regions, Caribbean islands, Atlantic waypoints, etc.). Example: {"query": "Barcelona"} returns the bbox for Barcelona area.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The location name to look up (e.g., "Barcelona", "Canary Islands", "BVI", "Mediterranean")',
        },
        listCategory: {
          type: 'string',
          description: 'Optional: Instead of searching, list all regions in a category. Valid values: mediterranean, atlantic, caribbean, northern_europe, pacific',
          enum: ['mediterranean', 'atlantic', 'caribbean', 'northern_europe', 'pacific'],
        },
      },
    },
  },*/
  // Registration info tool
  {
    name: 'get_leg_registration_info',
    description: 'Get registration requirements and auto-approval settings for a leg. Call this BEFORE suggesting registration to check if the user needs to complete a form with questions. If hasRequirements is true, direct user to the leg details page to register instead of using suggest_register_for_leg.',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to check registration info for',
        },
      },
      required: ['legId'],
    },
  },
];

// Action suggestion tools - these create pending actions that require user approval
export const ACTION_TOOLS: ToolDefinition[] = [
  /*
  {
    name: 'suggest_register_for_leg',
    description: 'Suggest that the user register for a specific sailing leg. Creates a pending action that the user must approve. IMPORTANT: Before calling this, use get_leg_registration_info to check if the leg has registration requirements. If hasRequirements is true, do NOT use this tool - instead direct the user to complete registration via the leg details page in the UI. Only use this tool for legs WITHOUT requirements. Both legId and reason parameters are REQUIRED. Example: {"name": "suggest_register_for_leg", "arguments": {"legId": "uuid-here", "reason": "This leg matches your experience level and sailing preferences"}}',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'REQUIRED: The UUID of the leg to register for',
        },
        reason: {
          type: 'string',
          description: 'REQUIRED: A detailed explanation of why this leg is a good match for the user (e.g., experience match, location preference, timing)',
        },
      },
      required: ['legId', 'reason'],
    },
  },*/
  {
    name: 'suggest_profile_update_user_description',
    description: 'Suggest updating the user description field in the user\'s profile. Creates a pending action that the user must approve. AI should identify that user description could be improved but must NOT create content - only suggest the field and ask user for the new description. IMPORTANT: Both reason and suggestedField parameters are REQUIRED. Example: {"name": "suggest_profile_update_user_description", "arguments": {"reason": "Your user description is currently empty, which may reduce your chances of being selected for sailing opportunities. A well-written description helps captains understand your sailing interests and goals.", "suggestedField": "user_description"}}',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'REQUIRED: Explanation of why the user description should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "user_description". This field is fixed for this tool.',
          enum: ['user_description'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  {
    name: 'suggest_profile_update_certifications',
    description: 'Suggest updating the certifications field in the user\'s profile. Creates a pending action that the user must approve. AI should identify that certifications could be improved but must NOT create content - only suggest the field and ask user for the new description. IMPORTANT: Both reason and suggestedField parameters are REQUIRED. Example: {"name": "suggest_profile_update_certifications", "arguments": {"reason": "Adding certifications will help you qualify for more sailing opportunities that require specific qualifications.", "suggestedField": "certifications"}}',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'REQUIRED: Explanation of why the certifications field should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "certifications". This field is fixed for this tool.',
          enum: ['certifications'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  {
    name: 'suggest_profile_update_risk_level',
    description: 'Suggest updating the risk level field in the user\'s profile. Creates a pending action that the user must approve. AI should identify that risk level could be improved but must NOT create content - only suggest the field and ask user for the new description. IMPORTANT: Both reason and suggestedField parameters are REQUIRED. Example: {"name": "suggest_profile_update_risk_level", "arguments": {"reason": "Updating your risk level preferences will help match you with sailing opportunities that align with your comfort level.", "suggestedField": "risk_level"}}',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'REQUIRED: Explanation of why the risk level field should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "risk_level". This field is fixed for this tool.',
          enum: ['risk_level'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  {
    name: 'suggest_profile_update_sailing_preferences',
    description: 'Suggest updating the sailing preferences field in the user\'s profile. Creates a pending action that the user must approve. AI should identify that sailing preferences could be improved but must NOT create content - only suggest the field and ask user for the new description. IMPORTANT: Both reason and suggestedField parameters are REQUIRED. Example: {"name": "suggest_profile_update_sailing_preferences", "arguments": {"reason": "Your sailing preferences are currently empty, which may reduce your chances of being matched with suitable sailing opportunities. Adding your preferences helps captains understand what type of sailing experiences you\'re interested in.", "suggestedField": "sailing_preferences"}}',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'REQUIRED: Explanation of why the sailing preferences field should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "sailing_preferences". This field is fixed for this tool.',
          enum: ['sailing_preferences'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  
  {
    name: 'suggest_profile_update_skills',
    description: 'Suggest updating the skills field in the user\'s profile. Creates a pending action that the user must approve. AI should identify specific skills that could be added but must NOT create content - only suggest the field and ask user for the new skills. This tool is for iterative refinement of skills. IMPORTANT: Both reason and suggestedField parameters are REQUIRED. Example: {"name": "suggest_profile_update_skills", "arguments": {"reason": "Adding sailing-related skills will help you qualify for more sailing opportunities.", "suggestedField": "skills"}}',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'REQUIRED: Explanation of why the skills field should be updated and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "skills". This field is fixed for this tool.',
          enum: ['skills'],
        },
      },
      required: ['reason', 'suggestedField'],
    },
  },
  {
    name: 'suggest_skills_refinement',
    description: 'Suggest iterative refinement for specific skills in the user\'s profile. Creates a pending action that the user must approve. AI should identify specific skills that could be improved and suggest asking the user for better descriptions. This tool enables iterative refinement where AI suggests improvements to existing skills. IMPORTANT: Both reason, suggestedField, and targetSkills parameters are REQUIRED. After approval, the user will provide descriptions for the specified skills, which will then be used to update the profile. Example: {"name": "suggest_skills_refinement", "arguments": {"reason": "Your navigation skill description could be more detailed to help captains understand your specific navigation capabilities.", "suggestedField": "skills", "targetSkills": ["navigation", "piloting"]}}',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'REQUIRED: Explanation of why these specific skills should be refined and how it will benefit the user',
        },
        suggestedField: {
          type: 'string',
          description: 'REQUIRED: Must be "skills". This field is fixed for this tool.',
          enum: ['skills'],
        },
        targetSkills: {
          type: 'array',
          description: 'REQUIRED: Array of specific skill names that should be refined',
          items: {
            type: 'string',
            description: 'Name of a specific skill to refine',
          },
        },
      },
      required: ['reason', 'suggestedField', 'targetSkills'],
    },
  },
  {
    name: 'suggest_approve_registration',
    description: 'Suggest approving a crew registration. Only available for journey owners. Creates a pending action. IMPORTANT: Both registrationId and reason parameters are REQUIRED.',
    parameters: {
      type: 'object',
      properties: {
        registrationId: {
          type: 'string',
          description: 'REQUIRED: The UUID of the registration to approve',
        },
        reason: {
          type: 'string',
          description: 'REQUIRED: Detailed explanation of why this crew member should be approved (e.g., skills match, experience level)',
        },
      },
      required: ['registrationId', 'reason'],
    },
  },
  {
    name: 'suggest_reject_registration',
    description: 'Suggest rejecting a crew registration. Only available for journey owners. Creates a pending action. IMPORTANT: Both registrationId and reason parameters are REQUIRED.',
    parameters: {
      type: 'object',
      properties: {
        registrationId: {
          type: 'string',
          description: 'REQUIRED: The UUID of the registration to reject',
        },
        reason: {
          type: 'string',
          description: 'REQUIRED: Explanation of why this crew member should be rejected (be constructive and professional)',
        },
      },
      required: ['registrationId', 'reason'],
    },
  },
];

// All tools combined
export const ALL_TOOLS: ToolDefinition[] = [...DATA_TOOLS, ...ACTION_TOOLS];

// Tool names that require owner role
export const OWNER_ONLY_TOOLS = [
  'get_owner_boats',
  'get_owner_journeys',
  'get_leg_registrations',
  'analyze_crew_match',
  'suggest_approve_registration',
  'suggest_reject_registration',
];

// Tool names that require crew role
export const CREW_ONLY_TOOLS = [
  'suggest_register_for_leg',
];

// Tool names that create pending actions
export const ACTION_TOOL_NAMES = ACTION_TOOLS.map(t => t.name);

/**
 * Get tools available for a user based on their roles
 */
export function getToolsForUser(roles: string[]): ToolDefinition[] {
  const isOwner = roles.includes('owner');
  const isCrew = roles.includes('crew');

  return ALL_TOOLS.filter(tool => {
    // Check owner-only tools
    if (OWNER_ONLY_TOOLS.includes(tool.name) && !isOwner) {
      return false;
    }
    // Check crew-only tools
    if (CREW_ONLY_TOOLS.includes(tool.name) && !isCrew) {
      return false;
    }
    return true;
  });
}

/**
 * Check if a tool creates a pending action
 */
export function isActionTool(toolName: string): boolean {
  return ACTION_TOOL_NAMES.includes(toolName);
}

/**
 * Convert tools to the format expected by AI providers (OpenAI-compatible)
 */
export function toolsToOpenAIFormat(tools: ToolDefinition[]) {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
