import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import {
  notifyRegistrationApproved,
  notifyRegistrationDenied,
  notifyPendingRegistration,
} from '@/app/lib/notifications';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';

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
      .select('roles')
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
    const validStatuses = ['Approved', 'Not approved', 'Cancelled', 'Pending approval'];
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
          name,
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
    const legs = registration.legs as unknown as { id: string; journey_id: string; name: string; journeys: { id: string; name: string; boat_id: string; boats: { owner_id: string } } };
    if (legs.journeys.boats.owner_id !== user.id) {
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
      logger.error('Error updating registration:', { errorCode: updateError.code, errorMessage: updateError.message });
      return NextResponse.json(
        sanitizeErrorResponse(updateError, 'Failed to update registration'),
        { status: 500 }
      );
    }

    // Send notification to crew member (non-blocking)
    const journeyId = legs.journeys.id;
    const journeyName = legs.journeys.name;
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
      notifyRegistrationApproved(supabase, crewUserId, journeyId, journeyName, ownerName, user.id)
        .then((result) => {
          if (result.error) {
            logger.error('[Registration API] Failed to send approval notification:', { error: result.error });
          } else {
            logger.info('[Registration API] Approval notification sent to crew:', { crewUserId });
          }
        })
        .catch((err) => {
          logger.error('[Registration API] Error sending approval notification:', { error: err instanceof Error ? err.message : String(err) });
        });
    } else if (status === 'Not approved') {
      notifyRegistrationDenied(supabase, crewUserId, journeyId, journeyName, ownerName, notes, user.id)
        .then((result) => {
          if (result.error) {
            logger.error('[Registration API] Failed to send denial notification:', { error: result.error });
          } else {
            logger.info('[Registration API] Denial notification sent to crew:', { crewUserId });
          }
        })
        .catch((err) => {
          logger.error('[Registration API] Error sending denial notification:', { error: err instanceof Error ? err.message : String(err) });
        });
    } else if (status === 'Pending approval') {
      // Notify crew member that their registration is pending review
      notifyPendingRegistration(
        supabase,
        crewUserId,
        registrationId,
        journeyId,
        journeyName,
        legs?.name || 'Unknown Leg'
      )
        .then((result) => {
          if (result.error) {
            logger.error('[Registration API] Failed to send pending notification:', { error: result.error });
          } else {
            logger.info('[Registration API] Pending registration notification sent to crew:', { crewUserId });
          }
        })
        .catch((err) => {
          logger.error('[Registration API] Error sending pending notification:', { error: err instanceof Error ? err.message : String(err) });
        });
    }

    return NextResponse.json({
      registration: updatedRegistration,
      message: `Registration ${status.toLowerCase()}`,
    });

  } catch (error: any) {
    logger.error('Unexpected error in registration update API:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
