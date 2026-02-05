/**
 * Dynamic Tool Registry
 *
 * Manages use-case specific tool selection and prioritization.
 */

import { UseCaseIntent } from './use-case-classification';

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required: string[];
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  getToolsForUseCase(intent: UseCaseIntent, userRoles: string[]): ToolDefinition[];
}

/**
 * Use case specific tool registry implementation
 */
export class UseCaseToolRegistry implements ToolRegistry {
  private toolMappings: Map<UseCaseIntent, string[]> = new Map([
    [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, [
      'search_legs_by_location',
      'search_legs',
      'get_leg_details',
      'get_journey_details'
    ]],
    [UseCaseIntent.CREW_IMPROVE_PROFILE, [
      'suggest_profile_update_user_description',
      'suggest_profile_update_certifications',
      'suggest_profile_update_skills',
      'suggest_profile_update_risk_level',
      'suggest_profile_update_sailing_preferences'
    ]],
    [UseCaseIntent.CREW_REGISTER, [
      'suggest_register_for_leg',
      'get_leg_registration_info',
      'search_legs_by_location',
      'search_legs'
    ]],
    [UseCaseIntent.GENERAL_CONVERSATION, [
      'get_user_profile',
      'get_pending_actions',
      'get_suggestions'
    ]]
  ]);

  /**
   * Get tools for specific use case and user roles
   */
  getToolsForUseCase(intent: UseCaseIntent, userRoles: string[]): ToolDefinition[] {
    const toolNames = this.toolMappings.get(intent) || [];

    // Get all tools and filter by use case and user roles
    const allTools = this.getAllTools();
    return allTools.filter(tool => toolNames.includes(tool.name));
  }

  /**
   * Get all available tools (simplified for now)
   */
  private getAllTools(): ToolDefinition[] {
    return [
      {
        name: 'search_legs_by_location',
        description: 'Search for sailing legs by location using bounding box coordinates',
        parameters: {
          departureBbox: { type: 'object', properties: { minLng: { type: 'number' }, minLat: { type: 'number' }, maxLng: { type: 'number' }, maxLat: { type: 'number' } }, required: ['minLng', 'minLat', 'maxLng', 'maxLat'] },
          departureDescription: { type: 'string', description: 'Human-readable description of departure area' },
          arrivalBbox: { type: 'object', properties: { minLng: { type: 'number' }, minLat: { type: 'number' }, maxLng: { type: 'number' }, maxLat: { type: 'number' } }, required: ['minLng', 'minLat', 'maxLng', 'maxLat'] },
          arrivalDescription: { type: 'string', description: 'Human-readable description of arrival area' },
          startDate: { type: 'string', description: 'Start date for the sailing period (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date for the sailing period (YYYY-MM-DD)' },
          boatType: { type: 'string', description: 'Preferred boat type (e.g., "Offshore sailing", "Coastal cruising")' },
          makeModel: { type: 'string', description: 'Preferred boat make and model' },
          riskLevel: { type: 'string', description: 'Preferred risk level (e.g., "Coastal sailing", "Offshore sailing")' },
          experienceLevel: { type: 'string', description: 'Required experience level (e.g., "Beginner", "Offshore Skipper")' }
        },
        required: ['departureBbox', 'departureDescription']
      },
      {
        name: 'search_legs',
        description: 'Search for sailing legs with general criteria',
        parameters: {
          journeyName: { type: 'string', description: 'Name of the journey to search within' },
          legName: { type: 'string', description: 'Name of the specific leg' },
          boatType: { type: 'string', description: 'Boat type preference' },
          experienceLevel: { type: 'string', description: 'Required experience level' },
          riskLevel: { type: 'string', description: 'Risk level preference' },
          dateRange: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } }, description: 'Date range for sailing' }
        },
        required: []
      },
      {
        name: 'get_leg_details',
        description: 'Get detailed information about a specific sailing leg',
        parameters: {
          legId: { type: 'string', description: 'UUID of the leg to get details for' }
        },
        required: ['legId']
      },
      {
        name: 'get_journey_details',
        description: 'Get detailed information about a sailing journey',
        parameters: {
          journeyId: { type: 'string', description: 'UUID of the journey to get details for' }
        },
        required: ['journeyId']
      },
      {
        name: 'suggest_profile_update_user_description',
        description: 'Suggest updating the user description field in profile',
        parameters: {
          reason: { type: 'string', description: 'Reason for suggesting this update' },
          suggestedField: { type: 'string', description: 'Field name that needs updating (must be "user_description")' }
        },
        required: ['reason', 'suggestedField']
      },
      {
        name: 'suggest_profile_update_certifications',
        description: 'Suggest updating certifications in profile',
        parameters: {
          reason: { type: 'string', description: 'Reason for suggesting this update' },
          suggestedField: { type: 'string', description: 'Field name that needs updating (must be "certifications")' }
        },
        required: ['reason', 'suggestedField']
      },
      {
        name: 'suggest_profile_update_skills',
        description: 'Suggest updating skills in profile',
        parameters: {
          reason: { type: 'string', description: 'Reason for suggesting this update' },
          suggestedField: { type: 'string', description: 'Field name that needs updating (must be "skills")' }
        },
        required: ['reason', 'suggestedField']
      },
      {
        name: 'suggest_profile_update_risk_level',
        description: 'Suggest updating risk level preferences in profile',
        parameters: {
          reason: { type: 'string', description: 'Reason for suggesting this update' },
          suggestedField: { type: 'string', description: 'Field name that needs updating (must be "risk_level")' }
        },
        required: ['reason', 'suggestedField']
      },
      {
        name: 'suggest_profile_update_sailing_preferences',
        description: 'Suggest updating sailing preferences in profile',
        parameters: {
          reason: { type: 'string', description: 'Reason for suggesting this update' },
          suggestedField: { type: 'string', description: 'Field name that needs updating (must be "sailing_preferences")' }
        },
        required: ['reason', 'suggestedField']
      },
      {
        name: 'suggest_register_for_leg',
        description: 'Suggest registering for a specific sailing leg',
        parameters: {
          legId: { type: 'string', description: 'UUID of the leg to register for' },
          reason: { type: 'string', description: 'Reason for suggesting this registration' }
        },
        required: ['legId', 'reason']
      },
      {
        name: 'get_leg_registration_info',
        description: 'Get registration information for a specific leg',
        parameters: {
          legId: { type: 'string', description: 'UUID of the leg to get registration info for' }
        },
        required: ['legId']
      },
      {
        name: 'get_user_profile',
        description: 'Get the current user profile information',
        parameters: {},
        required: []
      },
      {
        name: 'get_pending_actions',
        description: 'Get pending actions for the user',
        parameters: {},
        required: []
      },
      {
        name: 'get_suggestions',
        description: 'Get suggestions for the user',
        parameters: {},
        required: []
      }
    ];
  }
}

