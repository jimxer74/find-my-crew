/**
 * Feedback Service
 *
 * Core service for managing user feedback, votes, and prompts.
 * Provides CRUD operations and helper functions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/app/lib/logger';
import {
  FeedbackType,
  FeedbackStatus,
  type Feedback,
  type FeedbackWithAuthor,
  type FeedbackVote,
  type FeedbackPromptDismissal,
  type CreateFeedbackPayload,
  type UpdateFeedbackPayload,
  type UpdateFeedbackStatusPayload,
  type GetFeedbackParams,
  type FeedbackListResponse,
  type DismissPromptPayload,
  type PromptStatusResponse,
  FeedbackPromptType,
} from './types';

// ============================================================================
// Core Feedback CRUD Operations
// ============================================================================

/**
 * Creates new feedback
 */
export async function createFeedback(
  supabase: SupabaseClient,
  userId: string,
  payload: CreateFeedbackPayload
): Promise<{ feedback: Feedback | null; error: string | null }> {
  logger.debug('[FeedbackService] Creating feedback', {
    user_id: userId,
    type: payload.type,
    title: payload.title,
  });

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      description: payload.description || null,
      is_anonymous: payload.is_anonymous || false,
      context_page: payload.context_page || null,
      context_metadata: payload.context_metadata || null,
    })
    .select()
    .single();

  if (error) {
    logger.error('[FeedbackService] Error creating feedback', {
      error: error?.message || String(error),
      code: error?.code,
      message: error?.message,
    });
    return { feedback: null, error: error.message };
  }

  logger.info('[FeedbackService] Feedback created successfully', { feedbackId: data?.id });
  return { feedback: data as Feedback, error: null };
}

/**
 * Gets a single feedback item by ID with author info
 */
