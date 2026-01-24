import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import {
  notifyRegistrationApproved,
  notifyRegistrationDenied,
} from '@/app/lib/notifications';

/**
 * PATCH /api/registrations/[registrationId]
 * 
 * Updates a registration status (approve/deny/cancel).
 * Only owners of the journey can approve/deny.
 * 
 * Body:
 * - status: 'Approved' | 'Not approved' | 'Cancelled'
 * - notes: Optional notes from the owner
 */
export async function PATCH(
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, role')
      .eq('id', user.id)
      .single();

    if (!profile || !hasOwnerRole(profile)) {
      return NextResponse.json(
        { error: 'Only owners can update registration status' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = ['Approved', 'Not approved', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify registration exists and belongs to owner's journey
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select(`
        id,
        leg_id,
        user_id,
        legs!inner (
          id,
          journey_id,
          journeys!inner (
            id,
            name,
            boat_id,
            boats!inner (
              owner_id
            )
          )
        )
      `)
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Verify owner owns this journey
    if (registration.legs.journeys.boats.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to update this registration' },
        { status: 403 }
      );
    }

    // Update registration
    const { data: updatedRegistration, error: updateError } = await supabase
      .from('registrations')
      .update({
        status,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating registration:', updateError);
      return NextResponse.json(
        { error: 'Failed to update registration', details: updateError.message },
        { status: 500 }
      );
    }

    // Send notification to crew member (non-blocking)
    if (status === 'Approved' || status === 'Not approved') {
      const journeyId = registration.legs.journeys.id;
      const journeyName = registration.legs.journeys.name;
      const crewUserId = registration.user_id;

      // Get owner name
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();

      const ownerName = ownerProfile?.full_name || ownerProfile?.username || 'The boat owner';

      // Create notification (fire and forget)
      if (status === 'Approved') {
        notifyRegistrationApproved(supabase, crewUserId, journeyId, journeyName, ownerName)
          .then((result) => {
            if (result.error) {
              console.error('[Registration API] Failed to send approval notification:', result.error);
            } else {
              console.log('[Registration API] Approval notification sent to crew:', crewUserId);
            }
          })
          .catch((err) => {
            console.error('[Registration API] Error sending approval notification:', err);
          });
      } else if (status === 'Not approved') {
        notifyRegistrationDenied(supabase, crewUserId, journeyId, journeyName, ownerName, notes)
          .then((result) => {
            if (result.error) {
              console.error('[Registration API] Failed to send denial notification:', result.error);
            } else {
              console.log('[Registration API] Denial notification sent to crew:', crewUserId);
            }
          })
          .catch((err) => {
            console.error('[Registration API] Error sending denial notification:', err);
          });
      }
    }

    return NextResponse.json({
      registration: updatedRegistration,
      message: `Registration ${status.toLowerCase()}`,
    });

  } catch (error: any) {
    console.error('Unexpected error in registration update API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
