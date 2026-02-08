/**
 * Prospect AI Chat Type Definitions
 *
 * Types for unauthenticated prospect users exploring sailing opportunities.
 */

export interface ProspectMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    toolCalls?: ProspectToolCall[];
    legReferences?: ProspectLegReference[];
  };
}

export interface ProspectToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ProspectLegReference {
  id: string;
  name: string;
  journeyName?: string;
  boatName?: string;
  startDate?: string;
  endDate?: string;
  departureLocation?: string;
  arrivalLocation?: string;
}

export interface ProspectPreferences {
  experienceLevel?: number; // 1-4
  riskLevels?: string[];
  preferredDates?: { start: string; end: string };
  preferredLocations?: string[];
  skills?: string[];
  sailingGoals?: string;
}

export interface ProspectSession {
  sessionId: string;
  createdAt: string;
  lastActiveAt: string;
  conversation: ProspectMessage[];
  gatheredPreferences: ProspectPreferences;
  viewedLegs: string[]; // IDs of legs user clicked on
}

export interface ProspectChatRequest {
  sessionId?: string;
  message: string;
  conversationHistory?: ProspectMessage[];
  gatheredPreferences?: ProspectPreferences;
}

export interface ProspectChatResponse {
  sessionId: string;
  message: ProspectMessage;
  extractedPreferences?: Partial<ProspectPreferences>;
}
