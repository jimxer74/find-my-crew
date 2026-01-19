import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * POST /api/registrations
 * 
 * Creates a new registration for a crew member to a leg.
 * 
 * Body:
 * - leg_id: UUID of the leg to register for (required)
 * - notes: Optional notes from the crew member
 */
export async function POST(request: NextRequest) {
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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'crew') {
      return NextResponse.json(
        { error: 'Only crew members can register for legs' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { leg_id, notes } = body;

    // Validate required fields
    if (!leg_id) {
      return NextResponse.json(
        { error: 'leg_id is required' },
        { status: 400 }
      );
    }

    // Validate leg exists and belongs to a published journey
    const { data: leg, error: legError } = await supabase
      .from('legs')
      .select(`
        id,
        journey_id,
        journeys!inner (
          id,
          state,
          boat_id,
          boats!inner (
            owner_id
          )
        )
      `)
      .eq('id', leg_id)
      .single();

    if (legError || !leg) {
      return NextResponse.json(
        { error: 'Leg not found' },
        { status: 404 }
      );
    }

    // Check if journey is published
    if (leg.journeys.state !== 'Published') {
      return NextResponse.json(
        { error: 'Cannot register for legs in non-published journeys' },
        { status: 400 }
      );
    }

    // Check for existing registration
    const { data: existingRegistration } = await supabase
      .from('registrations')
      .select('id, status')
      .eq('leg_id', leg_id)
      .eq('user_id', user.id)
      .single();

    if (existingRegistration) {
      // If cancelled, allow re-registration
      if (existingRegistration.status === 'Cancelled') {
        // Update the cancelled registration to Pending approval
        const { data: updatedRegistration, error: updateError } = await supabase
          .from('registrations')
          .update({
            status: 'Pending approval',
            notes: notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRegistration.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating registration:', updateError);
          return NextResponse.json(
            { error: 'Failed to update registration' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          registration: updatedRegistration,
          message: 'Registration reactivated',
        }, { status: 200 });
      } else {
        return NextResponse.json(
          { error: 'You have already registered for this leg' },
          { status: 409 }
        );
      }
    }

    // Create new registration
    const { data: registration, error: insertError } = await supabase
      .from('registrations')
      .insert({
        leg_id,
        user_id: user.id,
        status: 'Pending approval',
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating registration:', insertError);
      return NextResponse.json(
        { error: 'Failed to create registration', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      registration,
      message: 'Registration created successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in registration API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/registrations
 * 
 * Gets registrations for the authenticated user.
 * Query parameters:
 * - leg_id: Filter by leg_id (optional)
 * - status: Filter by status (optional)
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

    const searchParams = request.nextUrl.searchParams;
    const legId = searchParams.get('leg_id');
    const status = searchParams.get('status');

    // Build query
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
        legs (
          id,
          name,
          journey_id,
          journeys (
            id,
            name,
            boat_id,
            boats (
              id,
              name
            )
          )
        )
      `)
      .eq('user_id', user.id);

    if (legId) {
      query = query.eq('leg_id', legId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data: registrations, error } = await query;

    if (error) {
      console.error('Error fetching registrations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch registrations', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      registrations: registrations || [],
      count: registrations?.length || 0,
    });

  } catch (error: any) {
    console.error('Unexpected error in registration API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
