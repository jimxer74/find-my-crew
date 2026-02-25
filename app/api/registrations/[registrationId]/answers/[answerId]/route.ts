import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { hasCrewRole } from '@shared/auth';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';

/**
 * PUT /api/registrations/[registrationId]/answers/[answerId]
 * 
 * Updates an answer.
 * Only crew members can update answers for their own registrations.
 * Only allowed if registration status is 'Pending approval'.
 * 
 * Body:
 * - answer_text: string (for text/yes_no)
 * - answer_json: JSONB (for multiple_choice/rating)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string; answerId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { registrationId, answerId } = resolvedParams;
    
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
      .select('roles')
      .eq('id', user.id)
      .single();

    if (!profile || !hasCrewRole(profile)) {
      return NextResponse.json(
        { error: 'Only crew members can update answers' },
        { status: 403 }
      );
    }

    // Verify answer exists and belongs to user's registration
    const { data: answer, error: answerError } = await supabase
      .from('registration_answers')
      .select(`
        id,
        registration_id,
        requirement_id,
        registrations!inner (
          id,
          user_id,
          status
        )
      `)
      .eq('id', answerId)
      .eq('registration_id', registrationId)
      .single();

    if (answerError || !answer) {
      return NextResponse.json(
        { error: 'Answer not found' },
        { status: 404 }
      );
    }

    const registration = answer.registrations as unknown as { id: string; user_id: string; status: string };
    if (registration.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only update answers for your own registrations' },
        { status: 403 }
      );
    }

    // Only allow if status is 'Pending approval'
    if (registration.status !== 'Pending approval') {
      return NextResponse.json(
        { error: 'Answers can only be updated for registrations with status "Pending approval"' },
        { status: 400 }
      );
    }

    // Get requirement to validate answer format
    const { data: requirement } = await supabase
      .from('journey_requirements')
      .select('question_type')
      .eq('id', answer.requirement_id)
      .single();

    if (!requirement) {
      return NextResponse.json(
        { error: 'Requirement not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { answer_text, answer_json } = body;

    // Build update object based on question type
    const updateData: any = {};

    if (requirement.question_type === 'text' || requirement.question_type === 'yes_no') {
      if (answer_text === undefined) {
        return NextResponse.json(
          { error: 'answer_text is required for this question type' },
          { status: 400 }
        );
      }
      if (answer_text.trim() === '') {
        return NextResponse.json(
          { error: 'answer_text cannot be empty' },
          { status: 400 }
        );
      }
      if (requirement.question_type === 'yes_no' && !['Yes', 'No'].includes(answer_text)) {
        return NextResponse.json(
          { error: 'yes_no questions require answer_text to be "Yes" or "No"' },
          { status: 400 }
        );
      }
      updateData.answer_text = answer_text.trim();
      updateData.answer_json = null;
    } else if (requirement.question_type === 'multiple_choice' || requirement.question_type === 'rating') {
      if (answer_json === undefined) {
        return NextResponse.json(
          { error: 'answer_json is required for this question type' },
          { status: 400 }
        );
      }
      updateData.answer_json = answer_json;
      updateData.answer_text = null;
    }

    // Update answer
    const { data: updatedAnswer, error: updateError } = await supabase
      .from('registration_answers')
      .update(updateData)
      .eq('id', answerId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating answer:', { error: updateError });
      return NextResponse.json(
        sanitizeErrorResponse(updateError, 'Failed to update answer'),
        { status: 500 }
      );
    }

    return NextResponse.json({
      answer: updatedAnswer,
      message: 'Answer updated successfully',
    });

  } catch (error: any) {
    logger.error('Unexpected error in answer update API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
