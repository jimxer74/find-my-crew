/**
 * Shared Tool Types
 *
 * Common types for the unified tool registry.
 */

/**
 * Access levels for tools
 * - PUBLIC: Available to unauthenticated prospect users
 * - AUTHENTICATED: Available to any authenticated user
 * - CREW: Available only to users with crew role
 * - OWNER: Available only to users with owner role
 */
export type ToolAccess = 'public' | 'authenticated' | 'crew' | 'owner';

/**
 * Tool category for organization
 */
export type ToolCategory = 'data' | 'action';

/**
 * JSON Schema for tool parameters
 */
export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameterProperty;
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

/**
 * Unified tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
  access: ToolAccess;
  category: ToolCategory;
  /** If true, this tool is currently disabled */
  disabled?: boolean;
}

/**
 * User context for tool filtering
 */
export interface UserContext {
  isAuthenticated: boolean;
  roles: string[];
}
