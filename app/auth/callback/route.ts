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

      // Get user profile to determine redirect
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Profile is optional - don't create automatically
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles')
        .eq('id', user.id)
        .single();

      // Determine redirect based on profile and roles
      let redirectPath = '/'; // Default to home
      
      if (profile && profile.roles && profile.roles.length > 0) {
        // User has roles - redirect based on primary role
        if (profile.roles.includes('owner')) {
          redirectPath = origin + '/owner/journeys';
        } else if (profile.roles.includes('crew')) {
          redirectPath = origin + '/crew/dashboard';
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
