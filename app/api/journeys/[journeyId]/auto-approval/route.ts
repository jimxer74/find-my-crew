import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';

/**
 * PATCH /api/journeys/[journeyId]/auto-approval
 * 
 * Enables/disables automated approval and sets threshold for a journey.
 * Only journey owners can configure auto-approval.
 * 
 * Body:
 * - auto_approval_enabled: boolean (required)
 * - auto_approval_threshold: integer 0-100 (optional, default 80)
 */
export async function PATCH(
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
        { error: 'Only owners can configure auto-approval' },
        { status: 403 }
      );
    }

    // Verify journey exists and belongs to user
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

    // Verify owner owns this journey
    const boat = journey.boats as unknown as { owner_id: string };
    if (boat.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to configure auto-approval for this journey' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { auto_approval_enabled, auto_approval_threshold } = body;

    // Validate required fields
    if (auto_approval_enabled === undefined) {
      return NextResponse.json(
        { error: 'auto_approval_enabled is required' },
        { status: 400 }
      );
    }

    // Validate threshold if provided
    const threshold = auto_approval_threshold !== undefined ? auto_approval_threshold : 80;
    if (threshold < 0 || threshold > 100) {
      return NextResponse.json(
        { error: 'auto_approval_threshold must be between 0 and 100' },
        { status: 400 }
      );
    }

    // If enabling auto-approval, verify at least one requirement exists
    if (auto_approval_enabled === true) {
      const { count: requirementCount } = await supabase
        .from('journey_requirements')
        .select('*', { count: 'exact', head: true })
        .eq('journey_id', journeyId);

      if (!requirementCount || requirementCount === 0) {
        return NextResponse.json(
          { error: 'Cannot enable auto-approval: Journey must have at least one requirement' },
          { status: 400 }
        );
      }
    }

    // Update journey
    const updatePayload: Record<string, any> = {
      auto_approval_enabled,
      auto_approval_threshold: threshold,
    };

    const { data: updatedJourney, error: updateError } = await supabase
      .from('journeys')
      .update(updatePayload)
      .eq('id', journeyId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating auto-approval settings:', updateError);
      return NextResponse.json(
        { error: 'Failed to update auto-approval settings', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      journey: updatedJourney,
      message: 'Auto-approval settings updated successfully',
    });

  } catch (error: any) {
    logger.error('Unexpected error in auto-approval API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}

/**
 * GET /api/journeys/[journeyId]/auto-approval
 * 
 * Gets auto-approval settings for a journey.
 * Public access if journey is published, otherwise owner only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const journeyId = resolvedParams.journeyId;
    
    const supabase = await getSupabaseServerClient();
    
    // Get authenticated user (optional for public access)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Verify journey exists
    const { data: journey, error: journeyError } = await supabase
      .from('journeys')
      .select(`
        id,
        state,
        auto_approval_enabled,
        auto_approval_threshold,
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

    // Check access: public if published, otherwise owner only
    const boat = journey.boats as unknown as { owner_id: string };
    if (journey.state !== 'Published') {
      if (!user || boat.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json({
      auto_approval_enabled: journey.auto_approval_enabled,
      auto_approval_threshold: journey.auto_approval_threshold,
    });

  } catch (error: any) {
    logger.error('Unexpected error in auto-approval GET API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
