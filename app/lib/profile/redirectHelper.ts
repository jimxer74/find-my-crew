/**
 * Profile Redirect Helper
 *
 * Utility functions for handling profile-related redirects with onboarding session awareness.
 * This ensures users with active onboarding sessions are redirected to the appropriate
 * onboarding chat pages instead of the profile page.
 */

import { getSupabaseBrowserClient } from '../supabaseClient';

export type OnboardingSessionType = 'owner' | 'prospect' | null;

/**
 * Check if user has an active onboarding session
 * @param userId The user ID to check
 * @returns The session type if found, null otherwise
 */
export async function checkOnboardingSession(userId: string): Promise<OnboardingSessionType> {
  const supabase = getSupabaseBrowserClient();

  // Check for owner onboarding session with pending states
  const { data: ownerSession } = await supabase
    .from('owner_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .in('onboarding_state', ['profile_pending', 'boat_pending', 'journey_pending'])
    .limit(1)
    .maybeSingle();

  if (ownerSession) {
    return 'owner';
  }

  // Check for prospect onboarding session with pending states
  const { data: prospectSession } = await supabase
    .from('prospect_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .eq('onboarding_state', 'profile_pending')
    .limit(1)
    .maybeSingle();

  if (prospectSession) {
    return 'prospect';
  }

  return null;
}

/**
 * Get the appropriate redirect URL for profile actions
 * @param userId The user ID
 * @param isSetup Whether this is for initial profile setup (/profile-setup)
 * @returns The URL to redirect to (onboarding page or profile page)
 */
export async function getProfileRedirectUrl(userId: string, isSetup = false): Promise<string> {
  const sessionType = await checkOnboardingSession(userId);

  if (sessionType === 'owner') {
    return '/welcome/owner';
  }

  if (sessionType === 'prospect') {
    return '/welcome/crew';
  }

  // If no onboarding session, go to the appropriate profile page
  return isSetup ? '/profile-setup' : '/profile';
}

/**
 * Perform redirect for profile actions with setup awareness
 * @param userId The user ID
 * @param router The Next.js router instance
 * @param isSetup Whether this is for initial profile setup
 */
export async function redirectToProfileOrOnboarding(userId: string, router: any, isSetup = false): Promise<void> {
  const redirectUrl = await getProfileRedirectUrl(userId, isSetup);
  router.push(redirectUrl);
}


/**
 * Hook for components that need profile redirect functionality
 * Provides functions to handle profile redirects with onboarding awareness
 */
export function useProfileRedirect() {
  const checkSession = async (userId: string): Promise<OnboardingSessionType> => {
    return checkOnboardingSession(userId);
  };

  const getRedirectUrl = async (userId: string, isSetup = false): Promise<string> => {
    return getProfileRedirectUrl(userId, isSetup);
  };

  const handleRedirect = async (userId: string, router: any, isSetup = false): Promise<void> => {
    await redirectToProfileOrOnboarding(userId, router, isSetup);
  };

  return {
    checkSession,
    getRedirectUrl,
    handleRedirect,
  };
}