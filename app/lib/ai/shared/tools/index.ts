/**
 * Shared AI Tools Module
 *
 * Unified tool registry for all AI assistant contexts.
 * Provides a single source of truth for tool definitions and access control.
 */

// Types
export type { ToolDefinition, ToolAccess, ToolCategory, ToolParameters, ToolParameterProperty, UserContext } from './types';

// Tool definitions
export { TOOL_DEFINITIONS } from './definitions';

// Registry functions
export {
  // Tool retrieval
  getAllTools,
  getToolsForProspect,
  getToolsForProspectProfileCompletion,
  getToolsForUser,
  getToolsForContext,
  getToolByName,
  // Category filtering
  getToolsByCategory,
  getDataTools,
  getActionTools,
  // Tool checks
  isActionTool,
  isOwnerOnlyTool,
  isCrewOnlyTool,
  isPublicTool,
  canUserUseTool,
  // Name lists
  getOwnerOnlyToolNames,
  getCrewOnlyToolNames,
  getActionToolNames,
  // Format conversion
  toolsToOpenAIFormat,
  toolsToPromptFormat,
} from './registry';