export async function getFeedbackById(
  supabase: SupabaseClient,
  feedbackId: string,
  currentUserId?: string
): Promise<{ feedback: FeedbackWithAuthor | null; error: string | null }> {
  const { data, error } = await supabase
    .from('feedback')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        profile_image_url
      )
    `)
    .eq('id', feedbackId)
    .single();

  if (error) {
    logger.error('[FeedbackService] Error fetching feedback', { error: error instanceof Error ? error.message : String(error) });
    return { feedback: null, error: error.message };
  }

  if (!data) {
    return { feedback: null, error: 'Feedback not found' };
  }

  // Get current user's vote if logged in
  let userVote: number | null = null;
  if (currentUserId) {
    const { data: voteData } = await supabase
      .from('feedback_votes')
      .select('vote')
      .eq('feedback_id', feedbackId)
      .eq('user_id', currentUserId)
      .single();

    userVote = voteData?.vote ?? null;
  }

  // Format the response
  const feedback: FeedbackWithAuthor = {
    ...data,
    author: data.is_anonymous ? null : {
      id: data.profiles?.id,
      username: data.profiles?.username,
      full_name: data.profiles?.full_name,
      profile_image_url: data.profiles?.profile_image_url,
    },
    user_vote: userVote,
  };

  // Remove the raw profiles join data
  delete (feedback as unknown as Record<string, unknown>).profiles;

  return { feedback, error: null };
}

/**
 * Gets feedback list with filtering, sorting, and pagination
 */
export async function getFeedbackList(
  supabase: SupabaseClient,
  params: GetFeedbackParams = {},
  currentUserId?: string
): Promise<FeedbackListResponse> {
  const {
    type,
    status,
    sort = 'newest',
    search,
    page = 1,
    limit = 20,
  } = params;

  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('feedback')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          profile_image_url
        )
      `, { count: 'exact' });

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'most_votes':
        query = query.order('vote_score', { ascending: false });
        break;
      case 'least_votes':
        query = query.order('vote_score', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[FeedbackService] Error fetching feedback list', { error: error instanceof Error ? error.message : String(error) });
      return { items: [], total: 0, page, limit, hasMore: false };
    }

    // Get current user's votes if logged in
    let userVotes: Record<string, number> = {};
    if (currentUserId && data && data.length > 0) {
      const feedbackIds = data.map(f => f.id);
      const { data: votesData } = await supabase
        .from('feedback_votes')
        .select('feedback_id, vote')
        .eq('user_id', currentUserId)
        .in('feedback_id', feedbackIds);

      if (votesData) {
        userVotes = votesData.reduce((acc, v) => {
          acc[v.feedback_id] = v.vote;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Format the response
    const items: FeedbackWithAuthor[] = (data || []).map(item => {
      const feedback: FeedbackWithAuthor = {
        ...item,
        author: item.is_anonymous ? null : {
          id: item.profiles?.id,
          username: item.profiles?.username,
          full_name: item.profiles?.full_name,
          profile_image_url: item.profiles?.profile_image_url,
        },
        user_vote: userVotes[item.id] ?? null,
      };
      delete (feedback as unknown as Record<string, unknown>).profiles;
      return feedback;
    });

    const total = count || 0;
    const hasMore = offset + items.length < total;

    return { items, total, page, limit, hasMore };
  } catch (err) {
    logger.error('[FeedbackService] Unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return { items: [], total: 0, page, limit, hasMore: false };
  }
}

/**
 * Gets feedback submitted by a specific user
 */
export async function getUserFeedback(
  supabase: SupabaseClient,
  userId: string,
  params: GetFeedbackParams = {}
): Promise<FeedbackListResponse> {
  const {
    sort = 'newest',
    page = 1,
    limit = 20,
  } = params;

  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('feedback')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // Apply sorting
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'most_votes':
        query = query.order('vote_score', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('[FeedbackService] Error fetching user feedback', { error: error instanceof Error ? error.message : String(error) });
      return { items: [], total: 0, page, limit, hasMore: false };
    }

    // User's own feedback doesn't need author info lookup
    const items: FeedbackWithAuthor[] = (data || []).map(item => ({
      ...item,
      author: null, // Own feedback
      user_vote: null, // Can't vote on own feedback
    }));

    const total = count || 0;
    const hasMore = offset + items.length < total;

    return { items, total, page, limit, hasMore };
  } catch (err) {
    logger.error('[FeedbackService] Unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return { items: [], total: 0, page, limit, hasMore: false };
  }
}

/**
 * Updates feedback (only owner can update their own feedback)
 */
export async function updateFeedback(
  supabase: SupabaseClient,
  feedbackId: string,
  userId: string,
  payload: UpdateFeedbackPayload
): Promise<{ feedback: Feedback | null; error: string | null }> {
  const { data, error } = await supabase
    .from('feedback')
    .update({
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.is_public !== undefined && { is_public: payload.is_public }),
      ...(payload.is_anonymous !== undefined && { is_anonymous: payload.is_anonymous }),
    })
    .eq('id', feedbackId)
    .eq('user_id', userId) // Ensure user owns this feedback
    .select()
    .single();

  if (error) {
    logger.error('[FeedbackService] Error updating feedback', { error: error instanceof Error ? error.message : String(error) });
    return { feedback: null, error: error.message };
  }

  return { feedback: data as Feedback, error: null };
}

/**
 * Updates feedback status (admin operation)
 * Note: In production, add proper admin check
 */
export async function updateFeedbackStatus(
  supabase: SupabaseClient,
  feedbackId: string,
  adminUserId: string,
  payload: UpdateFeedbackStatusPayload
): Promise<{ feedback: Feedback | null; error: string | null }> {
  const { data, error } = await supabase
    .from('feedback')
    .update({
      status: payload.status,
      status_note: payload.status_note || null,
      status_changed_at: new Date().toISOString(),
      status_changed_by: adminUserId,
    })
    .eq('id', feedbackId)
    .select()
    .single();

  if (error) {
    logger.error('[FeedbackService] Error updating feedback status', { error: error instanceof Error ? error.message : String(error) });
    return { feedback: null, error: error.message };
  }

  return { feedback: data as Feedback, error: null };
}

/**
 * Deletes feedback (only owner can delete their own feedback)
 */
export async function deleteFeedback(
  supabase: SupabaseClient,
  feedbackId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('feedback')
    .delete()
    .eq('id', feedbackId)
    .eq('user_id', userId);

  if (error) {
    logger.error('[FeedbackService] Error deleting feedback', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// ============================================================================
// Voting Operations
// ============================================================================

/**
 * Vote on feedback (upvote, downvote, or remove vote)
 */
export async function voteFeedback(
  supabase: SupabaseClient,
  feedbackId: string,
  userId: string,
  vote: 1 | -1 | 0
): Promise<{ success: boolean; error: string | null }> {
  // First check if user owns this feedback (can't vote on own feedback)
  const { data: feedbackData, error: feedbackError } = await supabase
    .from('feedback')
    .select('user_id')
    .eq('id', feedbackId)
    .single();

  if (feedbackError) {
    logger.error('[FeedbackService] Error checking feedback ownership', { error: feedbackError instanceof Error ? feedbackError.message : String(feedbackError) });
    return { success: false, error: feedbackError.message };
  }

  if (feedbackData?.user_id === userId) {
    return { success: false, error: 'Cannot vote on your own feedback' };
  }

  // Check existing vote
  const { data: existingVote } = await supabase
    .from('feedback_votes')
    .select('id, vote')
    .eq('feedback_id', feedbackId)
    .eq('user_id', userId)
    .single();

  if (vote === 0) {
    // Remove vote
    if (existingVote) {
      const { error } = await supabase
        .from('feedback_votes')
        .delete()
        .eq('id', existingVote.id);

      if (error) {
        logger.error('[FeedbackService] Error removing vote', { error: error instanceof Error ? error.message : String(error) });
        return { success: false, error: error.message };
      }
    }
    return { success: true, error: null };
  }

  if (existingVote) {
    // Update existing vote
    if (existingVote.vote === vote) {
      // Same vote, no change needed
      return { success: true, error: null };
    }

    const { error } = await supabase
      .from('feedback_votes')
      .update({ vote })
      .eq('id', existingVote.id);

    if (error) {
      logger.error('[FeedbackService] Error updating vote', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error.message };
    }
  } else {
    // Create new vote
    const { error } = await supabase
      .from('feedback_votes')
      .insert({
        feedback_id: feedbackId,
        user_id: userId,
        vote,
      });

    if (error) {
      logger.error('[FeedbackService] Error creating vote', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error.message };
    }
  }

  return { success: true, error: null };
}

/**
 * Get user's vote for a specific feedback
 */
export async function getUserVote(
  supabase: SupabaseClient,
  feedbackId: string,
  userId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('feedback_votes')
    .select('vote')
    .eq('feedback_id', feedbackId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.vote;
}

// ============================================================================
// Prompt Management
// ============================================================================

/**
 * Check if prompts should be shown to user
 */
export async function getPromptStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<PromptStatusResponse> {
  const response: PromptStatusResponse = {
    showPostJourneyPrompt: false,
    showGeneralPrompt: false,
    showEngagementPrompt: false,
  };

  try {
    // Get user's dismissals
    const { data: dismissals } = await supabase
      .from('feedback_prompt_dismissals')
      .select('prompt_type, dismiss_until')
      .eq('user_id', userId);

    const now = new Date();
    const isDismissed = (promptType: string): boolean => {
      const dismissal = dismissals?.find(d => d.prompt_type === promptType);
      if (!dismissal) return false;
      if (!dismissal.dismiss_until) return true; // Dismissed forever
      return new Date(dismissal.dismiss_until) > now;
    };

    // Check post-journey prompt
    if (!isDismissed(FeedbackPromptType.POST_JOURNEY)) {
      // Check if user has completed a journey recently (within 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: completedLegs } = await supabase
        .from('registrations')
        .select(`
          leg_id,
          legs!inner (
            id,
            name,
            end_date,
            journeys!inner (
              id,
              name
            )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'Approved')
        .lte('legs.end_date', now.toISOString())
        .gte('legs.end_date', sevenDaysAgo.toISOString())
        .limit(1);

      if (completedLegs && completedLegs.length > 0) {
        // Supabase returns nested relations as arrays
        const legs = completedLegs[0].legs as unknown as Array<{
          id: string;
          name: string;
          end_date: string;
          journeys: Array<{ id: string; name: string }>;
        }>;
        if (legs && legs.length > 0 && legs[0].journeys && legs[0].journeys.length > 0) {
          const leg = legs[0];
          const journey = leg.journeys[0];
          response.showPostJourneyPrompt = true;
          response.postJourneyContext = {
            journey_id: journey.id,
            journey_name: journey.name,
            leg_name: leg.name,
          };
        }
      }
    }

    // Check general prompt (show every 30 days if user hasn't submitted feedback)
    if (!isDismissed(FeedbackPromptType.GENERAL)) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentFeedback, count } = await supabase
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      response.showGeneralPrompt = (count || 0) === 0;
    }

    return response;
  } catch (err) {
    logger.error('[FeedbackService] Error checking prompt status', { error: err instanceof Error ? err.message : String(err) });
    return response;
  }
}

/**
 * Dismiss a feedback prompt
 */
export async function dismissPrompt(
  supabase: SupabaseClient,
  userId: string,
  payload: DismissPromptPayload
): Promise<{ success: boolean; error: string | null }> {
  const dismissUntil = payload.dismiss_days
    ? new Date(Date.now() + payload.dismiss_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Upsert the dismissal
  const { error } = await supabase
    .from('feedback_prompt_dismissals')
    .upsert({
      user_id: userId,
      prompt_type: payload.prompt_type,
      dismissed_at: new Date().toISOString(),
      dismiss_until: dismissUntil,
    }, {
      onConflict: 'user_id,prompt_type',
    });

  if (error) {
    logger.error('[FeedbackService] Error dismissing prompt', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get feedback statistics (for admin dashboard or public stats)
 */
export async function getFeedbackStats(
  supabase: SupabaseClient
): Promise<{
  total: number;
  byType: Record<FeedbackType, number>;
  byStatus: Record<FeedbackStatus, number>;
}> {
  const stats = {
    total: 0,
    byType: {
      [FeedbackType.BUG]: 0,
      [FeedbackType.FEATURE]: 0,
      [FeedbackType.IMPROVEMENT]: 0,
      [FeedbackType.OTHER]: 0,
    },
    byStatus: {
      [FeedbackStatus.NEW]: 0,
      [FeedbackStatus.UNDER_REVIEW]: 0,
      [FeedbackStatus.PLANNED]: 0,
      [FeedbackStatus.IN_PROGRESS]: 0,
      [FeedbackStatus.COMPLETED]: 0,
      [FeedbackStatus.DECLINED]: 0,
    },
  };

  try {
    // Get total count
    const { count: totalCount } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true);

    stats.total = totalCount || 0;

    // Get counts by type
    for (const type of Object.values(FeedbackType)) {
      const { count } = await supabase
        .from('feedback')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('type', type);

      stats.byType[type] = count || 0;
    }

    // Get counts by status
    for (const status of Object.values(FeedbackStatus)) {
      const { count } = await supabase
        .from('feedback')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('status', status);

      stats.byStatus[status] = count || 0;
    }

    return stats;
  } catch (err) {
    logger.error('[FeedbackService] Error getting stats', { error: err instanceof Error ? err.message : String(err) });
    return stats;
  }
}
