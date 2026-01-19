import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
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

    if (journey.boats.owner_id !== user.id) {
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
      console.error('Error fetching legs:', legsError);
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
        legs (
          id,
          name,
          start_date,
          end_date
        ),
        profiles:user_id (
          id,
          full_name,
          username,
          sailing_experience,
          skills,
          phone
        )
      `)
      .in('leg_id', legIds)
      .order('created_at', { ascending: false });

    if (status) {
      registrationsQuery = registrationsQuery.eq('status', status);
    }

    const { data: registrations, error: regError } = await registrationsQuery;

    if (regError) {
      console.error('Error fetching registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch registrations', details: regError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      registrations: registrations || [],
      count: registrations?.length || 0,
    });

  } catch (error: any) {
    console.error('Unexpected error in journey registrations API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
