/**
 * Unified Tool Registry
 *
 * Provides functions to filter tools based on user context (authentication, roles).
 * Single source of truth for tool access control across the application.
 */

import { ToolDefinition, ToolAccess, ToolCategory, UserContext } from './types';
import { TOOL_DEFINITIONS } from './definitions';

/**
 * Get all enabled tool definitions
 */
export function getAllTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => !tool.disabled);
}

/**
 * Get tools available to unauthenticated prospect users
 * Only returns PUBLIC tools
 */
export function getToolsForProspect(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => tool.access === 'public' && !tool.disabled);
}

/**
 * Get tools available for an authenticated user based on their roles
 */
export function getToolsForUser(roles: string[]): ToolDefinition[] {
  const isOwner = roles.includes('owner');
  const isCrew = roles.includes('crew');

  return TOOL_DEFINITIONS.filter((tool) => {
    if (tool.disabled) return false;

    switch (tool.access) {
      case 'public':
        // Public tools are available to everyone
        return true;
      case 'authenticated':
        // Authenticated tools are available to any logged-in user
        return true;
      case 'crew':
        // Crew tools require crew role
        return isCrew;
      case 'owner':
        // Owner tools require owner role
        return isOwner;
      default:
        return false;
    }
  });
}

/**
 * Get tools based on user context
 */
export function getToolsForContext(context: UserContext): ToolDefinition[] {
  if (!context.isAuthenticated) {
    return getToolsForProspect();
  }
  return getToolsForUser(context.roles);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(tools: ToolDefinition[], category: ToolCategory): ToolDefinition[] {
  return tools.filter((tool) => tool.category === category);
}

/**
 * Get data tools (non-action tools)
 */
export function getDataTools(tools: ToolDefinition[]): ToolDefinition[] {
  return getToolsByCategory(tools, 'data');
}

/**
 * Get action tools (create pending actions)
 */
export function getActionTools(tools: ToolDefinition[]): ToolDefinition[] {
  return getToolsByCategory(tools, 'action');
}

/**
 * Check if a tool creates a pending action
 */
export function isActionTool(toolName: string): boolean {
  const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
  return tool?.category === 'action';
}

/**
 * Check if a tool requires owner role
 */
export function isOwnerOnlyTool(toolName: string): boolean {
  const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
  return tool?.access === 'owner';
}

/**
 * Check if a tool requires crew role
 */
export function isCrewOnlyTool(toolName: string): boolean {
  const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
  return tool?.access === 'crew';
}

/**
 * Check if a tool is available to prospects (public)
 */
export function isPublicTool(toolName: string): boolean {
  const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
  return tool?.access === 'public';
}

/**
 * Get a tool by name
 */
export function getToolByName(toolName: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === toolName);
}

/**
 * Convert tools to the format expected by AI providers (OpenAI-compatible)
 * Strips internal fields like access and category
 */
export function toolsToOpenAIFormat(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Format tools for prompt-based AI (text description)
 */
export function toolsToPromptFormat(tools: ToolDefinition[]): string {
  return tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.properties, null, 2)}`
    )
    .join('\n\n');
}

/**
 * Get tool names that require owner role
 */
export function getOwnerOnlyToolNames(): string[] {
  return TOOL_DEFINITIONS.filter((t) => t.access === 'owner').map((t) => t.name);
}

/**
 * Get tool names that require crew role
 */
export function getCrewOnlyToolNames(): string[] {
  return TOOL_DEFINITIONS.filter((t) => t.access === 'crew').map((t) => t.name);
}

/**
 * Get action tool names
 */
export function getActionToolNames(): string[] {
  return TOOL_DEFINITIONS.filter((t) => t.category === 'action').map((t) => t.name);
}

/**
 * Validate that a user can use a specific tool
 */
export function canUserUseTool(toolName: string, context: UserContext): boolean {
  const tool = getToolByName(toolName);
  if (!tool || tool.disabled) return false;

  switch (tool.access) {
    case 'public':
      return true;
    case 'authenticated':
      return context.isAuthenticated;
    case 'crew':
      return context.isAuthenticated && context.roles.includes('crew');
    case 'owner':
      return context.isAuthenticated && context.roles.includes('owner');
    default:
      return false;
  }
}
