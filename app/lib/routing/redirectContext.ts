/**
 * Context builder for redirect decisions
 * Assembles all required data for redirect logic
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedirectContext, RedirectSource } from './redirectTypes';

/**
 * Fetch user profile
 */
async function fetchProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<{ roles: string[]; username?: string | null } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('roles, username')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[RedirectContext] Error fetching profile:', error);
    return null;
  }

  return data || null;
}

/**
 * Check for pending owner onboarding session
 */
async function checkPendingOwnerSession(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('owner_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .in('onboarding_state', [
      'signup_pending',
      'consent_pending',
      'profile_pending',
      'boat_pending',
      'journey_pending',
    ])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RedirectContext] Error checking pending owner session:', error);
    return false;
  }

  return !!data;
}

/**
 * Check for pending prospect onboarding session
 */
async function checkPendingProspectSession(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('prospect_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .in('onboarding_state', ['signup_pending', 'consent_pending', 'profile_pending'])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RedirectContext] Error checking pending prospect session:', error);
    return false;
  }

  return !!data;
}

/**
 * Check if owner profile completion was triggered
 */
async function checkOwnerProfileCompletionTriggered(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('owner_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .not('profile_completion_triggered_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RedirectContext] Error checking owner profile completion:', error);
    return false;
  }

  return !!data;
}

/**
 * Check if prospect profile completion was triggered
 */
async function checkProspectProfileCompletionTriggered(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('prospect_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .not('profile_completion_triggered_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RedirectContext] Error checking prospect profile completion:', error);
    return false;
  }

  return !!data;
}

/**
 * Check for existing owner conversation
 */
async function checkExistingOwnerConversation(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('owner_sessions')
    .select('session_id, conversation')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RedirectContext] Error checking existing owner conversation:', error);
    return false;
  }

  return !!(data?.conversation && Array.isArray(data.conversation) && data.conversation.length > 0);
}

/**
 * Check for existing prospect conversation
 */
async function checkExistingProspectConversation(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('prospect_sessions')
    .select('session_id, conversation')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RedirectContext] Error checking existing prospect conversation:', error);
    return false;
  }

  return !!(data?.conversation && Array.isArray(data.conversation) && data.conversation.length > 0);
}

/**
 * Build redirect context from user ID and source
 * Fetches all required data in parallel for performance
 */
export async function buildRedirectContext(
  userId: string,
  source?: RedirectSource,
  additionalData?: Partial<RedirectContext>,
  supabase?: SupabaseClient
): Promise<RedirectContext> {
  // If supabase client is not provided, we need to determine if we're on server or client
  // For now, we'll require it to be passed in - callers should use appropriate client
  if (!supabase) {
    throw new Error('Supabase client is required. Use getSupabaseServerClient() or getSupabaseBrowserClient()');
  }

  // Parallel fetch all required data
  const [
    profile,
    pendingOwnerSession,
    pendingProspectSession,
    ownerProfileCompletionTriggered,
    prospectProfileCompletionTriggered,
    existingOwnerConversation,
    existingProspectConversation,
  ] = await Promise.all([
    fetchProfile(userId, supabase),
    checkPendingOwnerSession(userId, supabase),
    checkPendingProspectSession(userId, supabase),
    checkOwnerProfileCompletionTriggered(userId, supabase),
    checkProspectProfileCompletionTriggered(userId, supabase),
    checkExistingOwnerConversation(userId, supabase),
    checkExistingProspectConversation(userId, supabase),
  ]);

  return {
    userId,
    source,
    profile: profile || undefined,
    pendingOwnerSession,
    pendingProspectSession,
    ownerProfileCompletionTriggered,
    prospectProfileCompletionTriggered,
    existingOwnerConversation,
    existingProspectConversation,
    isNewUser: !profile || !profile.username,
    ...additionalData,
  };
}
