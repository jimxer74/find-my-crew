/**
 * Client-side redirect helpers
 * Use in React components (marked with 'use client')
 */

import { redirectService } from './redirectService';
import { buildRedirectContext } from './redirectContext';
import type { RedirectSource, RedirectContext } from './redirectTypes';
import { getSupabaseBrowserClient } from '../supabaseClient';

/**
 * Client-side redirect helper
 * Use in React components after authentication
 */
export async function redirectAfterAuth(
  userId: string,
  source: RedirectSource,
  router: {
    push: (url: string) => void;
    refresh: () => void;
  },
  additionalContext?: Partial<RedirectContext>
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const context = await buildRedirectContext(userId, source, additionalContext, supabase);
  const result = await redirectService.determineRedirect(context);

  const url = result.queryParams
    ? `${result.path}?${new URLSearchParams(result.queryParams).toString()}`
    : result.path;

  logger.debug(`[RedirectService] ${result.reason} (priority ${result.priority}): ${url}`);
  router.push(url);
  router.refresh();
}

/**
 * Check if user should stay on homepage (for root route)
 * Returns true if user has pending onboarding session
 */
export async function shouldStayOnHomepage(userId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const context = await buildRedirectContext(userId, 'root', undefined, supabase);
  const result = await redirectService.determineRedirect(context);

  // Stay on homepage if there's a pending onboarding session
  return (
    result.reason === 'pending_owner_onboarding' ||
    result.reason === 'pending_prospect_onboarding'
  );
}

/**
 * Get redirect path without performing redirect
 * Useful for conditional logic or logging
 */
export async function getRedirectPath(
  userId: string,
  source: RedirectSource,
  additionalContext?: Partial<RedirectContext>
): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const context = await buildRedirectContext(userId, source, additionalContext, supabase);
  const result = await redirectService.determineRedirect(context);

  return result.queryParams
    ? `${result.path}?${new URLSearchParams(result.queryParams).toString()}`
    : result.path;
}
