/**
 * Prospect AI Chat Type Definitions
 *
 * Types for unauthenticated prospect users exploring sailing opportunities.
 * Uses shared ToolCall type from @/app/lib/ai/shared for consistency.
 */

import { ToolCall } from '../shared';

/** A pending tool call action awaiting user approval */
export interface PendingAction {
  toolName: string;
  arguments: Record<string, unknown>;
  /** Human-readable label for the approve button */
  label?: string;
}

export interface ProspectMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    toolCalls?: ToolCall[];
    legReferences?: ProspectLegReference[];
    /** Action tool calls that require user approval before execution */
    pendingAction?: PendingAction;
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

/** Regex to extract prospect name from AI response for signup form prefill. Match [PROSPECT_NAME: ...] */
export const PROSPECT_NAME_TAG_REGEX = /\[PROSPECT_NAME:\s*([^\]]+)\]/i;

export interface ProspectPreferences {
  // Profile information
  /** Full name shared in chat before signup; used to prefill the email signup form */
  fullName?: string;
  userDescription?: string; // Bio / about the user
  experienceLevel?: number; // 1-4 (Beginner to Offshore Skipper)
  riskLevels?: string[]; // Comfort zones: "Coastal sailing", "Offshore sailing", "Extreme sailing"
  skills?: string[]; // Sailing skills
  certifications?: string; // Sailing certifications (RYA, ASA, etc.)

  // Sailing preferences
  sailingGoals?: string; // What they're looking for in sailing
  preferredDates?: { start: string; end: string };
  preferredLocations?: string[]; // Deprecated: use departure/arrival locations
  departureLocations?: string[]; // Where user wants to start
  arrivalLocations?: string[]; // Where user wants to end

  // Target leg for registration (when user clicks "Join" on a specific leg)
  targetLegId?: string;
  targetLegName?: string;
}

export interface ProspectSession {
  sessionId: string;
  createdAt: string;
  lastActiveAt: string;
  conversation: ProspectMessage[];
  gatheredPreferences: ProspectPreferences;
  viewedLegs: string[]; // IDs of legs user clicked on
}

/** Known user profile data from signup/OAuth metadata */
export interface KnownUserProfile {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface ProspectChatRequest {
  sessionId?: string;
  message: string;
  conversationHistory?: ProspectMessage[];
  gatheredPreferences?: ProspectPreferences;
  // Profile completion mode for authenticated users
  profileCompletionMode?: boolean;
  userId?: string;
  /** User profile data already known from signup/OAuth (name, email, phone, avatar) */
  userProfile?: KnownUserProfile | null;
  authenticatedUserId?: string | null; // Set by server after auth verification
  /** Pre-approved action to execute directly (from user clicking Approve button) */
  approvedAction?: PendingAction;
}

export interface ProspectChatResponse {
  sessionId: string;
  message: ProspectMessage;
  extractedPreferences?: Partial<ProspectPreferences>;
}
