import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * GET /api/journeys/[journeyId]/details
 *
 * Retrieves journey details including description, boat experience fields,
 * and safety equipment summary.
 * Public access if journey is published, otherwise owner only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const journeyId = resolvedParams.journeyId;

    logger.info('[JourneyDetailsAPI] Fetching journey details for:', { journeyId });

    const supabase = await getSupabaseServerClient();

    // Get authenticated user (optional for public access)
    const { data: { user } } = await supabase.auth.getUser();

    // Get the journey with all relevant fields
    const { data: journey, error: journeyError } = await supabase
      .from('journeys')
      .select('id, name, description, state, boat_id, cost_info')
      .eq('id', journeyId)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json(
        sanitizeErrorResponse(journeyError, 'Journey not found'),
        { status: 404 }
      );
    }

    // Get the boat owner info + experience fields
    const { data: boatInfo, error: boatError } = await supabase
      .from('boats')
      .select('owner_id, miles_on_vessel, offshore_passage_experience')
      .eq('id', journey.boat_id)
      .single();

    if (boatError || !boatInfo) {
      return NextResponse.json(
        sanitizeErrorResponse(boatError, 'Boat not found'),
        { status: 404 }
      );
    }

    // Check access: public if published, otherwise owner only
    if (journey.state !== 'Published') {
      if (!user || boatInfo.owner_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Fetch safety equipment records for this boat (category = 'safety')
    const { data: safetyEquipment } = await supabase
      .from('boat_equipment')
      .select('id, name, subcategory, status, service_date, next_service_date, expiry_date')
      .eq('boat_id', journey.boat_id)
      .eq('category', 'safety')
      .eq('status', 'active')
      .order('name');

    return NextResponse.json({
      journey_id: journey.id,
      journey_name: journey.name,
      journey_description: journey.description,
      journey_cost_info: journey.cost_info ?? null,
      state: journey.state,
      boat_miles_on_vessel: boatInfo.miles_on_vessel ?? null,
      boat_offshore_passage_experience: boatInfo.offshore_passage_experience ?? false,
      safety_equipment: safetyEquipment ?? [],
    });

  } catch (error: any) {
    logger.error('Unexpected error in journey details GET API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
