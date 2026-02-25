// lib/supabaseServer.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get Supabase server client with auth session support
 * Use this when you need authenticated user access
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called in a Server Component where setting cookies is not supported.
            // Supabase will handle setting cookies in the browser instead.
          }
        },
      },
    }
  );
}

/**
 * Get Supabase client for unauthenticated operations
 * Use this for prospect sessions and other public data access
 * This doesn't require auth cookies and won't throw errors for missing sessions
 */
export function getSupabaseUnauthenticatedClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Get Supabase service role client - bypasses RLS
 * Use ONLY when cookie/session proves ownership and user is logged out
 * (e.g. updating session with user_id when user logged out after signup)
 */
export function getSupabaseServiceRoleClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service role operations');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}