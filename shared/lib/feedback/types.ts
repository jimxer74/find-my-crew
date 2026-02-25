/**
 * Feedback System Types and Interfaces
 *
 * Defines the core types for the feedback system including
 * feedback types, statuses, database models, and API payloads.
 */

// ============================================================================
// Feedback Type Enum
// ============================================================================

export enum FeedbackType {
  BUG = 'bug',
  FEATURE = 'feature',
  IMPROVEMENT = 'improvement',
  OTHER = 'other',
}

// ============================================================================
// Feedback Status Enum
// ============================================================================

export enum FeedbackStatus {
  NEW = 'new',
  UNDER_REVIEW = 'under_review',
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DECLINED = 'declined',
}

// ============================================================================
// Prompt Types
// ============================================================================

export enum FeedbackPromptType {
  POST_JOURNEY = 'post_journey',
  POST_REGISTRATION = 'post_registration',
  ENGAGEMENT_MILESTONE = 'engagement_milestone',
  GENERAL = 'general',
  ERROR_RECOVERY = 'error_recovery',
}

// ============================================================================
// Database Models
// ============================================================================

/**
 * Feedback record as stored in the database
 */
export interface Feedback {
  id: string;
  user_id: string;
  type: FeedbackType;
  title: string;
  description: string | null;
  context_page: string | null;
  context_metadata: FeedbackContextMetadata | null;
  status: FeedbackStatus;
  status_note: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  upvotes: number;
  downvotes: number;
  vote_score: number;
  is_public: boolean;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Feedback with author profile information for display
 */
export interface FeedbackWithAuthor extends Feedback {
  author: {
    id: string;
    username: string;
    full_name: string | null;
    profile_image_url: string | null;
  } | null;
  user_vote?: number | null; // Current user's vote: 1, -1, or null if not voted
}

/**
 * Context metadata stored with feedback
 */
export interface FeedbackContextMetadata {
  journey_id?: string;
  journey_name?: string;
  leg_id?: string;
  leg_name?: string;
  boat_id?: string;
  boat_name?: string;
  error_message?: string;
  error_code?: string;
  browser?: string;
  os?: string;
  [key: string]: unknown;
}

/**
 * Feedback vote record as stored in the database
 */
export interface FeedbackVote {
  id: string;
  feedback_id: string;
  user_id: string;
  vote: -1 | 1;
  created_at: string;
}

/**
 * Feedback prompt dismissal record
 */
export interface FeedbackPromptDismissal {
  id: string;
  user_id: string;
  prompt_type: FeedbackPromptType | string;
  dismissed_at: string;
  dismiss_until: string | null;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Payload for creating new feedback
 */
export interface CreateFeedbackPayload {
  type: FeedbackType;
  title: string;
  description?: string;
  is_anonymous?: boolean;
  context_page?: string;
  context_metadata?: FeedbackContextMetadata;
}

/**
 * Payload for updating feedback
 */
export interface UpdateFeedbackPayload {
  title?: string;
  description?: string;
  is_public?: boolean;
  is_anonymous?: boolean;
}

/**
 * Payload for admin to update feedback status
 */
export interface UpdateFeedbackStatusPayload {
  status: FeedbackStatus;
  status_note?: string;
}

/**
 * Payload for voting on feedback
 */
export interface VoteFeedbackPayload {
  vote: 1 | -1 | 0; // 0 = remove vote
}

/**
 * Query parameters for fetching feedback list
 */
export interface GetFeedbackParams {
  type?: FeedbackType;
  status?: FeedbackStatus;
  sort?: 'newest' | 'oldest' | 'most_votes' | 'least_votes';
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Response for paginated feedback list
 */
export interface FeedbackListResponse {
  items: FeedbackWithAuthor[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Payload for dismissing a prompt
 */
export interface DismissPromptPayload {
  prompt_type: FeedbackPromptType | string;
  dismiss_days?: number; // null = forever
}

/**
 * Response for prompt status check
 */
export interface PromptStatusResponse {
  showPostJourneyPrompt: boolean;
  showGeneralPrompt: boolean;
  showEngagementPrompt: boolean;
  postJourneyContext?: {
    journey_id: string;
    journey_name: string;
    leg_name: string;
  };
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Filter state for the feedback board UI
 */
export interface FeedbackFilters {
  type: FeedbackType | 'all';
  status: FeedbackStatus | 'all';
  sort: 'newest' | 'oldest' | 'most_votes' | 'least_votes';
  search: string;
}

/**
 * State for the feedback submission modal
 */
export interface FeedbackModalState {
  isOpen: boolean;
  initialType?: FeedbackType;
  contextPage?: string;
  contextMetadata?: FeedbackContextMetadata;
}

// ============================================================================
// Helper Type Guards
// ============================================================================

export function isFeedbackType(value: string): value is FeedbackType {
  return Object.values(FeedbackType).includes(value as FeedbackType);
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return Object.values(FeedbackStatus).includes(value as FeedbackStatus);
}

export function isFeedbackPromptType(value: string): value is FeedbackPromptType {
  return Object.values(FeedbackPromptType).includes(value as FeedbackPromptType);
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get display label for feedback type
 */
export function getFeedbackTypeLabel(type: FeedbackType): string {
  const labels: Record<FeedbackType, string> = {
    [FeedbackType.BUG]: 'Bug',
    [FeedbackType.FEATURE]: 'Feature',
    [FeedbackType.IMPROVEMENT]: 'Improvement',
    [FeedbackType.OTHER]: 'Other',
  };
  return labels[type];
}

/**
 * Get display label for feedback status
 */
export function getFeedbackStatusLabel(status: FeedbackStatus): string {
  const labels: Record<FeedbackStatus, string> = {
    [FeedbackStatus.NEW]: 'New',
    [FeedbackStatus.UNDER_REVIEW]: 'Under Review',
    [FeedbackStatus.PLANNED]: 'Planned',
    [FeedbackStatus.IN_PROGRESS]: 'In Progress',
    [FeedbackStatus.COMPLETED]: 'Completed',
    [FeedbackStatus.DECLINED]: 'Declined',
  };
  return labels[status];
}

/**
 * Get color class for feedback type badge
 */
export function getFeedbackTypeColor(type: FeedbackType): string {
  const colors: Record<FeedbackType, string> = {
    [FeedbackType.BUG]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    [FeedbackType.FEATURE]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    [FeedbackType.IMPROVEMENT]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    [FeedbackType.OTHER]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return colors[type];
}

/**
 * Get color class for feedback status badge
 */
export function getFeedbackStatusColor(status: FeedbackStatus): string {
  const colors: Record<FeedbackStatus, string> = {
    [FeedbackStatus.NEW]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    [FeedbackStatus.UNDER_REVIEW]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    [FeedbackStatus.PLANNED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    [FeedbackStatus.IN_PROGRESS]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    [FeedbackStatus.COMPLETED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    [FeedbackStatus.DECLINED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return colors[status];
}
