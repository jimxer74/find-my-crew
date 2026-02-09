/**
 * Prospect AI Chat Type Definitions
 *
 * Types for unauthenticated prospect users exploring sailing opportunities.
 * Uses shared ToolCall type from @/app/lib/ai/shared for consistency.
 */

import { ToolCall } from '../shared';

export interface ProspectMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    toolCalls?: ToolCall[];
    legReferences?: ProspectLegReference[];
  };
}

export interface ProspectLegReference {
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

export interface ProspectPreferences {
  experienceLevel?: number; // 1-4
  riskLevels?: string[];
  preferredDates?: { start: string; end: string };
  preferredLocations?: string[]; // Deprecated: use departure/arrival locations
  departureLocations?: string[]; // Where user wants to start
  arrivalLocations?: string[]; // Where user wants to end
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
  // Profile completion mode for authenticated users
  profileCompletionMode?: boolean;
  userId?: string;
  authenticatedUserId?: string | null; // Set by server after auth verification
}

export interface ProspectChatResponse {
  sessionId: string;
  message: ProspectMessage;
  extractedPreferences?: Partial<ProspectPreferences>;
}
