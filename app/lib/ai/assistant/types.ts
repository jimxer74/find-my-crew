/**
 * AI Assistant Type Definitions
 */

// Database types
export interface AIConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: MessageMetadata;
  created_at: string;
}

export interface MessageMetadata {
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  pendingActionId?: string;
  error?: string;
}

export interface AIPendingAction {
  id: string;
  user_id: string;
  conversation_id: string | null;
  action_type: ActionType;
  action_payload: Record<string, unknown>;
  explanation: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: string;
  resolved_at: string | null;
}

export interface AISuggestion {
  id: string;
  user_id: string;
  suggestion_type: SuggestionType;
  title: string;
  description: string;
  metadata: SuggestionMetadata;
  dismissed: boolean;
  created_at: string;
}

// Action types
export type ActionType =
  | 'register_for_leg'
  | 'update_profile'
  | 'create_journey'
  | 'approve_registration'
  | 'reject_registration';

// Suggestion types
export type SuggestionType =
  | 'matching_leg'
  | 'matching_crew'
  | 'profile_improvement'
  | 'journey_opportunity';

export interface SuggestionMetadata {
  legId?: string;
  journeyId?: string;
  crewId?: string;
  matchScore?: number;
  reason?: string;
  [key: string]: unknown;
}

// Tool calling types
export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
  // Support nested object properties (for complex types like bounding boxes)
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

// User context for AI
export interface UserContext {
  userId: string;
  profile: {
    username: string;
    fullName: string | null;
    roles: string[];
    sailingExperience: number | null;
    userDescription: string | null;
    certifications: string | null;
    skills: string[];
    riskLevel: string[];
    sailingPreferences: string | null;
  } | null;
  boats?: {
    id: string;
    name: string;
    type: string | null;
    make: string | null;
    model: string | null;
  }[];
  recentRegistrations?: {
    id: string;
    legId: string;
    legName: string;
    journeyName: string;
    status: string;
    createdAt: string;
  }[];
  pendingActionsCount: number;
  suggestionsCount: number;
}

// Chat request/response
export interface ChatRequest {
  conversationId?: string;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  message: AIMessage;
  pendingActions?: AIPendingAction[];
}

// Assistant service options
export interface AssistantOptions {
  userId: string;
  conversationId?: string;
  maxHistoryMessages?: number;
}
