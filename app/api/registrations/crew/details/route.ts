import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasCrewRole } from '@/app/lib/auth/checkRole';

/**
 * GET /api/registrations/crew/details
 * 
 * Gets all registrations for the authenticated crew member with full leg details.
 * Returns data in the same format as the viewport API for consistency.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is a crew member
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, role, skills, sailing_experience')
      .eq('id', user.id)
      .single();

    if (!profile || !hasCrewRole(profile)) {
      return NextResponse.json(
        { error: 'Only crew members can view their registrations' },
        { status: 403 }
      );
    }

    // Get user's registrations with leg IDs
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('id, leg_id, status, notes, created_at, updated_at, ai_match_score, ai_match_reasoning, auto_approved')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (regError) {
      console.error('Error fetching registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch registrations', details: regError.message },
        { status: 500 }
      );
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({
        registrations: [],
        count: 0,
      });
    }

    const legIds = registrations.map(r => r.leg_id);

    // Get full leg details with joins
    const { data: legsData, error: legsError } = await supabase
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
        min_experience_level,
        journey_id,
        journeys!inner (
          id,
          name,
          skills,
          boat_id,
          boats!inner (
            id,
            name,
            type,
            make,
            model,
            images,
            average_speed_knots,
            owner_id
          )
        )
      `)
      .in('id', legIds)
      .eq('journeys.state', 'Published');

    if (legsError) {
      console.error('Error fetching leg details:', legsError);
      console.error('Legs error details:', JSON.stringify(legsError, null, 2));
      return NextResponse.json(
        { error: 'Failed to fetch leg details', details: legsError.message, code: legsError.code },
        { status: 500 }
      );
    }

    if (!legsData || legsData.length === 0) {
      return NextResponse.json({
        registrations: [],
        count: 0,
      });
    }

    // Get owner IDs to fetch owner profile information
    const ownerIds = [...new Set(legsData.map((leg: any) => leg.journeys?.boats?.owner_id).filter(Boolean))];
    let ownerProfilesMap: Record<string, any> = {};
    
    if (ownerIds.length > 0) {
      const { data: ownerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, profile_image_url')
        .in('id', ownerIds);
      
      if (ownerProfiles) {
        ownerProfilesMap = ownerProfiles.reduce((acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // Get waypoints for all legs using RPC function for each leg
    const waypointsByLeg: Record<string, any[]> = {};
    
    // Fetch waypoints for each leg using the RPC function
    for (const legId of legIds) {
      const { data: legWaypoints } = await supabase.rpc('get_leg_waypoints', {
        leg_id_param: legId,
      });
      
      if (legWaypoints && legWaypoints.length > 0) {
        waypointsByLeg[legId] = legWaypoints;
      }
    }

    // Transform data to match LegDetailsPanel format
    const registrationsWithLegs = registrations.map((reg: any) => {
      const leg = legsData?.find((l: any) => l.id === reg.leg_id);
      if (!leg) {
        return null;
      }

      const waypoints = waypointsByLeg[leg.id] || [];
      const startWaypoint = waypoints.find((w: any) => w.index === 0);
      const endWaypoint = waypoints.length > 0 
        ? waypoints.reduce((max: any, w: any) => w.index > max.index ? w : max, waypoints[0])
        : null;

      // Transform waypoint coordinates from GeoJSON (returned by RPC function)
      const transformWaypoint = (wp: any) => {
        if (!wp || !wp.location) return null;
        
        let coordinates: [number, number] | null = null;
        
        // location is GeoJSON from RPC: { type: 'Point', coordinates: [lng, lat] }
        if (wp.location.coordinates && Array.isArray(wp.location.coordinates)) {
          coordinates = wp.location.coordinates as [number, number];
        } else if (typeof wp.location === 'string') {
          try {
            const parsed = JSON.parse(wp.location);
            if (parsed.coordinates && Array.isArray(parsed.coordinates)) {
              coordinates = parsed.coordinates as [number, number];
            }
          } catch {
            // Invalid JSON, skip
          }
        }
        
        if (!coordinates) return null;
        
        return {
          lng: coordinates[0],
          lat: coordinates[1],
          name: wp.name || null,
        };
      };

      // Normalize skills to canonical format (handles both display and canonical formats)
      // This ensures compatibility even if migration hasn't been run yet
      const { normalizeSkillNames } = require('@/app/lib/skillUtils');
      // Type assertion for nested Supabase join
      const journey = leg.journeys as unknown as { id: string; name: string; skills: string[]; boat_id: string; boats: { id: string; name: string; type: string; make: string; model: string; images: string[]; average_speed_knots: number; owner_id: string } } | null;
      const journeySkills = normalizeSkillNames(journey?.skills || []);
      const legSkills = normalizeSkillNames(leg.skills || []);
      
      const combinedSkills = [
        ...new Set([
          ...journeySkills,
          ...legSkills,
        ]),
      ].filter(Boolean);

      // Calculate skill match percentage if user has skills
      let skillMatchPercentage: number | undefined;
      let experienceLevelMatches: boolean | undefined;
      
      if (profile.skills && profile.skills.length > 0 && combinedSkills.length > 0) {
        // Parse user skills from JSON strings (profiles store as JSON)
        const { normalizeSkillNames } = require('@/app/lib/skillUtils');
        const userSkills = normalizeSkillNames(profile.skills);
        
        const matchingSkills = combinedSkills.filter((skill: string) => 
          userSkills.includes(skill)
        );
        
        skillMatchPercentage = Math.round((matchingSkills.length / combinedSkills.length) * 100);
      }

      // Check experience level match
      if (leg.min_experience_level !== null && profile.sailing_experience !== null) {
        experienceLevelMatches = profile.sailing_experience >= leg.min_experience_level;
      }

      return {
        registration_id: reg.id,
        registration_status: reg.status,
        registration_notes: reg.notes,
        registration_created_at: reg.created_at,
        registration_updated_at: reg.updated_at,
        ai_match_score: reg.ai_match_score || null,
        ai_match_reasoning: reg.ai_match_reasoning || null,
        auto_approved: reg.auto_approved || false,
        leg_id: leg.id,
        leg_name: leg.name,
        leg_description: leg.description,
        journey_id: leg.journey_id,
        journey_name: journey?.name || 'Unknown Journey',
        start_date: leg.start_date,
        end_date: leg.end_date,
        crew_needed: leg.crew_needed,
        risk_level: leg.risk_level,
        skills: combinedSkills,
        boat_id: journey?.boats?.id || '',
        boat_name: journey?.boats?.name || 'Unknown Boat',
        boat_type: journey?.boats?.type || null,
        boat_make: journey?.boats?.make || null,
        boat_model: journey?.boats?.model || null,
        boat_image_url: journey?.boats?.images && journey.boats.images.length > 0
          ? journey.boats.images[0]
          : null,
        boat_average_speed_knots: journey?.boats?.average_speed_knots || null,
        owner_name: ownerProfilesMap[journey?.boats?.owner_id || '']?.full_name || null,
        owner_image_url: ownerProfilesMap[journey?.boats?.owner_id || '']?.profile_image_url || null,
        min_experience_level: leg.min_experience_level,
        skill_match_percentage: skillMatchPercentage,
        experience_level_matches: experienceLevelMatches,
        start_waypoint: transformWaypoint(startWaypoint),
        end_waypoint: transformWaypoint(endWaypoint),
      };
    }).filter(Boolean);

    return NextResponse.json({
      registrations: registrationsWithLegs,
      count: registrationsWithLegs.length,
    });

  } catch (error: any) {
    console.error('Unexpected error in crew registrations API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
