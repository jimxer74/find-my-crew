import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { assessRegistrationWithAI, performPreChecks } from '@/app/lib/ai/assessRegistration';
import { hasCrewRole } from '@/app/lib/auth/checkRole';
import { notifyNewRegistration } from '@/app/lib/notifications';
import { waitUntil } from '@vercel/functions';


// Extend timeout for registration with AI assessment
export const maxDuration = 90; // 90 seconds
export const runtime = 'nodejs';

/**
 * Helper function to handle passport requirement answers
 */
async function handlePassportAnswer(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  registrationId: string,
  passportDocumentId: string,
  journeyId: string
): Promise<string | null> {
  // Get passport requirement for this journey
  const { data: passportRequirement } = await supabase
    .from('journey_requirements')
    .select('id, require_photo_validation')
    .eq('journey_id', journeyId)
    .eq('requirement_type', 'passport')
    .single();

  if (!passportRequirement) {
    // No passport requirement, nothing to do
    return null;
  }

  // Create registration answer for passport
  const { error: insertError } = await supabase
    .from('registration_answers')
    .insert({
      registration_id: registrationId,
      requirement_id: passportRequirement.id,
      passport_document_id: passportDocumentId,
      // AI assessment will fill in: photo_verification_passed, photo_confidence_score, ai_score, passed
    });

  if (insertError) {
    console.error('Error creating passport answer:', insertError);
    return insertError.message;
  }

  return null; // Success
}

/**
 * Helper function to handle registration answers for question-type requirements.
 * Only question-type requirements accept user-provided answers.
 * Skill/passport/risk_level/experience_level are handled by pre-checks and AI assessment.
 */
async function handleRegistrationAnswers(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  registrationId: string,
  answers: Array<{ requirement_id: string; answer_text?: string; answer_json?: any }>,
  journeyId: string
): Promise<string | null> {
  // Get question-type requirements to validate answers against
  const { data: requirements } = await supabase
    .from('journey_requirements')
    .select('id, requirement_type, is_required, question_text')
    .eq('journey_id', journeyId)
    .eq('requirement_type', 'question');

  if (!requirements || requirements.length === 0) {
    // No question requirements - nothing to save
    return null;
  }

  const requirementsMap = new Map<string, { id: string; requirement_type: string; is_required: boolean; question_text: string }>(
    requirements.map((r: any) => [r.id, r])
  );

  // Validate all required question requirements are answered
  const requiredIds = requirements.filter((r: any) => r.is_required).map((r: any) => r.id);
  const answeredIds = answers.map((a: any) => a.requirement_id);
  const missingRequired = requiredIds.filter((id: string) => !answeredIds.includes(id));

  if (missingRequired.length > 0) {
    return `Missing answers for required questions: ${missingRequired.join(', ')}`;
  }

  // Validate answer formats
  for (const answer of answers) {
    const requirement = requirementsMap.get(answer.requirement_id);
    if (!requirement) {
      // Skip answers for non-question requirements (they shouldn't be here but don't fail)
      continue;
    }

    // Question-type requirements need answer_text
    if (!answer.answer_text || answer.answer_text.trim() === '') {
      return `answer_text is required for question: "${requirement.question_text}"`;
    }
  }

  // Filter to only question requirement answers and insert
  const answersToInsert = answers
    .filter((answer: any) => requirementsMap.has(answer.requirement_id))
    .map((answer: any) => ({
      registration_id: registrationId,
      requirement_id: answer.requirement_id,
      answer_text: answer.answer_text || null,
      answer_json: answer.answer_json || null,
    }));

  if (answersToInsert.length === 0) {
    return null; // No question answers to save
  }

  const { error: insertError } = await supabase
    .from('registration_answers')
    .insert(answersToInsert);

  if (insertError) {
    console.error('Error creating answers:', insertError);
    return insertError.message;
  }

  return null; // Success
}

/**
 * Helper function to trigger AI assessment for a registration
 * Uses Vercel's waitUntil to ensure the task completes even after response is sent
 */
