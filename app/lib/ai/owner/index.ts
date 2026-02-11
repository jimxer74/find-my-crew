/**
 * Owner AI Chat Module
 *
 * Exports for owner/skipper role user onboarding chat functionality.
 */

export { ownerChat } from './service';

export type {
  OwnerMessage,
  OwnerSession,
  OwnerPreferences,
  OwnerChatRequest,
  OwnerChatResponse,
} from './types';

// Re-export shared types for convenience
export type { ToolCall } from '../shared';
