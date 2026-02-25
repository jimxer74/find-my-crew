import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';

/**
 * GET /api/registrations/owner/all
 * 
 * Gets all registrations for all journeys owned by the authenticated owner.
 * 
 * Query parameters:
 * - status: Filter by status (optional)
 * - journey_id: Filter by journey_id (optional)
 * - leg_id: Filter by leg_id (optional)
 * - sort_by: Sort field (created_at, updated_at, status, journey_name, leg_name) (optional, default: created_at)
 * - sort_order: Sort direction (asc, desc) (optional, default: desc)
 * - limit: Limit results (optional, default: 100)
 * - offset: Offset for pagination (optional, default: 0)
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

    // Verify user is an owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (!profile || !hasOwnerRole(profile)) {
      return NextResponse.json(
        { error: 'Only owners can view all registrations' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const journeyId = searchParams.get('journey_id');
    const legId = searchParams.get('leg_id');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate sort_by
    const validSortFields = ['created_at', 'updated_at', 'status', 'journey_name', 'leg_name'];
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json(
        { error: `Invalid sort_by. Must be one of: ${validSortFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate sort_order
    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
      return NextResponse.json(
        { error: 'Invalid sort_order. Must be "asc" or "desc"' },
        { status: 400 }
      );
    }

    // Get all boat IDs owned by this user
    const { data: ownerBoats, error: boatsError } = await supabase
      .from('boats')
      .select('id')
      .eq('owner_id', user.id);

    if (boatsError) {
      logger.error('Error fetching owner boats:', { error: boatsError });
      return NextResponse.json(
        { error: 'Failed to fetch boats', details: boatsError.message },
        { status: 500 }
      );
    }

    if (!ownerBoats || ownerBoats.length === 0) {
      return NextResponse.json({
        registrations: [],
        count: 0,
        total: 0,
      });
    }

    const boatIds = ownerBoats.map(boat => boat.id);

    // Get all journey IDs for owner's boats
    let journeysQuery = supabase
      .from('journeys')
      .select('id')
      .in('boat_id', boatIds);

    if (journeyId) {
      journeysQuery = journeysQuery.eq('id', journeyId);
    }

    const { data: journeys, error: journeysError } = await journeysQuery;

    if (journeysError) {
      logger.error('Error fetching journeys:', { error: journeysError });
      return NextResponse.json(
        { error: 'Failed to fetch journeys', details: journeysError.message },
        { status: 500 }
      );
    }

    if (!journeys || journeys.length === 0) {
      return NextResponse.json({
        registrations: [],
        count: 0,
        total: 0,
      });
    }

    const journeyIds = journeys.map(journey => journey.id);

    // Get all leg IDs for owner's journeys
    let legsQuery = supabase
      .from('legs')
      .select('id')
      .in('journey_id', journeyIds);

    if (legId) {
      legsQuery = legsQuery.eq('id', legId);
    }

    const { data: ownerLegs, error: legsError } = await legsQuery;

    if (legsError) {
      logger.error('Error fetching legs:', { error: legsError });
      return NextResponse.json(
        { error: 'Failed to fetch legs', details: legsError.message },
        { status: 500 }
      );
    }

    if (!ownerLegs || ownerLegs.length === 0) {
      return NextResponse.json({
        registrations: [],
        count: 0,
        total: 0,
      });
    }

    const legIds = ownerLegs.map(leg => leg.id);

    // Build query to get all registrations for owner's legs
    let query = supabase
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
          journey_id,
          skills,
          min_experience_level,
          journeys (
            id,
            name,
            boat_id,
            boats (
              id,
              name,
              owner_id
            )
          )
        )
      `)
      .in('leg_id', legIds);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    // Apply sorting
    // Note: For complex sorts like journey_name or leg_name, we'll handle in application
    if (sortBy === 'created_at' || sortBy === 'updated_at' || sortBy === 'status') {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    } else {
      // Default to created_at for complex sorts
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: registrations, error } = await query;

    if (error) {
      logger.error('Error fetching registrations:', error);
      logger.error('Error details:', { details: JSON.stringify(error, null, 2) });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Failed to fetch registrations'),
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .in('leg_id', legIds);

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    const { count } = await countQuery;

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

    // Merge profiles and answers into registrations
    const registrationsWithProfiles = (registrations || []).map((reg: any) => ({
      ...reg,
      profiles: profilesMap[reg.user_id] || null,
      answers: answersMap[reg.id] || [],
    }));

    // Sort in application if needed
    let sortedRegistrations = registrationsWithProfiles;
    if (sortBy === 'journey_name' || sortBy === 'leg_name') {
      sortedRegistrations = [...registrationsWithProfiles].sort((a: any, b: any) => {
        const aValue = sortBy === 'journey_name' 
          ? a.legs?.journeys?.name || '' 
          : a.legs?.name || '';
        const bValue = sortBy === 'journey_name'
          ? b.legs?.journeys?.name || ''
          : b.legs?.name || '';
        
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return NextResponse.json({
      registrations: sortedRegistrations,
      count: sortedRegistrations.length,
      total: count || 0,
    });

  } catch (error: any) {
    logger.error('Unexpected error in owner registrations API:', error);
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
