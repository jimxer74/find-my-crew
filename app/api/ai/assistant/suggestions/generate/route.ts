import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  generateSuggestionsForNewLeg,
  generateSuggestionsForUser,
} from '@/app/lib/ai/assistant/matching';

// POST /api/ai/assistant/suggestions/generate - Generate suggestions
export async function POST(request: NextRequest) {
  try {
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
              // Read-only
            }
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

    const body = await request.json();
    const { type, legId, userId } = body;

    let count = 0;

    switch (type) {
      case 'leg':
        // Generate suggestions for users matching a new leg
        // This should be called by the journey owner or a background job
        if (!legId) {
          return NextResponse.json(
            { error: 'legId is required for type=leg' },
            { status: 400 }
          );
        }
        count = await generateSuggestionsForNewLeg(supabase, legId);
        break;

      case 'user':
        // Generate suggestions for a user based on their profile
        // Uses the authenticated user if no userId provided
        const targetUserId = userId || user.id;
        count = await generateSuggestionsForUser(supabase, targetUserId);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use "leg" or "user"' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      suggestionsCreated: count,
    });
  } catch (error: any) {
    console.error('Generate suggestions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
