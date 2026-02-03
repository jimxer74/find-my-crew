import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * GET /api/journeys/[journeyId]/details
 *
 * Retrieves journey details including description.
 * Public access if journey is published, otherwise owner only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const journeyId = resolvedParams.journeyId;

    console.log('[JourneyDetailsAPI] Fetching journey details for:', journeyId);

    const supabase = await getSupabaseServerClient();

    // Get authenticated user (optional for public access)
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[JourneyDetailsAPI] Authenticated user:', user?.id || 'None');

    // First, try to get the journey without the boat join to see if it exists
    const { data: journeyBasic, error: basicError } = await supabase
      .from('journeys')
      .select('id, name, description, state, boat_id')
      .eq('id', journeyId)
      .single();

    console.log('[JourneyDetailsAPI] Basic journey query result:', { journeyBasic, basicError });

    if (basicError || !journeyBasic) {
      return NextResponse.json(
        { error: 'Journey not found', details: basicError?.message },
        { status: 404 }
      );
    }

    // Now get the boat owner info
    const { data: boatInfo, error: boatError } = await supabase
      .from('boats')
      .select('owner_id')
      .eq('id', journeyBasic.boat_id)
      .single();

    console.log('[JourneyDetailsAPI] Boat info query result:', { boatInfo, boatError });

    if (boatError || !boatInfo) {
      return NextResponse.json(
        { error: 'Boat not found', details: boatError?.message },
        { status: 404 }
      );
    }

    // Check access: public if published, otherwise owner only
    if (journeyBasic.state !== 'Published') {
      if (!user || boatInfo.owner_id !== user.id) {
        console.log('[JourneyDetailsAPI] Access denied - not published and not owner:', {
          journeyState: journeyBasic.state,
          user: user?.id,
          boatOwner: boatInfo.owner_id
        });
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[JourneyDetailsAPI] Access granted, returning journey data');

    return NextResponse.json({
      journey_id: journeyBasic.id,
      journey_name: journeyBasic.name,
      journey_description: journeyBasic.description,
      state: journeyBasic.state,
    });

  } catch (error: any) {
    console.error('Unexpected error in journey details GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}