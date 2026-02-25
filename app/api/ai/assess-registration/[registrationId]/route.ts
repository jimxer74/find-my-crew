import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { callAI } from '@shared/ai/service';
import { hasOwnerRole } from '@shared/auth';
import { parseJsonObjectFromAIResponse } from '@shared/ai/shared';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';

// Extend timeout for AI assessment (can take up to 60+ seconds)
export const maxDuration = 90; // 90 seconds
export const runtime = 'nodejs';

/**
 * POST /api/ai/assess-registration/[registrationId]
 * 
 * Triggers AI assessment for a registration.
 * Only journey owners or system can trigger assessments.
 * 
 * Returns:
 * - ai_match_score: 0-100
 * - ai_match_reasoning: explanation
 * - recommendation: 'approve' | 'deny' | 'review'
 * - Updates registration with score and potentially auto-approves if threshold met
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const registrationId = resolvedParams.registrationId;
    
    logger.aiFlow('start', 'AI assessment triggered', { registrationId });
    
    const supabase = await getSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error('Unauthorized access attempt for assessment', { registrationId });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.debug('Authenticated user accessing assessment', { userId: user.id }, true);

    // Verify registration exists
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select(`
        id,
        leg_id,
        user_id,
        status,
        legs!inner (
          id,
          journey_id,
          journeys!inner (
            id,
            name,
            auto_approval_enabled,
            auto_approval_threshold,
            boat_id,
            boats!inner (
              id,
              name,
              owner_id
            )
          )
        )
      `)
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      logger.error('Registration not found for assessment', { registrationId, error: regError?.message });
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const registrationData = registration as any;

    logger.debug('Registration loaded for assessment', {
      registrationId: registrationData.id,
      journeyId: registrationData.legs?.journeys?.id,
      status: registrationData.status,
      autoApprovalEnabled: registrationData.legs?.journeys?.auto_approval_enabled,
    }, true);

    // Check if auto-approval is enabled for this journey
    if (!registrationData.legs?.journeys?.auto_approval_enabled) {
      logger.debug('Auto-approval not enabled for journey - cannot assess', { journeyId: registrationData.legs?.journeys?.id }, true);
      return NextResponse.json(
        { error: 'Auto-approval is not enabled for this journey' },
        { status: 400 }
      );
    }

    // Verify user is journey owner (or allow system calls)
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    const isJourneyOwner = registrationData.legs?.journeys?.boats?.owner_id === user.id;
    if (!isJourneyOwner && !hasOwnerRole(profile)) {
      return NextResponse.json(
        { error: 'Only journey owners can trigger assessments' },
        { status: 403 }
      );
    }

    // Load crew profile
    const { data: crewProfile } = await supabase
      .from('profiles')
      .select('full_name, sailing_experience, skills, risk_level, sailing_preferences')
      .eq('id', registrationData.user_id)
      .single();

    if (!crewProfile) {
      return NextResponse.json(
        { error: 'Crew profile not found' },
        { status: 404 }
      );
    }

    // Load journey requirements and answers
    const { data: requirements } = await supabase
      .from('journey_requirements')
      .select('*')
      .eq('journey_id', registrationData.legs?.journeys?.id)
      .order('order', { ascending: true });

    const { data: answers } = await supabase
      .from('registration_answers')
      .select(`
        requirement_id,
        answer_text,
        answer_json,
        journey_requirements!inner (
          question_text,
          question_type,
          weight
        )
      `)
      .eq('registration_id', registrationId);

    // Load leg details
    const { data: leg } = await supabase
      .from('legs')
      .select('name, skills, min_experience_level, risk_level, start_date, end_date')
      .eq('id', registrationData.leg_id)
      .single();

    logger.debug('Assessment data loaded', {
      crewExperience: crewProfile.sailing_experience,
      skillsCount: Array.isArray(crewProfile.skills) ? crewProfile.skills.length : 0,
      requirementsCount: requirements?.length || 0,
      answersCount: answers?.length || 0,
    }, true);

    // Build AI prompt
    logger.debug('Building assessment prompt', {}, true);
    const prompt = buildAssessmentPrompt({
      crewProfile,
      journey: registrationData.legs?.journeys,
      leg,
      requirements: requirements || [],
      answers: answers || [],
    });

    logger.debug('Prompt built', { length: prompt.length }, true);

    // Call AI service
    logger.aiFlow('api_call', 'Calling Claude AI for assessment', { promptLength: prompt.length, registrationId });
    let aiResponse: string;
    const aiStartTime = Date.now();
    try {
      const result = await callAI({
        useCase: 'assess-registration',
        prompt,
      });
      aiResponse = result.text;
      const aiDuration = Date.now() - aiStartTime;
      logger.debug('AI call completed', {
        provider: result.provider,
        model: result.model,
        durationMs: aiDuration,
        responseLength: aiResponse.length,
      }, true);
    } catch (aiError: any) {
      const aiDuration = Date.now() - aiStartTime;
      logger.error('AI assessment failed', {
        durationMs: aiDuration,
        error: aiError instanceof Error ? aiError.message : String(aiError),
        registrationId,
      });
      return NextResponse.json(
        {
          error: 'AI assessment failed',
          details: aiError instanceof Error ? aiError.message : String(aiError),
          // Don't update registration, keep as pending
        },
        { status: 500 }
      );
    }

    // Parse AI response (expecting JSON)
    logger.debug('Parsing AI response', {}, true);
    let assessment: {
      match_score: number;
      reasoning: string;
      recommendation: 'approve' | 'deny' | 'review';
    };

    try {
      // Parse JSON from AI response using shared utility
      assessment = parseJsonObjectFromAIResponse(aiResponse) as {
        match_score: number;
        reasoning: string;
        recommendation: 'approve' | 'deny' | 'review';
      };
      logger.debug('Successfully parsed assessment', {
        matchScore: assessment.match_score,
        recommendation: assessment.recommendation,
        reasoningLength: assessment.reasoning?.length || 0,
      }, true);
    } catch (parseError) {
      logger.error('Failed to parse AI response', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responseLength: aiResponse.length,
      });
      return NextResponse.json(
        {
          error: 'Failed to parse AI assessment response',
          rawResponse: aiResponse.substring(0, 500), // Include first 500 chars for debugging
        },
        { status: 500 }
      );
    }

    // Validate assessment
    if (typeof assessment.match_score !== 'number' || assessment.match_score < 0 || assessment.match_score > 100) {
      logger.error('Invalid match_score from AI', { matchScore: assessment.match_score });
      return NextResponse.json(
        { error: 'Invalid match_score from AI (must be 0-100)' },
        { status: 500 }
      );
    }

    const threshold = registrationData.legs?.journeys?.auto_approval_threshold || 80;
    const shouldAutoApprove = assessment.match_score >= threshold && assessment.recommendation !== 'deny';

    logger.debug('Assessment results calculated', {
      matchScore: assessment.match_score,
      threshold,
      recommendation: assessment.recommendation,
      shouldAutoApprove,
    }, true);

    // Update registration with AI assessment
    const updateData: any = {
      ai_match_score: Math.round(assessment.match_score),
      ai_match_reasoning: assessment.reasoning || null,
    };

    if (shouldAutoApprove && registrationData.status === 'Pending approval') {
      updateData.status = 'Approved';
      updateData.auto_approved = true;
      logger.debug('Auto-approving registration', { registrationId }, true);
    } else {
      logger.debug('Not auto-approving registration', {
        score: assessment.match_score,
        threshold,
        status: registrationData.status,
      }, true);
    }

    logger.debug('Updating registration with assessment', {
      matchScore: updateData.ai_match_score,
      statusChange: updateData.status ? `${registrationData.status} -> ${updateData.status}` : 'no change',
      autoApproved: updateData.auto_approved || false,
    }, true);

    const { data: updatedRegistration, error: updateError } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', registrationId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating registration with assessment', {
        registrationId,
        error: updateError.message,
      });
      return NextResponse.json(
        { error: 'Failed to update registration with assessment', details: updateError.message },
        { status: 500 }
      );
    }

    logger.debug('Assessment completed successfully', {
      registrationId,
      matchScore: updateData.ai_match_score,
      finalStatus: updateData.status || registrationData.status,
      autoApproved: updateData.auto_approved || false,
    }, true);

    return NextResponse.json({
      assessment: {
        match_score: assessment.match_score,
        reasoning: assessment.reasoning,
        recommendation: assessment.recommendation,
        threshold,
        auto_approved: shouldAutoApprove,
      },
      registration: updatedRegistration,
      message: shouldAutoApprove 
        ? 'Registration auto-approved based on AI assessment'
        : 'AI assessment completed, awaiting manual review',
    });

  } catch (error: any) {
    logger.error('AI assessment failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'AI assessment failed'),
      { status: 500 }
    );
  }
}

/**
 * Build the AI assessment prompt
 */
