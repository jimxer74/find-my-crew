import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

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

    await supabase.auth.exchangeCodeForSession(code);

    // Get user profile to determine redirect
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // If no profile exists, create one (for OAuth users)
      if (!profile) {
        await supabase.from('profiles').insert({
          id: user.id,
          role: 'crew', // Default role
          username: user.email?.split('@')[0] || 'user',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        });
      }

      const redirectPath = profile?.role === 'owner' 
        ? '/owner/dashboard' 
        : '/crew/dashboard';
      
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
  }

  // Default redirect to home if something goes wrong
  return NextResponse.redirect(new URL('/', request.url));
}
