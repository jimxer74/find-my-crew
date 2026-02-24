/**
 * Owner AI Chat Type Definitions
 *
 * Types for owner/skipper role users onboarding (profile, boat, journey creation).
 * Uses shared ToolCall type from @/app/lib/ai/shared for consistency.
 */

import { ToolCall } from '../shared';

/** Canonical onboarding step for owner flow. Used to restrict tools and simplify prompts. */
export type OwnerStep =
  | 'signup'
  | 'create_profile'
  | 'add_boat'
  | 'post_journey'
  | 'completed';

/** A pending tool call action awaiting user approval */
export interface PendingAction {
  toolName: string;
  arguments: Record<string, unknown>;
  /** Human-readable label for the approve button */
  label?: string;
}

export interface OwnerMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    toolCalls?: ToolCall[];
    toolResults?: Array<{ name: string; result: any; error?: string }>;
    /** Action tool calls that require user approval before execution */
    pendingAction?: PendingAction;
    /** Flag indicating this is an intermediate message (has tool calls) */
    isIntermediate?: boolean;
    /** Flag indicating this is an internal system message not meant for display */
    isSystem?: boolean;
  };
}

/** Regex to extract owner name from AI response for signup form prefill. Match [OWNER_NAME: ...] */
export const OWNER_NAME_TAG_REGEX = /\[OWNER_NAME:\s*([^\]]+)\]/i;

export interface OwnerPreferences {
  // Profile information
  /** Full name shared in chat before signup; used to prefill the email signup form */
  fullName?: string;
  userDescription?: string; // Bio / about the user
  experienceLevel?: number; // 1-4 (Beginner to Offshore Skipper)
  riskLevels?: string[]; // Comfort zones: "Coastal sailing", "Offshore sailing", "Extreme sailing"
  skills?: string[]; // Sailing skills
  certifications?: string; // Sailing certifications (RYA, ASA, etc.)

  // Boat information (gathered during conversation)
  boatName?: string;
  boatMakeModel?: string; // e.g., "Bavaria 46"
  boatType?: string; // Sailboat category
  boatCapacity?: number;
  boatHomePort?: string;
  boatCountryFlag?: string;
  boatDetails?: {
    // Detailed specs from screenscraping/AI
    loa_m?: number;
    beam_m?: number;
    max_draft_m?: number;
    displcmt_m?: number;
    average_speed_knots?: number;
    characteristics?: string;
    capabilities?: string;
    accommodations?: string;
    link_to_specs?: string;
    sa_displ_ratio?: number;
    ballast_displ_ratio?: number;
    displ_len_ratio?: number;
    comfort_ratio?: number;
    capsize_screening?: number;
    hull_speed_knots?: number;
    ppi_pounds_per_inch?: number;
  };

  // Journey information (gathered during conversation)
  journeyName?: string;
  journeyDescription?: string;
  journeyStartDate?: string;
  journeyEndDate?: string;
  journeyStartLocation?: { name: string; lat: number; lng: number };
  journeyEndLocation?: { name: string; lat: number; lng: number };
  journeyWaypoints?: Array<{ name: string; lat: number; lng: number }>;
  journeyRiskLevel?: string[];
  journeySkills?: string[];
  journeyMinExperienceLevel?: number;
}

export interface OwnerSession {
  sessionId: string;
  createdAt: string;
  lastActiveAt: string;
  conversation: OwnerMessage[];
  gatheredPreferences: OwnerPreferences;
  /** Email stored in owner_sessions.email for the current session */
  sessionEmail?: string | null;
  /** True when owner_sessions.email is set for this session */
  hasSessionEmail?: boolean;
  /** When profile completion SYSTEM message was sent; null = not yet triggered */
  profileCompletionTriggeredAt?: string | null;
  /** Onboarding state: signup_pending, consent_pending, profile_pending, boat_pending, journey_pending, completed */
  onboardingState?: string;
  /** Raw skipper/owner profile text from combo search box */
  skipperProfile?: string | null;
  /** Raw crew requirements text from combo search box */
  crewRequirements?: string | null;
  /** Parsed journey details text from combo search box (locations, dates, waypoints) */
  journeyDetails?: string | null;
  /** Imported profile data from URL import feature */
  importedProfile?: {
    url: string;
    source: string;
    content: string;
  } | null;
}

/** Known user profile data from signup/OAuth metadata */
export interface KnownUserProfile {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface OwnerChatRequest {
  sessionId?: string;
  message: string;
  conversationHistory?: OwnerMessage[];
  gatheredPreferences?: OwnerPreferences;
  // Profile completion mode for authenticated users
  profileCompletionMode?: boolean;
  userId?: string;
  /** User profile data already known from signup/OAuth (name, email, phone, avatar) */
  userProfile?: KnownUserProfile | null;
  authenticatedUserId?: string | null; // Set by server after auth verification
  /** Pre-approved action to execute directly (from user clicking Approve button) */
  approvedAction?: PendingAction;
  /** Raw skipper/owner profile text from combo search box — injected into system prompt as fallback context */
  skipperProfile?: string | null;
  /** Raw crew requirements text from combo search box — used in post_journey step for crew fields */
  crewRequirements?: string | null;
  /** Parsed journey details text (locations, dates, waypoints) — used in post_journey step */
  journeyDetails?: string | null;
  /** Imported profile data from URL import feature */
  importedProfile?: {
    url: string;
    source: string;
    content: string;
  } | null;
}

export interface OwnerChatResponse {
  sessionId: string;
  message: OwnerMessage;
  /** Array of intermediate messages from this request (containing tool calls and reasoning) */
  intermediateMessages?: OwnerMessage[];
  extractedPreferences?: Partial<OwnerPreferences>;
  /** Flag indicating that profile was successfully created - triggers cleanup of owner data */
  profileCreated?: boolean;
  /** Flag indicating that boat was successfully created */
  boatCreated?: boolean;
  /** Flag indicating that journey was successfully created */
  journeyCreated?: boolean;
}
