/**
 * Shared AI Utilities
 *
 * Common utilities for AI chat implementations across the application.
 */

// Tool parsing utilities
export {
  parseToolCalls,
  normalizeArgs,
  normalizeDateArgs,
  normalizeLocationArgs,
  formatToolResultsForAI,
  type ToolCall,
  type ToolResult,
} from './tool-utils';

// Bounding box utilities
export {
  normalizeBboxArgs,
  isValidBbox,
  isPointInBbox,
  extractCoordinates,
  describeBbox,
  type BoundingBox,
  type NormalizedBboxArgs,
} from './bbox-utils';

// Leg utilities
export {
  transformLeg,
  transformLegs,
  formatLegForAI,
  formatLegsForAI,
  filterLegsByLocationText,
  type RawLeg,
  type TransformedLeg,
  type FormattedLegForAI,
} from './leg-utils';

// Search utilities
export {
  searchPublishedLegs,
  searchLegsByBbox,
  findLegsInBbox,
  type LegSearchOptions,
  type LegSearchResult,
} from './search-utils';

// Tool registry (unified tool definitions and access control)
export {
  // Types
  type ToolDefinition,
  type ToolAccess,
  type ToolCategory,
  type ToolParameters,
  type UserContext,
  // Tool definitions
  TOOL_DEFINITIONS,
  // Registry functions
  getAllTools,
  getToolsForProspect,
  getToolsForUser,
  getToolsForContext,
  getToolByName,
  getToolsByCategory,
  getDataTools,
  getActionTools,
  isActionTool,
  isOwnerOnlyTool,
  isCrewOnlyTool,
  isPublicTool,
  canUserUseTool,
  getOwnerOnlyToolNames,
  getCrewOnlyToolNames,
  getActionToolNames,
  toolsToOpenAIFormat,
  toolsToPromptFormat,
} from './tools';
