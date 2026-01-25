import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { assessRegistrationWithAI } from '@/app/lib/ai/assessRegistration';
import { hasCrewRole } from '@/app/lib/auth/checkRole';
import { notifyNewRegistration } from '@/app/lib/notifications';

// Extend timeout for registration with AI assessment
export const maxDuration = 90; // 90 seconds
export const runtime = 'nodejs';

/**
 * Helper function to handle registration answers
 */
async function handleRegistrationAnswers(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  registrationId: string,
  answers: Array<{ requirement_id: string; answer_text?: string; answer_json?: any }>,
  journeyId: string
): Promise<string | null> {
  // Get journey requirements to validate answers
  const { data: requirements } = await supabase
    .from('journey_requirements')
    .select('id, question_type, is_required')
    .eq('journey_id', journeyId);

  if (!requirements || requirements.length === 0) {
    return 'No requirements found for this journey';
  }

  const requirementsMap = new Map(requirements.map((r: any) => [r.id, r]));

  // Validate all required questions are answered
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
      return `Invalid requirement_id: ${answer.requirement_id}`;
    }

    // Validate format based on question type
    if (requirement.question_type === 'text' || requirement.question_type === 'yes_no') {
      if (!answer.answer_text || answer.answer_text.trim() === '') {
        return `answer_text is required for ${requirement.question_type} questions`;
      }
      if (requirement.question_type === 'yes_no' && !['Yes', 'No'].includes(answer.answer_text)) {
        return 'yes_no questions require answer_text to be "Yes" or "No"';
      }
    } else if (requirement.question_type === 'multiple_choice' || requirement.question_type === 'rating') {
      if (!answer.answer_json) {
        return `answer_json is required for ${requirement.question_type} questions`;
      }
    }
  }

  // Insert answers
  const answersToInsert = answers.map((answer: any) => ({
    registration_id: registrationId,
    requirement_id: answer.requirement_id,
    answer_text: answer.answer_text || null,
    answer_json: answer.answer_json || null,
  }));

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
      .select('roles, role')
      .eq('id', user.id)
      .single();

    if (!profile || !hasCrewRole(profile)) {
      return NextResponse.json(
        { error: 'Only crew members can register for legs' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { leg_id, notes, answers } = body;

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

        // Handle answers if provided
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
        console.log(`[Registration API] Checking auto-approval for reactivated registration: ${updatedRegistration.id}`);
        const { data: journeySettings, error: journeySettingsError } = await supabase
          .from('journeys')
          .select('auto_approval_enabled, auto_approval_threshold')
          .eq('id', journey.id)
          .single();

        if (journeySettingsError) {
          console.error(`[Registration API] Error fetching journey settings for reactivation:`, journeySettingsError);
        }

        const { count: requirementCount, error: requirementCountError } = await supabase
          .from('journey_requirements')
          .select('*', { count: 'exact', head: true })
          .eq('journey_id', journey.id);

        if (requirementCountError) {
          console.error(`[Registration API] Error counting requirements for reactivation:`, requirementCountError);
        }

        const hasRequirements = requirementCount && requirementCount > 0;
        const autoApprovalEnabled = journeySettings?.auto_approval_enabled === true;
        const answersSaved = answers && Array.isArray(answers) && answers.length > 0;

        console.log(`[Registration API] Reactivation AI assessment check:`, {
          registrationId: updatedRegistration.id,
          autoApprovalEnabled,
          hasRequirements,
          requirementCount,
          answersSaved,
          answersLength: answers?.length || 0,
          allConditionsMet: autoApprovalEnabled && hasRequirements && answersSaved,
        });

        // Trigger AI assessment if auto-approval is enabled (same logic as new registration)
        if (autoApprovalEnabled && hasRequirements && answersSaved) {
          console.log(`[Registration API] ✅ ALL CONDITIONS MET - Triggering AI assessment for reactivated registration: ${updatedRegistration.id}`, {
            journeyId: journey.id,
            autoApprovalEnabled,
            hasRequirements,
            requirementCount,
            answersCount: answers.length,
          });
          Promise.resolve()
            .then(() => {
              console.log(`[Registration API] Waiting 1 second before calling AI assessment for reactivated registration...`);
              return new Promise(resolve => setTimeout(resolve, 1000));
            })
            .then(() => {
              console.log(`[Registration API] Calling assessRegistrationWithAI for reactivated registration: ${updatedRegistration.id}`);
              return assessRegistrationWithAI(supabase, updatedRegistration.id);
            })
            .then(() => {
              console.log(`[Registration API] ✅ AI assessment completed successfully for reactivated registration: ${updatedRegistration.id}`);
            })
            .catch((error) => {
              console.error(`[Registration API] ❌ AI assessment failed (non-blocking) for reactivated registration ${updatedRegistration.id}:`, {
                error: error.message,
                stack: error.stack,
                errorName: error.name,
              });
              // Don't fail registration reactivation if AI assessment fails
            });
        } else {
          console.log(`[Registration API] ❌ SKIPPING AI assessment for reactivated registration - Conditions not met:`, {
            registrationId: updatedRegistration.id,
            autoApprovalEnabled,
            hasRequirements,
            requirementCount,
            answersSaved,
            reason: !autoApprovalEnabled ? 'auto-approval not enabled' : !hasRequirements ? 'no requirements' : !answersSaved ? 'answers not saved' : 'unknown',
          });
        }

        // Notify owner about reactivated registration
        const reactivationJourney = Array.isArray(leg.journeys) ? leg.journeys[0] : leg.journeys;
        if (reactivationJourney) {
          const reactivationBoat = Array.isArray(reactivationJourney.boats) ? reactivationJourney.boats[0] : reactivationJourney.boats;
          const reactivationOwnerId = reactivationBoat?.owner_id;
          const reactivationJourneyId = reactivationJourney.id;
          const reactivationJourneyName = reactivationJourney.name || 'your journey';

          if (reactivationOwnerId) {
            const { data: reactivationCrewProfile } = await supabase
              .from('profiles')
              .select('full_name, username')
              .eq('id', user.id)
              .single();

            const reactivationCrewName = reactivationCrewProfile?.full_name || reactivationCrewProfile?.username || 'A crew member';

            // Await notification to ensure it's sent before response
            const reactivationNotifyResult = await notifyNewRegistration(supabase, reactivationOwnerId, updatedRegistration.id, reactivationJourneyId, reactivationJourneyName, reactivationCrewName, user.id);
            if (reactivationNotifyResult.error) {
              console.error('[Registration API] Failed to notify owner of reactivated registration:', reactivationNotifyResult.error);
            } else {
              console.log('[Registration API] Reactivated registration notification sent to owner:', reactivationOwnerId);
            }
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

    // If auto-approval is enabled, require answers
    if (autoApprovalEnabled && hasRequirements) {
      console.log(`[Registration API] Checking answers requirement:`, {
        autoApprovalEnabled,
        hasRequirements,
        requirementCount,
        answersProvided: !!(answers && Array.isArray(answers)),
        answersLength: answers?.length || 0,
        answers: answers,
        answersType: typeof answers,
        answersIsArray: Array.isArray(answers),
      });
      
      // Check if answers are missing or empty
      const hasValidAnswers = answers && Array.isArray(answers) && answers.length > 0;
      
      if (!hasValidAnswers) {
        console.error(`[Registration API] ❌ 400 ERROR: Answers required but not provided`, {
          journeyId: journey.id,
          autoApprovalEnabled,
          hasRequirements,
          requirementCount,
          answersType: typeof answers,
          answersIsArray: Array.isArray(answers),
          answersLength: answers?.length || 0,
          answersValue: answers,
        });
        return NextResponse.json(
          { 
            error: 'Answers are required for journeys with automated approval enabled. Please complete all required questions.',
            details: {
              journeyId: journey.id,
              autoApprovalEnabled,
              hasRequirements,
              requirementCount,
              answersProvided: !!(answers && Array.isArray(answers)),
              answersLength: answers?.length || 0,
            }
          },
          { status: 400 }
        );
      }
      
      console.log(`[Registration API] ✅ Answers validation passed: ${answers.length} answers provided`);
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

    // Trigger AI assessment if auto-approval is enabled
    // Only trigger if: auto-approval enabled AND requirements exist AND answers were saved
    console.log(`[Registration API] Evaluating AI assessment trigger conditions:`, {
      registrationId: registration.id,
      journeyId: journey.id,
      autoApprovalEnabled,
      hasRequirements,
      requirementCount,
      answersSaved,
      answersProvided: !!(answers && Array.isArray(answers) && answers.length > 0),
      answersLength: answers?.length || 0,
      allConditionsMet: autoApprovalEnabled && hasRequirements && answersSaved,
    });

    if (autoApprovalEnabled && hasRequirements && answersSaved) {
      console.log(`[Registration API] ✅ ALL CONDITIONS MET - Triggering AI assessment for registration: ${registration.id}`, {
        journeyId: journey.id,
        autoApprovalEnabled,
        hasRequirements,
        requirementCount,
        answersCount: answers.length,
        answersSaved,
      });
      // Trigger AI assessment asynchronously (don't await to avoid blocking)
      // Add a small delay to ensure database transaction is committed
      // Use Promise-based delay instead of setTimeout for better error handling
      Promise.resolve()
        .then(() => {
          console.log(`[Registration API] Waiting 1 second before calling AI assessment...`);
          return new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        })
        .then(() => {
          console.log(`[Registration API] Calling assessRegistrationWithAI for registration: ${registration.id}`);
          return assessRegistrationWithAI(supabase, registration.id);
        })
        .then(() => {
          console.log(`[Registration API] ✅ AI assessment completed successfully for registration: ${registration.id}`);
        })
        .catch((error) => {
          console.error(`[Registration API] ❌ AI assessment failed (non-blocking) for registration ${registration.id}:`, {
            error: error.message,
            stack: error.stack,
            errorName: error.name,
            errorType: typeof error,
          });
          // Don't fail registration creation if AI assessment fails
        });
    } else {
      console.log(`[Registration API] ❌ SKIPPING AI assessment - Conditions not met:`, {
        registrationId: registration.id,
        autoApprovalEnabled,
        hasRequirements,
        requirementCount,
        answersSaved,
        hasAnswers: !!(answers && answers.length > 0),
        answersLength: answers?.length || 0,
        reason: !autoApprovalEnabled ? 'auto-approval not enabled' : !hasRequirements ? 'no requirements' : !answersSaved ? 'answers not saved' : 'unknown',
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
