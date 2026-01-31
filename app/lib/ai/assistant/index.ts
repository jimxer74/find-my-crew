// Main service
export {
  chat,
  createConversation,
  getConversation,
  listConversations,
  deleteConversation,
  getConversationHistory,
} from './service';

// Types
export type {
  AIConversation,
  AIMessage,
  AIPendingAction,
  AISuggestion,
  ChatRequest,
  ChatResponse,
  AssistantOptions,
  UserContext,
  ToolCall,
  ToolResult,
  ActionType,
  SuggestionType,
} from './types';

// Tools
export {
  ALL_TOOLS,
  DATA_TOOLS,
  ACTION_TOOLS,
  getToolsForUser,
  isActionTool,
} from './tools';

// Context
export { getUserContext, buildSystemPrompt } from './context';

// Actions
export { executeAction, rejectAction } from './actions';

// Matching/Suggestions
export {
  findMatchingCrew,
  findMatchingLegs,
  createMatchingSuggestions,
  generateSuggestionsForNewLeg,
  generateSuggestionsForUser,
} from './matching';
