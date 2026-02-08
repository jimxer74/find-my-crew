/**
 * Dynamic Tool Registry
 *
 * Manages use-case specific tool selection and prioritization.
 * Tool definitions are imported from the shared tools module.
 */

import { UseCaseIntent } from './use-case-classification';
import {
  TOOL_DEFINITIONS,
  getToolsForUser,
  type ToolDefinition as SharedToolDefinition,
} from '../shared/tools';

/**
 * Tool definition interface (simplified for use-case registry)
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required: string[];
}

/**
 * Convert shared tool definition to registry format
 */
function toRegistryFormat(tool: SharedToolDefinition): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters.properties,
    required: tool.parameters.required || [],
  };
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

    // Get tools available for user's roles from shared registry
    const userTools = getToolsForUser(userRoles).map(toRegistryFormat);

    // Filter to only tools relevant for this use case
    return userTools.filter(tool => toolNames.includes(tool.name));
  }

  /**
   * Get all available tools for given user roles
   */
  getAllToolsForUser(userRoles: string[]): ToolDefinition[] {
    return getToolsForUser(userRoles).map(toRegistryFormat);
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