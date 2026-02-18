import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasCrewRole } from '@/app/lib/auth/checkRole';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';

/**
 * GET /api/registrations/[registrationId]/answers
 * 
 * Gets all answers for a registration.
 * Crew members can view their own answers, owners can view answers for their journeys.
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

    // Verify registration exists
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select(`
        id,
        user_id,
        leg_id,
        legs!inner (
          id,
          journey_id,
          journeys!inner (
            id,
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

    // Check access: crew member owns registration OR owner owns journey
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    const isCrewOwner = registration.user_id === user.id;
    const legs = registration.legs as unknown as { id: string; journey_id: string; journeys: { id: string; boat_id: string; boats: { owner_id: string } } };
    const isJourneyOwner = legs.journeys.boats.owner_id === user.id;

    if (!isCrewOwner && !isJourneyOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to view these answers' },
        { status: 403 }
      );
    }

    // Get answers with requirement details
    const { data: answersData, error: answersError } = await supabase
      .from('registration_answers')
      .select(`
        id,
        requirement_id,
        answer_text,
        answer_json,
        created_at,
        updated_at,
        journey_requirements!inner (
          id,
          question_text,
          question_type,
          options,
          is_required,
          weight,
          order
        )
      `)
      .eq('registration_id', registrationId);

    if (answersError) {
      console.error('Error fetching answers:', answersError);
      return NextResponse.json(
        { error: 'Failed to fetch answers', details: answersError.message },
        { status: 500 }
      );
    }

    // Sort answers by journey_requirements.order in JavaScript
    const answers = (answersData || []).sort((a: any, b: any) => {
      const orderA = a.journey_requirements?.order ?? 0;
      const orderB = b.journey_requirements?.order ?? 0;
      return orderA - orderB;
    });

    return NextResponse.json({
      answers,
      count: answers.length,
    });

  } catch (error: any) {
    console.error('Unexpected error in answers API:', error);
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/registrations/[registrationId]/answers
 * 
 * Creates answers for a registration.
 * Only crew members can create answers for their own registrations.
 * Only allowed if registration status is 'Pending approval'.
 * 
 * Body:
 * - answers: array of {
 *     requirement_id: UUID (required)
 *     answer_text: string (for text/yes_no)
 *     answer_json: JSONB (for multiple_choice/rating)
 *   }
 */
export async function POST(
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

    // Verify user is a crew member
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (!profile || !hasCrewRole(profile)) {
      return NextResponse.json(
        { error: 'Only crew members can create answers' },
        { status: 403 }
      );
    }

    // Verify registration exists and belongs to user
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('id, user_id, status, leg_id')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only create answers for your own registrations' },
        { status: 403 }
      );
    }

    // Only allow if status is 'Pending approval'
    if (registration.status !== 'Pending approval') {
      return NextResponse.json(
        { error: 'Answers can only be created for registrations with status "Pending approval"' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { answers } = body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: 'answers must be a non-empty array' },
        { status: 400 }
      );
    }

    // Get journey requirements to validate answers
    const { data: leg } = await supabase
      .from('legs')
      .select('journey_id')
      .eq('id', registration.leg_id)
      .single();

    if (!leg) {
      return NextResponse.json(
        { error: 'Leg not found' },
        { status: 404 }
      );
    }

    const { data: requirements } = await supabase
      .from('journey_requirements')
      .select('id, question_type, is_required')
      .eq('journey_id', leg.journey_id);

    const requirementsMap = new Map(requirements?.map((r: any) => [r.id, r]) || []);

    // Validate all required questions are answered
    const requiredIds = requirements?.filter((r: any) => r.is_required).map((r: any) => r.id) || [];
    const answeredIds = answers.map((a: any) => a.requirement_id);
    const missingRequired = requiredIds.filter((id: string) => !answeredIds.includes(id));

    if (missingRequired.length > 0) {
      return NextResponse.json(
        { error: `Missing answers for required questions: ${missingRequired.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate answer formats
    for (const answer of answers) {
      const requirement = requirementsMap.get(answer.requirement_id);
      if (!requirement) {
        return NextResponse.json(
          { error: `Invalid requirement_id: ${answer.requirement_id}` },
          { status: 400 }
        );
      }

      // Validate format based on question type
      if (requirement.question_type === 'text' || requirement.question_type === 'yes_no') {
        if (!answer.answer_text || answer.answer_text.trim() === '') {
          return NextResponse.json(
            { error: `answer_text is required for ${requirement.question_type} questions` },
            { status: 400 }
          );
        }
        if (requirement.question_type === 'yes_no' && !['Yes', 'No'].includes(answer.answer_text)) {
          return NextResponse.json(
            { error: 'yes_no questions require answer_text to be "Yes" or "No"' },
            { status: 400 }
          );
        }
      } else if (requirement.question_type === 'multiple_choice' || requirement.question_type === 'rating') {
        if (!answer.answer_json) {
          return NextResponse.json(
            { error: `answer_json is required for ${requirement.question_type} questions` },
            { status: 400 }
          );
        }
      }
    }

    // Delete existing answers for this registration (to allow re-submission)
    await supabase
      .from('registration_answers')
      .delete()
      .eq('registration_id', registrationId);

    // Insert new answers
    const answersToInsert = answers.map((answer: any) => ({
      registration_id: registrationId,
      requirement_id: answer.requirement_id,
      answer_text: answer.answer_text || null,
      answer_json: answer.answer_json || null,
    }));

    const { data: insertedAnswers, error: insertError } = await supabase
      .from('registration_answers')
      .insert(answersToInsert)
      .select();

    if (insertError) {
      console.error('Error creating answers:', insertError);
      return NextResponse.json(
        { error: 'Failed to create answers', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      answers: insertedAnswers,
      count: insertedAnswers?.length || 0,
      message: 'Answers created successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in answers API:', error);
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
