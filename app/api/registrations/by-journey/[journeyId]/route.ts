import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';

/**
 * GET /api/registrations/by-journey/[journeyId]
 * 
 * Gets all registrations for a journey (all legs).
 * Only accessible by the journey owner.
 * 
 * Query parameters:
 * - status: Filter by status (optional)
 * - leg_id: Filter by leg_id (optional)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const journeyId = resolvedParams.journeyId;
    
    const supabase = await getSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is an owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (!profile || !hasOwnerRole(profile)) {
      return NextResponse.json(
        { error: 'Only owners can view journey registrations' },
        { status: 403 }
      );
    }

    // Verify journey exists and belongs to owner
    const { data: journey, error: journeyError } = await supabase
      .from('journeys')
      .select(`
        id,
        boat_id,
        boats!inner (
          owner_id
        )
      `)
      .eq('id', journeyId)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      );
    }

    const boat = journey.boats as unknown as { owner_id: string };
    if (boat.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to view registrations for this journey' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const legId = searchParams.get('leg_id');

    // Get all legs for this journey
    let legsQuery = supabase
      .from('legs')
      .select('id')
      .eq('journey_id', journeyId);

    if (legId) {
      legsQuery = legsQuery.eq('id', legId);
    }

    const { data: legs, error: legsError } = await legsQuery;

    if (legsError) {
      logger.error('Error fetching legs:', legsError);
      return NextResponse.json(
        { error: 'Failed to fetch legs', details: legsError.message },
        { status: 500 }
      );
    }

    if (!legs || legs.length === 0) {
      return NextResponse.json({
        registrations: [],
        count: 0,
      });
    }

    const legIds = legs.map(leg => leg.id);

    // Get registrations for these legs
    let registrationsQuery = supabase
      .from('registrations')
      .select(`
        id,
        leg_id,
        user_id,
        status,
        notes,
        created_at,
        updated_at,
        ai_match_score,
        ai_match_reasoning,
        auto_approved,
        legs (
          id,
          name,
          start_date,
          end_date,
          skills,
          min_experience_level
        )
      `)
      .in('leg_id', legIds)
      .order('created_at', { ascending: false });

    if (status) {
      registrationsQuery = registrationsQuery.eq('status', status);
    }

    const { data: registrations, error: regError } = await registrationsQuery;

    if (regError) {
      logger.error('Error fetching registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch registrations', details: regError.message },
        { status: 500 }
      );
    }

    // Fetch waypoint names for legs
    const legIdsFromRegistrations = [...new Set((registrations || []).map((r: any) => r.legs?.id).filter(Boolean))];
    let waypointsMap: Record<string, { startWaypointName: string | null; endWaypointName: string | null }> = {};
    
    if (legIdsFromRegistrations.length > 0) {
      for (const legId of legIdsFromRegistrations) {
        const { data: waypointsData, error: waypointsError } = await supabase
          .rpc('get_leg_waypoints', { leg_id_param: legId });

        if (!waypointsError && waypointsData && waypointsData.length > 0) {
          // Sort by index to get start (index 0) and end (max index)
          const sortedWaypoints = waypointsData.sort((a: any, b: any) => a.index - b.index);
          const startWaypoint = sortedWaypoints[0];
          const endWaypoint = sortedWaypoints[sortedWaypoints.length - 1];
          
          waypointsMap[legId] = {
            startWaypointName: startWaypoint?.name || null,
            endWaypointName: endWaypoint?.name || null,
          };
        } else {
          waypointsMap[legId] = {
            startWaypointName: null,
            endWaypointName: null,
          };
        }
      }
    }

    // Fetch profiles separately and merge them
    const userIds = [...new Set((registrations || []).map((r: any) => r.user_id))];
    let profilesMap: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, sailing_experience, skills, phone, profile_image_url')
        .in('id', userIds);

      if (!profilesError && profiles) {
        profilesMap = profiles.reduce((acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // Fetch registration answers for all registrations
    const registrationIds = (registrations || []).map((r: any) => r.id);
    let answersMap: Record<string, any[]> = {};
    
    if (registrationIds.length > 0) {
      const { data: allAnswers, error: answersError } = await supabase
        .from('registration_answers')
        .select(`
          id,
          registration_id,
          requirement_id,
          answer_text,
          answer_json,
          journey_requirements!inner (
            id,
            question_text,
            question_type,
            options,
            is_required,
            order
          )
        `)
        .in('registration_id', registrationIds);

      if (!answersError && allAnswers) {
        // Sort answers by journey_requirements.order in JavaScript
        const sortedAnswers = [...allAnswers].sort((a: any, b: any) => {
          const orderA = a.journey_requirements?.order ?? 0;
          const orderB = b.journey_requirements?.order ?? 0;
          return orderA - orderB;
        });

        // Group answers by registration_id
        answersMap = sortedAnswers.reduce((acc: Record<string, any[]>, answer: any) => {
          if (!acc[answer.registration_id]) {
            acc[answer.registration_id] = [];
          }
          acc[answer.registration_id].push(answer);
          return acc;
        }, {});
      }
    }

    // Merge profiles, answers, and waypoint names into registrations
    const registrationsWithProfiles = (registrations || []).map((reg: any) => {
      const legId = reg.legs?.id;
      const waypoints = waypointsMap[legId] || { startWaypointName: null, endWaypointName: null };
      
      return {
        ...reg,
        profiles: profilesMap[reg.user_id] || null,
        answers: answersMap[reg.id] || [],
        legs: reg.legs ? {
          ...reg.legs,
          start_waypoint_name: waypoints.startWaypointName,
          end_waypoint_name: waypoints.endWaypointName,
        } : reg.legs,
      };
    });

    return NextResponse.json({
      registrations: registrationsWithProfiles || [],
      count: registrationsWithProfiles?.length || 0,
    });

  } catch (error: any) {
    logger.error('Unexpected error in journey registrations API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