/**
 * Tool prioritizer for ranking tools by relevance
 */
export class ToolPrioritizer {
  /**
   * Prioritize tools based on relevance to user message and context
   */
  prioritizeTools(tools: ToolDefinition[], context: {
    userMessage: string;
    intent: UseCaseIntent;
    userContext: any;
  }): ToolDefinition[] {
    // Score tools based on relevance
    const scoredTools = tools.map(tool => {
      let score = 0;

      // Base score based on use case priority
      score += this.getUseCasePriority(context.intent, tool.name);

      // Context-based scoring
      score += this.getContextRelevance(tool, context);

      // User message keyword matching
      score += this.getKeywordRelevance(tool, context.userMessage);

      return { tool, score };
    });

    // Sort by score descending
    return scoredTools
      .sort((a, b) => b.score - a.score)
      .map(item => item.tool);
  }

  /**
   * Get use case specific priority for tools
   */
  private getUseCasePriority(intent: UseCaseIntent, toolName: string): number {
    const priorities: Record<UseCaseIntent, Record<string, number>> = {
      [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS]: {
        'search_legs_by_location': 10,
        'search_legs': 8,
        'get_leg_details': 6,
        'get_journey_details': 4
      },
      [UseCaseIntent.CREW_IMPROVE_PROFILE]: {
        'suggest_profile_update_user_description': 10,
        'suggest_profile_update_certifications': 8,
        'suggest_profile_update_skills': 7,
        'suggest_profile_update_risk_level': 6,
        'suggest_profile_update_sailing_preferences': 5
      },
      [UseCaseIntent.CREW_REGISTER]: {
        'suggest_register_for_leg': 10,
        'get_leg_registration_info': 8,
        'search_legs_by_location': 6,
        'search_legs': 4
      },
      [UseCaseIntent.GENERAL_CONVERSATION]: {
        'get_user_profile': 5,
        'get_pending_actions': 4,
        'get_suggestions': 3
      },
      [UseCaseIntent.CLARIFICATION_REQUEST]: {}
    };

    return priorities[intent]?.[toolName] || 1;
  }

  /**
   * Get context-based relevance score
   */
  private getContextRelevance(tool: ToolDefinition, context: any): number {
    let score = 0;

    // Check if tool is relevant to user's current context
    if (context.userContext?.profile?.roles?.includes('crew')) {
      if (tool.name.includes('crew') || tool.name.includes('register')) {
        score += 2;
      }
    }

    if (context.userContext?.recentRegistrations?.length > 0) {
      if (tool.name.includes('register') || tool.name.includes('leg')) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Get keyword relevance from user message
   */
  private getKeywordRelevance(tool: ToolDefinition, userMessage: string): number {
    let score = 0;
    const message = userMessage.toLowerCase();

    // Tool-specific keywords
    const toolKeywords: Record<string, string[]> = {
      'search_legs_by_location': ['find', 'search', 'look for', 'location', 'where', 'from', 'to', 'near'],
      'search_legs': ['find', 'search', 'look for', 'legs', 'journey', 'trip'],
      'get_leg_details': ['details', 'information', 'about', 'show'],
      'suggest_register_for_leg': ['register', 'join', 'apply', 'sign up', 'interested'],
      'suggest_profile_update': ['update', 'change', 'improve', 'fix', 'add', 'missing'],
      'get_user_profile': ['profile', 'my account', 'information', 'details']
    };

    const keywords = toolKeywords[tool.name] || [];
    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Get tool usage statistics for monitoring
   */
  getToolUsageStats(tools: ToolDefinition[]): Record<string, number> {
    return tools.reduce((stats, tool) => {
      stats[tool.name] = 0; // Initialize with 0, would be tracked in real implementation
      return stats;
    }, {} as Record<string, number>);
  }
}

/**
 * Tool usage tracker for analytics
 */
export class ToolUsageTracker {
  private usageStats: Record<string, number> = {};

  /**
   * Track tool usage
   */
  trackUsage(toolName: string): void {
    this.usageStats[toolName] = (this.usageStats[toolName] || 0) + 1;
  }

  /**
   * Get usage statistics
   */
  getStats(): Record<string, number> {
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics
   */
  resetStats(): void {
    this.usageStats = {};
  }

  /**
   * Get most frequently used tools
   */
  getTopTools(limit: number = 5): Array<{ name: string; count: number }> {
    return Object.entries(this.usageStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }
}