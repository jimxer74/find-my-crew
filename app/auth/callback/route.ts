import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code');
  const from = searchParams.get('from'); // Track signup source (e.g., 'prospect')
  let next = searchParams.get('next') ?? '/'
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/'
  }
  console.log('LOGIN CALLBACK:', request);

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
              // Server component - cookies handled by middleware
            }
          },
        },
      }
    );

    const exchangeResult = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeResult.error) {
      console.error('LOGIN CALLBACK, error exchanging code for session:', exchangeResult.error);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Get user and session info
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();

    if (user) {
      // Check if this is a Facebook login by looking at the provider
      const isFacebookLogin = user.app_metadata?.provider === 'facebook' ||
        user.identities?.some(identity => identity.provider === 'facebook');

      // Check if this user has prospect preferences to sync (from in-chat signup)
      const prospectPreferences = user.user_metadata?.prospect_preferences;
      const isFromProspect = from === 'prospect' || !!prospectPreferences;

      // Profile is optional - don't create automatically
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles, username, sailing_experience, skills, risk_level, sailing_preferences')
        .eq('id', user.id)
        .single();

      // If user came from prospect signup and has preferences, sync them to profile
      if (isFromProspect && prospectPreferences && profile) {
        const updates: Record<string, unknown> = {};

        // Map prospect preferences to profile fields
        if (prospectPreferences.experienceLevel && !profile.sailing_experience) {
          updates.sailing_experience = prospectPreferences.experienceLevel;
        }
        if (prospectPreferences.skills?.length && (!profile.skills || profile.skills.length === 0)) {
          updates.skills = prospectPreferences.skills;
        }
        if (prospectPreferences.riskLevels?.length && (!profile.risk_level || profile.risk_level.length === 0)) {
          // Map risk level strings to enum values
          const riskLevelMap: Record<string, string> = {
            'coastal': 'Coastal sailing',
            'offshore': 'Offshore sailing',
            'extreme': 'Extreme sailing',
            'Coastal sailing': 'Coastal sailing',
            'Offshore sailing': 'Offshore sailing',
            'Extreme sailing': 'Extreme sailing',
          };
          const mappedRiskLevels = prospectPreferences.riskLevels
            .map((r: string) => riskLevelMap[r] || r)
            .filter((r: string) => ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'].includes(r));
          if (mappedRiskLevels.length > 0) {
            updates.risk_level = mappedRiskLevels;
          }
        }
        if (prospectPreferences.sailingGoals && !profile.sailing_preferences) {
          updates.sailing_preferences = prospectPreferences.sailingGoals;
        }

        // Update profile if there are changes
        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);
          console.log('LOGIN CALLBACK, synced prospect preferences to profile:', updates);
        }
      }

      // Check if user is new (no profile or incomplete profile)
      const isNewUser = !profile || !profile.username;

      // If new Facebook user, redirect to profile setup wizard with provider token
      if (isFacebookLogin && isNewUser && session?.provider_token) {
        // Store the Facebook access token in a secure, short-lived cookie for the profile setup page
        const response = NextResponse.redirect(new URL('/profile-setup', request.url));
        response.cookies.set('fb_access_token', session.provider_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 300, // 5 minutes - short-lived for security
          path: '/',
        });
        console.log('LOGIN CALLBACK, new Facebook user - redirecting to profile setup');
        return response;
      }

      // Determine redirect based on context and profile
      // Always redirect to role-specific homepage
      let redirectPath = '/crew'; // Default to crew homepage

      // If user came from prospect chat, redirect back to chat with profile completion mode
      if (isFromProspect) {
        redirectPath = '/welcome/chat?profile_completion=true';
        console.log('LOGIN CALLBACK, prospect user - redirecting to chat for profile completion');
      } else if (profile && profile.roles && profile.roles.length > 0) {
        // User has roles - redirect based on primary role
        // Priority: owner > crew (if user has both roles)
        if (profile.roles.includes('owner')) {
          redirectPath = '/owner/dashboard';
        } else if (profile.roles.includes('crew')) {
          redirectPath = '/crew';
        }
      }
      // If no profile or no roles, default to crew homepage
      let url = new URL(redirectPath, request.url)
      console.log('LOGIN CALLBACK, user found', url);

      return NextResponse.redirect(url);
    }
  }
  let url = new URL(origin + '/', request.url)
  console.log('LOGIN CALLBACK, user not found:', url);

  // Default redirect to home if something goes wrong
  return NextResponse.redirect(url);
}
