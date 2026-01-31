import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { fetchAllUserData, validateAccessToken } from '@/app/lib/facebook/graphApi';

export async function GET(request: NextRequest) {
  try {
    // Get the Facebook access token from the secure cookie
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('fb_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Facebook access token not found' },
        { status: 401 }
      );
    }

    // Validate the user is authenticated with Supabase
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only in this context
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Validate the Facebook access token
    const isValid = await validateAccessToken(accessToken);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Facebook access token is invalid or expired' },
        { status: 401 }
      );
    }

    // Fetch all available Facebook data
    const facebookData = await fetchAllUserData(accessToken);

    return NextResponse.json({
      success: true,
      data: facebookData,
      hasProfile: !!facebookData.profile,
      hasPosts: facebookData.posts.length > 0,
      hasLikes: facebookData.likes.length > 0,
    });
  } catch (error) {
    console.error('Error fetching Facebook data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Facebook data' },
      { status: 500 }
    );
  }
}
