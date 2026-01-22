import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

export interface ProfileStatus {
  exists: boolean;
  hasRoles: boolean;
  roles: string[];
  completionPercentage: number;
}

/**
 * Check if user has a profile and get profile status
 * @param userId - User ID
 * @returns Profile status information
 */
export async function checkProfile(userId: string): Promise<ProfileStatus> {
  const supabase = getSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('roles, profile_completion_percentage')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return {
      exists: false,
      hasRoles: false,
      roles: [],
      completionPercentage: 0,
    };
  }

  const roles = data.roles || [];
  
  return {
    exists: true,
    hasRoles: roles.length > 0,
    roles,
    completionPercentage: data.profile_completion_percentage || 0,
  };
}
