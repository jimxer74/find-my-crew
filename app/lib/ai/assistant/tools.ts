/**
 * AI Assistant Tool Definitions
 *
 * This module re-exports from the unified tool registry for backwards compatibility.
 * All tool definitions are now managed in @/app/lib/ai/shared/tools.
 */

import {
  TOOL_DEFINITIONS,
  getToolsForUser as sharedGetToolsForUser,
  isActionTool as sharedIsActionTool,
  toolsToOpenAIFormat as sharedToolsToOpenAIFormat,
  getOwnerOnlyToolNames,
  getCrewOnlyToolNames,
  getActionToolNames,
  getDataTools,
  getActionTools,
  type ToolDefinition as SharedToolDefinition,
} from '../shared';

// Re-export ToolDefinition type (maintaining backwards compatibility)
// The shared type includes access and category fields, but the original didn't
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Convert shared tool definition to legacy format (strip access/category)
 */
function toLegacyFormat(tool: SharedToolDefinition): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as ToolDefinition['parameters'],
  };
}

// Data retrieval tools - these execute immediately and return data
export const DATA_TOOLS: ToolDefinition[] = getDataTools(TOOL_DEFINITIONS)
  .filter((t) => !t.disabled)
  .map(toLegacyFormat);

// Action suggestion tools - these create pending actions that require user approval
export const ACTION_TOOLS: ToolDefinition[] = getActionTools(TOOL_DEFINITIONS)
  .filter((t) => !t.disabled)
  .map(toLegacyFormat);

// All tools combined
export const ALL_TOOLS: ToolDefinition[] = TOOL_DEFINITIONS
  .filter((t) => !t.disabled)
  .map(toLegacyFormat);

// Tool names that require owner role
export const OWNER_ONLY_TOOLS = getOwnerOnlyToolNames();

// Tool names that require crew role
export const CREW_ONLY_TOOLS = getCrewOnlyToolNames();

// Tool names that create pending actions
export const ACTION_TOOL_NAMES = getActionToolNames();

/**
 * Get tools available for a user based on their roles
 */
export function getToolsForUser(roles: string[]): ToolDefinition[] {
  return sharedGetToolsForUser(roles).map(toLegacyFormat);
}

/**
 * Check if a tool creates a pending action
 */
export function isActionTool(toolName: string): boolean {
  return sharedIsActionTool(toolName);
}

/**
 * Convert tools to the format expected by AI providers (OpenAI-compatible)
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
