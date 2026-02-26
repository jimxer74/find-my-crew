import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getRedirectPathServer, shouldStayOnHomepageServer } from '@shared/lib/routing/redirectHelpers.server';

/**
 * Middleware for handling redirects
 * Runs BEFORE page renders, preventing flash of content
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle OAuth fallback: when Supabase can't validate redirectTo (e.g. allowed redirect URLs
  // list doesn't include query params), it falls back to the Site URL and the OAuth code lands
  // at /?code=... instead of /auth/callback?code=...  Forward it to the callback route so the
  // server-side PKCE exchange still happens.
  if (pathname === '/') {
    const code = request.nextUrl.searchParams.get('code');
    if (code) {
      const callbackUrl = new URL('/auth/callback', request.url);
      request.nextUrl.searchParams.forEach((value, key) => {
        callbackUrl.searchParams.set(key, value);
      });
      console.log('[Middleware] Forwarding OAuth code from / to /auth/callback');
      return NextResponse.redirect(callbackUrl);
    }
  }

  // Skip middleware for:
  // - API routes
  // - Static files (_next, images, etc.)
  // - Auth callback (handles its own redirects)
  // NOTE: NOT skipping /welcome/* anymore - need to refresh session there for OAuth
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/owner/') ||
    pathname.startsWith('/crew/') ||
    pathname.startsWith('/assistant') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Only check redirects for root path (/) or welcome paths (for OAuth session sync)
  if (pathname !== '/' && !pathname.startsWith('/welcome/')) {
    return NextResponse.next();
  }

  try {
    // Create response object first (needed for cookie handling)
    const response = NextResponse.next();
    
    // Create Supabase client with proper cookie handling for middleware
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Update both request and response cookies
            // Request cookies: for subsequent Server Component operations
            // Response cookies: sent back to client to persist changes
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Refresh session if needed (this updates cookies automatically)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // If not authenticated, allow access to homepage
    if (!user || authError) {
      return response;
    }

    // Check if user should stay on homepage (has pending onboarding)
    // Use Promise.race with timeout to prevent middleware from hanging
    const shouldStayPromise = shouldStayOnHomepageServer(user.id, supabase);
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 2000); // 2 second timeout
    });
    const shouldStay = await Promise.race([shouldStayPromise, timeoutPromise]);
    
    if (shouldStay) {
      // User has pending onboarding - allow access to homepage
      return response;
    }

    // User is authenticated and should be redirected
    // Get redirect path from redirect service (with timeout)
    const redirectPathPromise = getRedirectPathServer(user.id, 'root', undefined, supabase);
    const redirectTimeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('/'), 2000); // 2 second timeout - fallback to homepage
    });
    const redirectPath = await Promise.race([redirectPathPromise, redirectTimeoutPromise]);

    // Only redirect if path is different from current
    if (redirectPath && redirectPath !== '/') {
      const redirectUrl = new URL(redirectPath, request.url);
      console.log(`[Middleware] Redirecting authenticated user from / to ${redirectPath}`);
      
      // Create redirect response with updated cookies
      const redirectResponse = NextResponse.redirect(redirectUrl);
      // Copy any cookies that were set during Supabase operations
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      
      return redirectResponse;
    }

    // No redirect needed - allow access with updated cookies
    return response;
  } catch (error) {
    // If middleware fails, log error but don't block request
    // Fallback to client-side redirect
    console.error('[Middleware] Error checking redirect:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};
