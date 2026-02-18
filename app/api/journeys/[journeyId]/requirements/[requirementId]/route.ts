import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';

const VALID_REQUIREMENT_TYPES = ['risk_level', 'experience_level', 'skill', 'passport', 'question'] as const;

/**
 * PUT /api/journeys/[journeyId]/requirements/[requirementId]
 *
 * Updates an existing requirement.
 * Only journey owners can update requirements.
 *
 * Body: (all fields optional, type-dependent)
 * - question_text: string (for 'question' type)
 * - skill_name: string (for 'skill' type)
 * - qualification_criteria: string (for 'skill' and 'question' types)
 * - weight: integer 0-10 (for 'skill' and 'question' types)
 * - require_photo_validation: boolean (for 'passport' type)
 * - pass_confidence_score: integer 0-10 (for 'passport' type)
 * - is_required: boolean
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
        requirement_type,
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
    const {
      question_text,
      skill_name,
      qualification_criteria,
      weight,
      require_photo_validation,
      pass_confidence_score,
      is_required,
      order,
    } = body;

    // Build update object based on requirement type
    const updateData: Record<string, any> = {};
    const reqType = (requirement as any).requirement_type;

    // Type-specific field updates
    if (reqType === 'question') {
      if (question_text !== undefined) updateData.question_text = question_text.trim();
      if (qualification_criteria !== undefined) updateData.qualification_criteria = qualification_criteria.trim();
      if (weight !== undefined) {
        if (weight < 0 || weight > 10) {
          return NextResponse.json({ error: 'weight must be between 0 and 10' }, { status: 400 });
        }
        updateData.weight = weight;
      }
    } else if (reqType === 'skill') {
      if (skill_name !== undefined) updateData.skill_name = skill_name.trim();
      if (qualification_criteria !== undefined) updateData.qualification_criteria = qualification_criteria.trim();
      if (weight !== undefined) {
        if (weight < 0 || weight > 10) {
          return NextResponse.json({ error: 'weight must be between 0 and 10' }, { status: 400 });
        }
        updateData.weight = weight;
      }
    } else if (reqType === 'passport') {
      if (require_photo_validation !== undefined) updateData.require_photo_validation = require_photo_validation;
      if (pass_confidence_score !== undefined) {
        if (pass_confidence_score < 0 || pass_confidence_score > 10) {
          return NextResponse.json({ error: 'pass_confidence_score must be between 0 and 10' }, { status: 400 });
        }
        updateData.pass_confidence_score = pass_confidence_score;
      }
    }
    // risk_level and experience_level have no type-specific editable fields

    // Common fields
    if (is_required !== undefined) updateData.is_required = is_required;
    if (order !== undefined) updateData.order = order;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
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
        sanitizeErrorResponse(updateError, 'Failed to update requirement'),
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
      sanitizeErrorResponse(error, 'Internal server error'),
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

    // Delete requirement (cascade will delete answers)
    const { error: deleteError } = await supabase
      .from('journey_requirements')
      .delete()
      .eq('id', requirementId);

    if (deleteError) {
      console.error('Error deleting requirement:', deleteError);
      return NextResponse.json(
        sanitizeErrorResponse(deleteError, 'Failed to delete requirement'),
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Requirement deleted successfully',
    });

  } catch (error: any) {
    console.error('Unexpected error in requirement delete API:', error);
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
