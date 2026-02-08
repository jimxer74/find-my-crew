/**
 * Prospect AI Chat Module
 *
 * Exports for unauthenticated prospect user chat functionality.
 */

export { prospectChat } from './service';

export type {
  ProspectMessage,
  ProspectSession,
  ProspectPreferences,
  ProspectChatRequest,
  ProspectChatResponse,
  ProspectLegReference,
} from './types';

// Re-export shared types for convenience
export type { ToolCall } from '../shared';
