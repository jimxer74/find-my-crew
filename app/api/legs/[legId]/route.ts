import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';

/**
 * GET /api/legs/[legId]
 *
 * Returns a single leg with its journey, boat, owner, and waypoint details.
 * Matches the data structure returned by the viewport API.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ legId: string }> | { legId: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js version compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const legId = resolvedParams.legId;

    if (!legId) {
      return NextResponse.json(
        { error: 'Leg ID is required' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    // Fetch leg with journey, boat, and owner details
    const { data, error } = await supabase
      .from('legs')
      .select(`
        id,
        name,
        description,
        journey_id,
        start_date,
        end_date,
        crew_needed,
        risk_level,
        min_experience_level,
        skills,
        journeys (
          id,
          name,
          risk_level,
          min_experience_level,
          cost_model,
          images,
          skills,
          state,
          boats (
            id,
            name,
            type,
            make_model,
            images,
            average_speed_knots,
            owner_id
          )
        )
      `)
      .eq('id', legId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json(
          { error: 'Leg not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching leg:', error);
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Failed to fetch leg'),
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Leg not found' },
        { status: 404 }
      );
    }

    const journeyData = data.journeys as any;
    const boatData = journeyData?.boats as any;

    // Fetch owner profile if we have an owner_id
    let ownerData: { full_name: string | null; profile_image_url: string | null } | null = null;
    if (boatData?.owner_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, profile_image_url')
        .eq('id', boatData.owner_id)
        .single();
      ownerData = profileData;
    }

    // Fetch waypoints using RPC function that returns GeoJSON (same as waypoints endpoint)
    const { data: waypointsData } = await supabase.rpc('get_leg_waypoints', {
      leg_id_param: legId,
    });

    // Process waypoints to get start and end
    let startWaypoint: { lng: number; lat: number; name: string | null } | null = null;
    let endWaypoint: { lng: number; lat: number; name: string | null } | null = null;

    if (waypointsData && waypointsData.length > 0) {
      const processWaypoint = (wp: any) => {
        if (!wp?.location) return null;
        try {
          // Handle different location formats (RPC returns GeoJSON)
          let coords: [number, number] | null = null;
          if (wp.location.coordinates && Array.isArray(wp.location.coordinates)) {
            coords = wp.location.coordinates;
          } else if (typeof wp.location === 'string') {
            const parsed = JSON.parse(wp.location);
            if (parsed.coordinates && Array.isArray(parsed.coordinates)) {
              coords = parsed.coordinates;
            }
          }
          if (coords) {
            return {
              lng: coords[0],
              lat: coords[1],
              name: wp.name || null,
            };
          }
        } catch (e) {
          console.error('Error parsing waypoint location:', e);
        }
        return null;
      };

      // Sort by index and get first/last
      const sortedWaypoints = [...waypointsData].sort((a: any, b: any) => a.index - b.index);
      startWaypoint = processWaypoint(sortedWaypoints[0]);
      endWaypoint = processWaypoint(sortedWaypoints[sortedWaypoints.length - 1]);
    }

    // Normalize skills to canonical format
    const { normalizeSkillNames } = require('@/app/lib/skillUtils');

    // Compute effective risk level (leg overrides journey)
    const effectiveRiskLevel = data.risk_level || journeyData?.risk_level || null;

    // Compute effective min experience level (leg overrides journey)
    const effectiveMinExperienceLevel = data.min_experience_level || journeyData?.min_experience_level || null;

    // Combine skills from leg and journey
    const legSkills = data.skills || [];
    const journeySkills = journeyData?.skills || [];
    const combinedSkills = [...new Set([...legSkills, ...journeySkills])];

    // Get first boat image
    const boatImageUrl = boatData?.images && boatData.images.length > 0
      ? boatData.images[0]
      : null;

    // Transform response to match the Leg type expected by CrewBrowseMap
    const response = {
      leg_id: data.id,
      leg_name: data.name,
      leg_description: data.description,
      journey_id: journeyData?.id || data.journey_id,
      journey_name: journeyData?.name || '',
      start_date: data.start_date,
      end_date: data.end_date,
      crew_needed: data.crew_needed,
      leg_risk_level: data.risk_level,
      journey_risk_level: journeyData?.risk_level ? [journeyData.risk_level] : null,
      cost_model: journeyData?.cost_model || null,
      journey_images: journeyData?.images || [],
      skills: normalizeSkillNames(combinedSkills),
      boat_id: boatData?.id || '',
      boat_name: boatData?.name || '',
      boat_type: boatData?.type || null,
      boat_image_url: boatImageUrl,
      boat_average_speed_knots: boatData?.average_speed_knots || null,
      boat_make_model: boatData?.make_model || null,
      owner_name: ownerData?.full_name || null,
      owner_image_url: ownerData?.profile_image_url || null,
      min_experience_level: effectiveMinExperienceLevel,
      start_waypoint: startWaypoint,
      end_waypoint: endWaypoint,
      // Also include raw data for compatibility
      effective_risk_level: effectiveRiskLevel,
      combined_skills: normalizeSkillNames(combinedSkills),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Unexpected error in leg API:', error);
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
