/**
 * Server-side redirect helpers
 * Use in API routes and server components
 */

import { redirectService } from './redirectService';
import { buildRedirectContext } from './redirectContext';
import type { RedirectSource, RedirectContext } from './redirectTypes';
import { getSupabaseServerClient } from '../supabaseServer';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side redirect helper (for API routes)
 * Use in Next.js API routes and server components
 */
export async function getRedirectResponse(
  userId: string,
  source: RedirectSource,
  request: Request,
  additionalContext?: Partial<RedirectContext>,
  supabase?: SupabaseClient
): Promise<Response> {
  const { NextResponse } = await import('next/server');
  
  // If supabase client not provided, use server client
  const client = supabase || await getSupabaseServerClient();
  
  const context = await buildRedirectContext(userId, source, additionalContext, client);
  const result = await redirectService.determineRedirect(context);

  const url = result.queryParams
    ? `${result.path}?${new URLSearchParams(result.queryParams).toString()}`
    : result.path;

  console.log(`[RedirectService] ${result.reason} (priority ${result.priority}): ${url}`);
  return NextResponse.redirect(new URL(url, request.url));
}

/**
 * Server-side version of shouldStayOnHomepage
 */
export async function shouldStayOnHomepageServer(
  userId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase || await getSupabaseServerClient();
  const context = await buildRedirectContext(userId, 'root', undefined, client);
  const result = await redirectService.determineRedirect(context);

  // Stay on homepage if there's a pending onboarding session
  return (
    result.reason === 'pending_owner_onboarding' ||
    result.reason === 'pending_prospect_onboarding'
  );
}

/**
 * Server-side version of getRedirectPath
 */
export async function getRedirectPathServer(
  userId: string,
  source: RedirectSource,
  additionalContext?: Partial<RedirectContext>,
  supabase?: SupabaseClient
): Promise<string> {
  const client = supabase || await getSupabaseServerClient();
  const context = await buildRedirectContext(userId, source, additionalContext, client);
  const result = await redirectService.determineRedirect(context);

  return result.queryParams
    ? `${result.path}?${new URLSearchParams(result.queryParams).toString()}`
    : result.path;
}
