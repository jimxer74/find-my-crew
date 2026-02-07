import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code');
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

      // Profile is optional - don't create automatically
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles, username')
        .eq('id', user.id)
        .single();

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

      // Determine redirect based on profile and roles
      let redirectPath = '/'; // Default to home

      if (profile && profile.roles && profile.roles.length > 0) {
        // User has roles - redirect based on primary role
        if (profile.roles.includes('owner')) {
          redirectPath = origin + '/owner/journeys';
        } else if (profile.roles.includes('crew')) {
          redirectPath = origin + '/crew/home';
        }
      }
      // If no profile or no roles, redirect to home (can browse limited)
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