function buildAssessmentPrompt(data: {
  crewProfile: any;
  journey: any;
  leg: any;
  requirements: any[];
  answers: any[];
}): string {
  const { crewProfile, journey, leg, requirements, answers } = data;

  // Parse crew skills from JSON strings
  const crewSkills = (crewProfile.skills || []).map((skillJson: string) => {
    try {
      const parsed = JSON.parse(skillJson);
      return parsed.skill_name || skillJson;
    } catch {
      return skillJson;
    }
  });

  // Build requirements Q&A section
  const qaSection = requirements.map((req, idx) => {
    const answer = answers.find((a: any) => a.requirement_id === req.id);
    let answerText = 'Not answered';
    
    if (answer) {
      if (req.question_type === 'text' || req.question_type === 'yes_no') {
        answerText = answer.answer_text || 'Not answered';
      } else {
        answerText = JSON.stringify(answer.answer_json);
      }
    }

    return `Q${idx + 1} (Weight: ${req.weight}/10): ${req.question_text}
A${idx + 1}: ${answerText}`;
  }).join('\n\n');

  return `You are an expert sailing crew matching assistant. Your role is to assess how well a crew member matches the requirements for a sailing journey leg based on their profile, experience, and answers to custom questions.

Crew Member Profile:
- Name: ${crewProfile.full_name || 'Not provided'}
- Experience Level: ${crewProfile.sailing_experience || 'Not specified'} (1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper)
- Skills: ${crewSkills.length > 0 ? crewSkills.join(', ') : 'None listed'}
- Risk Tolerance: ${Array.isArray(crewProfile.risk_level) ? crewProfile.risk_level.join(', ') : 'Not specified'}
- Sailing Preferences: ${crewProfile.sailing_preferences || 'Not specified'}

Journey Requirements:
- Journey: ${journey.name}
- Leg: ${leg?.name || 'N/A'}
- Required Skills: ${Array.isArray(leg?.skills) ? leg.skills.join(', ') : 'None specified'}
- Required Experience Level: ${leg?.min_experience_level || 'Not specified'} (1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper)
- Risk Level: ${leg?.risk_level || 'Not specified'}
- Dates: ${leg?.start_date ? new Date(leg.start_date).toLocaleDateString() : 'N/A'} to ${leg?.end_date ? new Date(leg.end_date).toLocaleDateString() : 'N/A'}

Custom Questions & Answers:
${qaSection || 'No custom questions'}

Please assess this match and provide a JSON response with exactly this structure:
{
  "match_score": <integer 0-100>,
  "reasoning": "<string explaining your assessment, considering skills, experience, risk tolerance, and custom question answers>",
  "recommendation": "<'approve', 'deny', or 'review'>"
}

Be thorough and fair. Consider:
- Technical skills match
- Experience level appropriateness
- Risk tolerance alignment
- Quality and relevance of answers to custom questions
- Overall fit for the journey

Respond with ONLY the JSON object, no additional text.`;
}
