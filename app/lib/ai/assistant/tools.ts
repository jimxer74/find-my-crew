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
    description: 'Search for published sailing journeys. Use this when the user wants to find trips or journeys to join.',
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
    description: 'Search for sailing legs (segments of journeys) that need crew. Use this to find specific sailing opportunities.',
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
];

// Action suggestion tools - these create pending actions that require user approval
export const ACTION_TOOLS: ToolDefinition[] = [
  {
    name: 'suggest_register_for_leg',
    description: 'Suggest that the user register for a specific sailing leg. Creates a pending action that the user must approve.',
    parameters: {
      type: 'object',
      properties: {
        legId: {
          type: 'string',
          description: 'The ID of the leg to register for',
        },
        reason: {
          type: 'string',
          description: 'Explanation of why this leg is a good match for the user',
        },
      },
      required: ['legId', 'reason'],
    },
  },
  {
    name: 'suggest_profile_update',
    description: 'Suggest updates to the user\'s profile. Creates a pending action that the user must approve.',
    parameters: {
      type: 'object',
      properties: {
        updates: {
          type: 'string',
          description: 'JSON object with field names and new values to suggest',
        },
        reason: {
          type: 'string',
          description: 'Explanation of why these updates are recommended',
        },
      },
      required: ['updates', 'reason'],
    },
  },
  {
    name: 'suggest_approve_registration',
    description: 'Suggest approving a crew registration. Only available for journey owners. Creates a pending action.',
    parameters: {
      type: 'object',
      properties: {
        registrationId: {
          type: 'string',
          description: 'The ID of the registration to approve',
        },
        reason: {
          type: 'string',
          description: 'Explanation of why this crew member should be approved',
        },
      },
      required: ['registrationId', 'reason'],
    },
  },
  {
    name: 'suggest_reject_registration',
    description: 'Suggest rejecting a crew registration. Only available for journey owners. Creates a pending action.',
    parameters: {
      type: 'object',
      properties: {
        registrationId: {
          type: 'string',
          description: 'The ID of the registration to reject',
        },
        reason: {
          type: 'string',
          description: 'Explanation of why this crew member should be rejected',
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
