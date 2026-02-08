import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import { calculateMatchPercentage } from '@/app/lib/skillMatching';
import { normalizeSkillNames } from '@/app/lib/skillUtils';

/**
 * GET /api/registrations/[registrationId]/details
 *
 * Gets comprehensive details for a single registration.
 * Only accessible by the boat owner.
 *
 * Returns:
 * - Registration data (status, notes, created_at, ai_match_score, ai_match_reasoning, auto_approved)
 * - Crew profile (name, avatar, skills, experience level)
 * - Leg details (name, dates, waypoints, skills, risk_level, min_experience_level)
 * - Journey details (name, dates)
 * - Boat details (name, average_speed_knots)
 * - Journey requirements with crew's answers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const registrationId = resolvedParams.registrationId;

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
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasOwnerRole(userProfile)) {
      return NextResponse.json(
        { error: 'Only owners can view registration details' },
        { status: 403 }
      );
    }

    // Fetch registration with all related data
    const { data: registration, error: regError } = await supabase
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
        legs!inner (
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
            description,
            start_date,
            end_date,
            risk_level,
            skills,
            min_experience_level,
            boat_id,
            boats!inner (
              id,
              name,
              type,
              make_model,
              images,
              average_speed_knots,
              owner_id
            )
          )
        )
      `)
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      console.error('Error fetching registration:', regError);
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Type assertion for nested Supabase joins
    const legs = registration.legs as unknown as {
      id: string;
      name: string;
      description: string;
      start_date: string;
      end_date: string;
      crew_needed: number;
      risk_level: string;
      skills: string[];
      min_experience_level: number;
      journey_id: string;
      journeys: {
        id: string;
        name: string;
        description: string;
        start_date: string;
        end_date: string;
        risk_level: string[];
        skills: string[];
        min_experience_level: number;
        boat_id: string;
        boats: {
          id: string;
          name: string;
          type: string;
          make_model: string;
          images: string[];
          average_speed_knots: number;
          owner_id: string;
        };
      };
    };

    // Verify owner owns this journey's boat
    if (legs.journeys.boats.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to view this registration' },
        { status: 403 }
      );
    }

    // Fetch crew profile
    const { data: crewProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, sailing_experience, skills, risk_level, phone, profile_image_url, sailing_preferences')
      .eq('id', registration.user_id)
      .single();

    if (profileError) {
      console.error('Error fetching crew profile:', profileError);
    }

    // Fetch waypoints for the leg
    const { data: waypointsData, error: waypointsError } = await supabase
      .rpc('get_leg_waypoints', { leg_id_param: registration.leg_id });

    let startWaypoint = null;
    let endWaypoint = null;

    if (!waypointsError && waypointsData && waypointsData.length > 0) {
      // Sort by index to get start (index 0) and end (max index)
      const sortedWaypoints = waypointsData.sort((a: any, b: any) => a.index - b.index);
      const startWp = sortedWaypoints[0];
      const endWp = sortedWaypoints[sortedWaypoints.length - 1];

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

      startWaypoint = transformWaypoint(startWp);
      endWaypoint = transformWaypoint(endWp);
    }

    // Fetch journey requirements
    const { data: requirements, error: reqError } = await supabase
      .from('journey_requirements')
      .select('id, question_text, question_type, options, is_required, order, weight')
      .eq('journey_id', legs.journeys.id)
      .order('order', { ascending: true });

    if (reqError) {
      console.error('Error fetching requirements:', reqError);
    }

    // Fetch registration answers
    const { data: answersData, error: answersError } = await supabase
      .from('registration_answers')
      .select(`
        id,
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
      .eq('registration_id', registrationId);

    if (answersError) {
      console.error('Error fetching answers:', answersError);
    }

    // Sort answers by journey_requirements.order in JavaScript
    const answers = (answersData || []).sort((a: any, b: any) => {
      const orderA = a.journey_requirements?.order ?? 0;
      const orderB = b.journey_requirements?.order ?? 0;
      return orderA - orderB;
    });

    // Combine journey and leg skills (remove duplicates)
    const journeySkills = normalizeSkillNames(legs.journeys.skills || []);
    const legSkills = normalizeSkillNames(legs.skills || []);
    const combinedSkills = [...new Set([...journeySkills, ...legSkills])].filter(Boolean);

    // Determine effective values (leg overrides journey)
    const effectiveRiskLevel = legs.risk_level ||
      (legs.journeys.risk_level && legs.journeys.risk_level[0]) ||
      null;
    const effectiveMinExperienceLevel = legs.min_experience_level ??
      legs.journeys.min_experience_level ??
      null;

    // Calculate skill match percentage using the canonical function
    let skillMatchPercentage: number | null = null;
    if (crewProfile?.skills && crewProfile.skills.length > 0 && combinedSkills.length > 0) {
      const crewSkills = normalizeSkillNames(crewProfile.skills);
      skillMatchPercentage = calculateMatchPercentage(
        crewSkills,
        combinedSkills,
        crewProfile.risk_level || null,
        effectiveRiskLevel,
        legs.journeys.risk_level || null,
        crewProfile.sailing_experience,
        effectiveMinExperienceLevel
      );
    }

    // Check experience level match
    let experienceLevelMatches: boolean | null = null;
    if (effectiveMinExperienceLevel !== null && crewProfile && crewProfile.sailing_experience !== null) {
      experienceLevelMatches = crewProfile.sailing_experience >= effectiveMinExperienceLevel;
    }

    // Build response
    const response = {
      registration: {
        id: registration.id,
        status: registration.status,
        notes: registration.notes,
        created_at: registration.created_at,
        updated_at: registration.updated_at,
        ai_match_score: registration.ai_match_score,
        ai_match_reasoning: registration.ai_match_reasoning,
        auto_approved: registration.auto_approved || false,
      },
      crew: crewProfile ? {
        id: crewProfile.id,
        full_name: crewProfile.full_name,
        username: crewProfile.username,
        email: crewProfile.email,
        sailing_experience: crewProfile.sailing_experience,
        skills: normalizeSkillNames(crewProfile.skills || []),
        risk_level: crewProfile.risk_level,
        phone: crewProfile.phone,
        profile_image_url: crewProfile.profile_image_url,
        sailing_preferences: crewProfile.sailing_preferences,
      } : null,
      leg: {
        id: legs.id,
        name: legs.name,
        description: legs.description,
        start_date: legs.start_date,
        end_date: legs.end_date,
        crew_needed: legs.crew_needed,
        risk_level: legs.risk_level,
        skills: legSkills,
        min_experience_level: legs.min_experience_level,
        start_waypoint: startWaypoint,
        end_waypoint: endWaypoint,
      },
      journey: {
        id: legs.journeys.id,
        name: legs.journeys.name,
        description: legs.journeys.description,
        start_date: legs.journeys.start_date,
        end_date: legs.journeys.end_date,
        risk_level: legs.journeys.risk_level,
        skills: journeySkills,
        min_experience_level: legs.journeys.min_experience_level,
      },
      boat: {
        id: legs.journeys.boats.id,
        name: legs.journeys.boats.name,
        type: legs.journeys.boats.type,
        make_model: legs.journeys.boats.make_model,
        image_url: legs.journeys.boats.images?.[0] || null,
        average_speed_knots: legs.journeys.boats.average_speed_knots,
      },
      requirements: requirements || [],
      answers: answers || [],
      // Computed values
      combined_skills: combinedSkills,
      skill_match_percentage: skillMatchPercentage,
      experience_level_matches: experienceLevelMatches,
      effective_risk_level: effectiveRiskLevel,
      effective_min_experience_level: effectiveMinExperienceLevel,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Unexpected error in registration details API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
