import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';

/**
 * GET /api/journeys/[journeyId]/legs
 *
 * Returns all published legs for a journey, with start/end waypoints.
 * Used by the crew dashboard map "View Journey" feature.
 * Public access for published journeys.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { journeyId } = resolvedParams;

    const supabase = await getSupabaseServerClient();

    // Verify journey exists and is published
    const { data: journey, error: journeyError } = await supabase
      .from('journeys')
      .select('id, name, state, risk_level, images, boat_id, cost_model')
      .eq('id', journeyId)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json(sanitizeErrorResponse(journeyError, 'Journey not found'), { status: 404 });
    }

    if (journey.state !== 'Published') {
      return NextResponse.json({ error: 'Journey is not published' }, { status: 403 });
    }

    // Fetch all legs for the journey
    const { data: legs, error: legsError } = await supabase
      .from('legs')
      .select(`
        id,
        name,
        description,
        start_date,
        end_date,
        crew_needed,
        risk_level,
        skills,
        min_experience_level
      `)
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: true });

    if (legsError) {
      logger.error('[JourneyLegsAPI] Failed to fetch legs:', { error: legsError.message });
      return NextResponse.json(sanitizeErrorResponse(legsError, 'Failed to fetch legs'), { status: 500 });
    }

    if (!legs || legs.length === 0) {
      return NextResponse.json({ legs: [], count: 0 });
    }

    // Fetch boat + owner info
    const { data: boat } = await supabase
      .from('boats')
      .select('id, name, boat_type, images, average_speed_knots, make_model, owner_id')
      .eq('id', journey.boat_id)
      .single();

    let ownerName: string | null = null;
    let ownerImageUrl: string | null = null;
    if (boat?.owner_id) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name, profile_image_url')
        .eq('id', boat.owner_id)
        .single();
      ownerName = ownerProfile?.full_name ?? null;
      ownerImageUrl = ownerProfile?.profile_image_url ?? null;
    }

    const legIds = legs.map((l) => l.id);

    // Fetch start waypoints (index = 0) for all legs
    let startWaypoints: any[] | null = null;
    try {
      const { data } = await supabase
        .rpc('get_leg_waypoints_batch', { leg_ids: legIds })
        .select();
      startWaypoints = data;
    } catch {
      startWaypoints = null;
    }

    // Fallback: query waypoints table directly if RPC doesn't exist
    let waypointsByLegId: Record<string, { start: { lng: number; lat: number; name: string | null } | null; end: { lng: number; lat: number; name: string | null } | null }> = {};

    if (!startWaypoints) {
      // Direct query: get index=0 (start) and max index (end) per leg
      const { data: allWaypoints } = await supabase
        .from('waypoints')
        .select('leg_id, index, name, location')
        .in('leg_id', legIds)
        .order('index', { ascending: true });

      if (allWaypoints) {
        for (const wp of allWaypoints) {
          if (!waypointsByLegId[wp.leg_id]) {
            waypointsByLegId[wp.leg_id] = { start: null, end: null };
          }
          const coords = wp.location?.coordinates;
          if (!coords) continue;
          const point = { lng: coords[0], lat: coords[1], name: wp.name ?? null };
          if (wp.index === 0) {
            waypointsByLegId[wp.leg_id].start = point;
          }
          // Always update end to last waypoint (highest index)
          waypointsByLegId[wp.leg_id].end = point;
        }
      }
    }

    // Build response matching Leg type in CrewBrowseMap
    const transformedLegs = legs.map((leg) => ({
      leg_id: leg.id,
      leg_name: leg.name,
      leg_description: leg.description ?? null,
      journey_id: journeyId,
      journey_name: journey.name,
      start_date: leg.start_date ?? null,
      end_date: leg.end_date ?? null,
      crew_needed: leg.crew_needed ?? null,
      leg_risk_level: leg.risk_level ?? null,
      journey_risk_level: journey.risk_level ?? null,
      cost_model: journey.cost_model ?? null,
      journey_images: journey.images ?? [],
      skills: leg.skills ?? [],
      boat_id: journey.boat_id,
      boat_name: boat?.name ?? '',
      boat_type: boat?.boat_type ?? null,
      boat_image_url: boat?.images?.[0] ?? null,
      boat_average_speed_knots: boat?.average_speed_knots ?? null,
      boat_make_model: boat?.make_model ?? null,
      owner_name: ownerName,
      owner_image_url: ownerImageUrl,
      min_experience_level: leg.min_experience_level ?? null,
      start_waypoint: waypointsByLegId[leg.id]?.start ?? null,
      end_waypoint: waypointsByLegId[leg.id]?.end ?? null,
    }));

    return NextResponse.json({ legs: transformedLegs, count: transformedLegs.length });
  } catch (error: any) {
    logger.error('[JourneyLegsAPI] Unexpected error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Internal server error'), { status: 500 });
  }
}
