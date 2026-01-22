import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

/**
 * Get user roles from profile
 * @param userId - User ID
 * @returns Array of roles or null if profile doesn't exist
 */
export async function getUserRoles(userId: string): Promise<string[] | null> {
  const supabase = getSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.roles || [];
}

/**
 * Get user roles from User object (server-side)
 */
export async function getUserRolesFromUser(user: User | null): Promise<string[] | null> {
  if (!user) return null;
  return getUserRoles(user.id);
}
