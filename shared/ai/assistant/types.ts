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

export interface LegReference {
  id: string;
  name: string;
  journeyName?: string;
  journeyId?: string;
  boatName?: string;
  startDate?: string;
  endDate?: string;
  departureLocation?: string;
  arrivalLocation?: string;
  // Image fields for carousel display
  journeyImages?: string[];
  boatImages?: string[];
}

export interface MessageMetadata {
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  pendingActionId?: string;
  error?: string;
  legReferences?: LegReference[];
}

export interface AIPendingAction {
  id: string;
  user_id: string;
  conversation_id: string | null;
  action_type: ActionType;
  action_payload: Record<string, unknown>;
  explanation: string;
  status: 'pending' | 'approved' | 'awaiting_input' | 'rejected' | 'expired' | 'redirected';
  created_at: string;
  resolved_at: string | null;

  // NEW FIELDS: Input collection support
  input_prompt?: string;        // "What would you like your new user description to be?"
  input_type?: 'text' | 'text_array' | 'select'; // Type of input needed
  input_options?: string[];     // For select inputs (e.g., risk levels)
  awaiting_user_input?: boolean; // Flag for input collection state

  // NEW FIELDS: Profile action metadata
  profile_section?: 'personal' | 'preferences' | 'experience' | 'notifications';
  profile_field?: string;
  ai_highlight_text?: string;

  // DATABASE FIELDS: Additional fields from database
  field_type?: string;          // e.g., "skills", "user_description"
  suggested_value?: string;     // Suggested value for the field
}

export interface ProfileActionMetadata {
  section: 'personal' | 'preferences' | 'experience' | 'notifications';
  field: string; // e.g., 'user_description', 'certifications', etc.
  highlightText: string; // Text to show as AI suggestion context
}

// Action types
export type ActionType =
  | 'register_for_leg'
  | 'update_profile_user_description'
  | 'update_profile_certifications'
  | 'update_profile_risk_level'
  | 'update_profile_sailing_preferences'
  | 'update_profile_skills'
  | 'refine_skills'
  | 'create_journey'
  | 'approve_registration'
  | 'reject_registration'
  | 'suggest_profile_update_user_description';

export interface SkillsRefinementPayload {
  targetSkills: string[];
  currentSkills: string[];
  suggestedImprovements?: Record<string, string>;
  userProvidedDescriptions?: Record<string, string>;
}

// Tool calling types
export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
  // Support nested object properties (for complex types like bounding boxes)
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  // Support array types
  items?: ToolParameterProperty;
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
    make_model: string | null;
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