function triggerAIAssessment(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  registrationId: string
): void {
  const assessmentPromise = assessRegistrationWithAI(supabase, registrationId)
    .then(() => {
      console.log(`[Registration API] ✅ AI assessment completed successfully for registration: ${registrationId}`);
    })
    .catch((error) => {
      console.error(`[Registration API] ❌ AI assessment failed (non-blocking) for registration ${registrationId}:`, {
        error: error.message,
        stack: error.stack,
        errorName: error.name,
        errorType: typeof error,
      });
      // Don't fail registration creation if AI assessment fails
    });

  // Use waitUntil to ensure the task completes even after response is sent
  waitUntil(assessmentPromise);
}

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
      .select('roles')
      .eq('id', user.id)
      .single();

    if (!profile || !hasCrewRole(profile)) {
      return NextResponse.json(
        { error: 'Only crew members can register for legs' },
        { status: 403 }
      );
    }

    // Parse request - support both JSON and FormData (FormData for passport with photo)
    let leg_id: string | null = null;
    let notes: string | null = null;
    let answers: any[] = [];
    let passport_document_id: string | null = null;
    let photo_file: Blob | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      leg_id = body.leg_id;
      notes = body.notes;
      answers = body.answers || [];
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      leg_id = formData.get('leg_id') as string;
      notes = formData.get('notes') as string | null;
      passport_document_id = formData.get('passport_document_id') as string | null;

      const answersStr = formData.get('answers') as string | null;
      if (answersStr) {
        try {
          answers = JSON.parse(answersStr);
        } catch {
          answers = [];
        }
      }

      const photoFileData = formData.get('photo_file') as Blob | null;
      if (photoFileData) {
        photo_file = photoFileData;
      }
    } else {
      const body = await request.json();
      leg_id = body.leg_id;
      notes = body.notes;
      answers = body.answers || [];
    }

    // If passport document ID is provided, validate it belongs to the user
    if (passport_document_id) {
      const { data: passportDoc, error: passportError } = await supabase
        .from('document_vault')
        .select('id, owner_id, metadata')
        .eq('id', passport_document_id)
        .single();

      if (passportError || !passportDoc) {
        return NextResponse.json(
          { error: 'Passport document not found' },
          { status: 404 }
        );
      }

      if (passportDoc.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'You do not have access to this passport document' },
          { status: 403 }
        );
      }
    }

    const body = { leg_id, notes, answers };

    console.log(`[Registration API] RAW Body:`, body);

    // Validate required fields
    console.log(`[Registration API] Received registration request:`, {
      leg_id,
      hasNotes: !!notes,
      notesLength: notes?.length || 0,
      hasAnswers: !!(answers && Array.isArray(answers)),
      answersLength: answers?.length || 0,
      bodyKeys: Object.keys(body),
    });

    if (!leg_id) {
      console.error(`[Registration API] ❌ 400 ERROR: leg_id is missing`);
      return NextResponse.json(
        { error: 'leg_id is required', details: { receivedBody: body } },
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
          name,
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

    // Type assertion for nested Supabase join
    const journey = leg.journeys as unknown as { id: string; name: string; state: string; boat_id: string; boats: { owner_id: string } };

    // Check if journey is published
    console.log(`[Registration API] Journey state check:`, {
      leg_id,
      journeyId: journey.id,
      journeyState: journey.state,
    });

    if (journey.state !== 'Published') {
      console.error(`[Registration API] ❌ 400 ERROR: Journey not published`, {
        leg_id,
        journeyId: journey.id,
        journeyState: journey.state,
      });
      return NextResponse.json(
        {
          error: 'Cannot register for legs in non-published journeys',
          details: {
            journeyId: journey.id,
            journeyState: journey.state,
          }
        },
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
        // Run pre-checks before reactivation (same as new registration)
        const { count: reactivationReqCount } = await supabase
          .from('journey_requirements')
          .select('*', { count: 'exact', head: true })
          .eq('journey_id', journey.id);

        if (reactivationReqCount && reactivationReqCount > 0) {
          const { data: reactivationRequirements } = await supabase
            .from('journey_requirements')
            .select('*')
            .eq('journey_id', journey.id)
            .order('order', { ascending: true });

          if (reactivationRequirements && reactivationRequirements.length > 0) {
            const preCheckResult = await performPreChecks(supabase, user.id, journey.id, reactivationRequirements as any);
            if (!preCheckResult.passed) {
              console.log(`[Registration API] Pre-check failed for reactivation:`, preCheckResult);
              return NextResponse.json(
                { error: preCheckResult.failReason, failType: preCheckResult.failType },
                { status: 400 }
              );
            }
          }
        }

        // Delete old answers before reactivation (clean slate)
        const { error: deleteAnswersError } = await supabase
          .from('registration_answers')
          .delete()
          .eq('registration_id', existingRegistration.id);

        if (deleteAnswersError) {
          console.error('[Registration API] Error deleting old answers for reactivation:', deleteAnswersError);
        }

        // Reset AI assessment fields and reactivate
        const { data: updatedRegistration, error: updateError } = await supabase
          .from('registrations')
          .update({
            status: 'Pending approval',
            notes: notes || null,
            ai_match_score: null,
            ai_match_reasoning: null,
            auto_approved: null,
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

        // Handle answers if provided (question-type only)
        if (answers && Array.isArray(answers) && answers.length > 0) {
          const answersError = await handleRegistrationAnswers(supabase, updatedRegistration.id, answers, journey.id);
          if (answersError) {
            return NextResponse.json(
              { error: 'Registration reactivated but failed to save answers', details: answersError },
              { status: 500 }
            );
          }
        }

        // Check if journey has auto-approval enabled and trigger AI assessment
        const { data: journeySettings, error: journeySettingsError } = await supabase
          .from('journeys')
          .select('auto_approval_enabled')
          .eq('id', journey.id)
          .single();

        if (journeySettingsError) {
          console.error(`[Registration API] Error fetching journey settings for reactivation:`, journeySettingsError);
        }

        const autoApprovalEnabled = journeySettings?.auto_approval_enabled === true;

        // Trigger AI assessment if auto-approval enabled and requirements exist
        // Skills are assessed from profile (no answers needed), questions from answers
        if (autoApprovalEnabled && reactivationReqCount && reactivationReqCount > 0) {
          console.log(`[Registration API] Triggering AI assessment for reactivated registration: ${updatedRegistration.id}`);
          triggerAIAssessment(supabase, updatedRegistration.id);
        }

        // Notify owner about reactivated registration
        const ownerId = journey.boats.owner_id;
        if (ownerId) {
          const { data: reactivationCrewProfile } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', user.id)
            .single();

          const reactivationCrewName = reactivationCrewProfile?.full_name || reactivationCrewProfile?.username || 'A crew member';

          const reactivationNotifyResult = await notifyNewRegistration(supabase, ownerId, updatedRegistration.id, journey.id, journey.name || 'your journey', reactivationCrewName, user.id);
          if (reactivationNotifyResult.error) {
            console.error('[Registration API] Failed to notify owner of reactivated registration:', reactivationNotifyResult.error);
          }
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

    // Check if journey has auto-approval enabled and requirements
    console.log(`[Registration API] Checking auto-approval settings for journey: ${journey.id}`);
    const { data: journeySettings, error: journeySettingsError } = await supabase
      .from('journeys')
      .select('auto_approval_enabled, auto_approval_threshold')
      .eq('id', journey.id)
      .single();

    if (journeySettingsError) {
      console.error(`[Registration API] Error fetching journey settings:`, journeySettingsError);
    }

    console.log(`[Registration API] Journey settings:`, {
      journeyId: journey.id,
      auto_approval_enabled: journeySettings?.auto_approval_enabled,
      auto_approval_threshold: journeySettings?.auto_approval_threshold,
    });

    const { count: requirementCount, error: requirementCountError } = await supabase
      .from('journey_requirements')
      .select('*', { count: 'exact', head: true })
      .eq('journey_id', journey.id);

    if (requirementCountError) {
      console.error(`[Registration API] Error counting requirements:`, requirementCountError);
    }

    const hasRequirements = requirementCount && requirementCount > 0;
    const autoApprovalEnabled = journeySettings?.auto_approval_enabled === true;

    console.log(`[Registration API] Auto-approval check results:`, {
      autoApprovalEnabled,
      hasRequirements,
      requirementCount,
      answersProvided: !!(answers && Array.isArray(answers) && answers.length > 0),
      answersLength: answers?.length || 0,
    });

    // --- Pre-checks: Risk Level and Experience Level (instant, no AI) ---
    if (hasRequirements) {
      const { data: requirementsList } = await supabase
        .from('journey_requirements')
        .select('*')
        .eq('journey_id', journey.id)
        .order('order', { ascending: true });

      if (requirementsList && requirementsList.length > 0) {
        const preCheckResult = await performPreChecks(supabase, user.id, journey.id, requirementsList as any);
        if (!preCheckResult.passed) {
          console.log(`[Registration API] Pre-check failed:`, preCheckResult);
          return NextResponse.json(
            {
              error: preCheckResult.failReason,
              failType: preCheckResult.failType,
            },
            { status: 400 }
          );
        }
        console.log(`[Registration API] Pre-checks passed (risk level + experience level)`);

        // Check if question-type requirements need answers
        const questionReqs = requirementsList.filter((r: any) =>
          r.requirement_type === 'question'
        );
        if (questionReqs.length > 0 && autoApprovalEnabled) {
          const hasValidAnswers = answers && Array.isArray(answers) && answers.length > 0;
          if (!hasValidAnswers) {
            return NextResponse.json(
              {
                error: 'Answers are required for question-type requirements. Please complete all required questions.',
                failType: 'missing_answers',
              },
              { status: 400 }
            );
          }
        }
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
        match_percentage: 0,
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

    // Handle passport answer if provided
    let passportSaved = false;
    if (passport_document_id) {
      console.log(`[Registration API] Processing passport for registration ${registration.id}`);
      const passportError = await handlePassportAnswer(supabase, registration.id, passport_document_id, journey.id);
      if (passportError) {
        console.error(`[Registration API] Failed to save passport answer:`, passportError);
        return NextResponse.json(
          { error: 'Registration created but failed to save passport data', details: passportError },
          { status: 500 }
        );
      }
      passportSaved = true;
      console.log(`[Registration API] Successfully saved passport answer`);
    }

    // Handle answers if provided
    let answersSaved = false;
    console.log(`[Registration API] Processing answers:`, {
      registrationId: registration.id,
      hasAnswers: !!(answers && Array.isArray(answers)),
      answersLength: answers?.length || 0,
      answers: answers,
    });

    if (answers && Array.isArray(answers) && answers.length > 0) {
      console.log(`[Registration API] Saving ${answers.length} answers for registration ${registration.id}`);
      const answersError = await handleRegistrationAnswers(supabase, registration.id, answers, journey.id);
      if (answersError) {
        console.error(`[Registration API] Failed to save answers:`, answersError);
        // Registration created but answers failed - return error but registration exists
        return NextResponse.json(
          { error: 'Registration created but failed to save answers', details: answersError },
          { status: 500 }
        );
      }
      answersSaved = true;
      console.log(`[Registration API] Successfully saved ${answers.length} answers`);
    } else {
      console.log(`[Registration API] No answers to save (answers: ${answers}, isArray: ${Array.isArray(answers)}, length: ${answers?.length || 0})`);
    }

    // Trigger AI assessment if auto-approval enabled and requirements exist.
    // Skills are assessed from crew profile (no answers needed), questions from submitted answers.
    console.log(`[Registration API] AI assessment trigger check:`, {
      registrationId: registration.id,
      autoApprovalEnabled,
      hasRequirements,
      requirementCount,
      answersSaved,
    });

    if (autoApprovalEnabled && hasRequirements) {
      console.log(`[Registration API] Triggering AI assessment for registration: ${registration.id}`);
      triggerAIAssessment(supabase, registration.id);
    } else {
      console.log(`[Registration API] Skipping AI assessment:`, {
        reason: !autoApprovalEnabled ? 'auto-approval not enabled' : 'no requirements',
      });
    }

    // Notify the journey owner about the new registration (non-blocking)
    console.log('[Registration API] === NOTIFICATION DEBUG START ===');
    console.log('[Registration API] leg object keys:', Object.keys(leg));
    console.log('[Registration API] journey:', JSON.stringify(journey, null, 2));

    // Send notification if auto-approval is not enabled for this journey
    if (!autoApprovalEnabled) {
      const ownerId = journey.boats.owner_id;
      const journeyId = journey.id;
      const journeyName = journey.name || 'your journey';

      console.log('[Registration API] Owner notification data:', { ownerId, journeyId, journeyName });

      if (ownerId) {
        // Get crew member name
        const { data: crewProfile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .single();

        const crewName = crewProfile?.full_name || crewProfile?.username || 'A crew member';

        // Await notification to ensure it's sent before response (auth context needed)
        const notifyResult = await notifyNewRegistration(supabase, ownerId, registration.id, journeyId, journeyName, crewName, user.id);
        if (notifyResult.error) {
          console.error('[Registration API] Failed to notify owner of new registration:', notifyResult.error);
        } else {
          console.log('[Registration API] New registration notification sent to owner:', ownerId);
        }
      } else {
        console.error('[Registration API] No owner_id found, skipping notification');
      }
    }

    console.log('[Registration API] === NOTIFICATION DEBUG END ===');

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
