import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';

/**
 * PUT /api/journeys/[journeyId]/requirements/[requirementId]
 * 
 * Updates an existing requirement.
 * Only journey owners can update requirements.
 * 
 * Body: (all fields optional)
 * - question_text: string
 * - question_type: 'text' | 'multiple_choice' | 'yes_no' | 'rating'
 * - options: JSONB array (for multiple_choice)
 * - is_required: boolean
 * - weight: integer 1-10
 * - order: integer
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string; requirementId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { journeyId, requirementId } = resolvedParams;
    
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
        { error: 'Only owners can update requirements' },
        { status: 403 }
      );
    }

    // Verify requirement exists and belongs to user's journey
    const { data: requirement, error: reqError } = await supabase
      .from('journey_requirements')
      .select(`
        id,
        journey_id,
        journeys!inner (
          id,
          boat_id,
          boats!inner (
            owner_id
          )
        )
      `)
      .eq('id', requirementId)
      .eq('journey_id', journeyId)
      .single();

    if (reqError || !requirement) {
      return NextResponse.json(
        { error: 'Requirement not found' },
        { status: 404 }
      );
    }

    // Verify owner owns this journey
    const journey = requirement.journeys as unknown as { id: string; boat_id: string; boats: { owner_id: string } };
    if (journey.boats.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to update this requirement' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { question_text, question_type, options, is_required, weight, order } = body;

    // Build update object
    const updateData: any = {};

    if (question_text !== undefined) {
      updateData.question_text = question_text.trim();
    }

    if (question_type !== undefined) {
      // Validate question_type
      const validTypes = ['text', 'multiple_choice', 'yes_no', 'rating'];
      if (!validTypes.includes(question_type)) {
        return NextResponse.json(
          { error: `Invalid question_type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.question_type = question_type;

      // If changing to multiple_choice, validate options
      if (question_type === 'multiple_choice') {
        if (options === undefined || !Array.isArray(options) || options.length === 0) {
          return NextResponse.json(
            { error: 'multiple_choice questions must have options array' },
            { status: 400 }
          );
        }
        updateData.options = options;
      } else {
        // Clear options for non-multiple_choice types
        updateData.options = null;
      }
    } else if (options !== undefined) {
      // If updating options without changing type, check current type
      const { data: currentReq } = await supabase
        .from('journey_requirements')
        .select('question_type')
        .eq('id', requirementId)
        .single();

      if (currentReq?.question_type === 'multiple_choice') {
        if (!Array.isArray(options) || options.length === 0) {
          return NextResponse.json(
            { error: 'multiple_choice questions must have options array' },
            { status: 400 }
          );
        }
        updateData.options = options;
      }
    }

    if (is_required !== undefined) {
      updateData.is_required = is_required;
    }

    if (weight !== undefined) {
      if (weight < 1 || weight > 10) {
        return NextResponse.json(
          { error: 'weight must be between 1 and 10' },
          { status: 400 }
        );
      }
      updateData.weight = weight;
    }

    if (order !== undefined) {
      updateData.order = order;
    }

    // Update requirement
    const { data: updatedRequirement, error: updateError } = await supabase
      .from('journey_requirements')
      .update(updateData)
      .eq('id', requirementId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating requirement:', updateError);
      return NextResponse.json(
        { error: 'Failed to update requirement', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      requirement: updatedRequirement,
      message: 'Requirement updated successfully',
    });

  } catch (error: any) {
    console.error('Unexpected error in requirement update API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journeys/[journeyId]/requirements/[requirementId]
 * 
 * Deletes a requirement.
 * Only journey owners can delete requirements.
 * 
 * Note: This will cascade delete all associated answers due to foreign key constraint.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string; requirementId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { journeyId, requirementId } = resolvedParams;
    
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
        { error: 'Only owners can delete requirements' },
        { status: 403 }
      );
    }

    // Verify requirement exists and belongs to user's journey
    const { data: requirement, error: reqError } = await supabase
      .from('journey_requirements')
      .select(`
        id,
        journey_id,
        journeys!inner (
          id,
          boat_id,
          boats!inner (
            owner_id
          )
        )
      `)
      .eq('id', requirementId)
      .eq('journey_id', journeyId)
      .single();

    if (reqError || !requirement) {
      return NextResponse.json(
        { error: 'Requirement not found' },
        { status: 404 }
      );
    }

    // Verify owner owns this journey
    const journey = requirement.journeys as unknown as { id: string; boat_id: string; boats: { owner_id: string } };
    if (journey.boats.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this requirement' },
        { status: 403 }
      );
    }

    // Check if there are existing answers (for warning, but we'll still delete)
    const { count: answerCount } = await supabase
      .from('registration_answers')
      .select('*', { count: 'exact', head: true })
      .eq('requirement_id', requirementId);

    // Delete requirement (cascade will delete answers)
    const { error: deleteError } = await supabase
      .from('journey_requirements')
      .delete()
      .eq('id', requirementId);

    if (deleteError) {
      console.error('Error deleting requirement:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete requirement', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Requirement deleted successfully',
      deletedAnswersCount: answerCount || 0,
    });

  } catch (error: any) {
    console.error('Unexpected error in requirement delete API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
