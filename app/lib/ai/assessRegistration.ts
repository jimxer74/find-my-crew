/**
 * AI Registration Assessment Service
 * 
 * This module handles AI assessment of crew registrations for automated approval.
 */

import { callAI } from './service';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  notifyRegistrationApproved,
  createNotification,
  NotificationType,
  sendReviewNeededEmail,
} from '@/app/lib/notifications';

/**
 * Assess a registration using AI and update the registration accordingly
 */
export async function assessRegistrationWithAI(
  supabase: SupabaseClient<any>,
  registrationId: string
): Promise<void> {
  console.log(`[AI Assessment] ========================================`);
  console.log(`[AI Assessment] 🚀 STARTING assessment for registration: ${registrationId}`);
  console.log(`[AI Assessment] Timestamp: ${new Date().toISOString()}`);
  console.log(`[AI Assessment] ========================================`);
  
  // Load registration with all related data
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
        name,
        skills,
        min_experience_level,
        risk_level,
        start_date,
        end_date,
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
    console.error(`[AI Assessment] Error loading registration ${registrationId}:`, regError);
    throw new Error(`Registration not found: ${registrationId}`);
  }

  // Type assertion for nested Supabase joins
  const legs = registration.legs as unknown as {
    id: string;
    journey_id: string;
    name: string;
    skills: string[];
    min_experience_level: number;
    risk_level: string;
    start_date: string;
    end_date: string;
    journeys: {
      id: string;
      name: string;
      auto_approval_enabled: boolean;
      auto_approval_threshold: number;
      boat_id: string;
      boats: {
        id: string;
        name: string;
        owner_id: string;
      };
    };
  } | null;

  console.log(`[AI Assessment] Registration loaded:`, {
    registrationId: registration.id,
    legId: registration.leg_id,
    userId: registration.user_id,
    status: registration.status,
    journeyName: legs?.journeys?.name,
    legName: legs?.name,
  });

  // Validate that we have the required nested data
  if (!legs?.journeys) {
    console.error(`[AI Assessment] Missing journey data for registration ${registration.id}`);
    throw new Error(`Missing journey data for registration: ${registration.id}`);
  }

  // Check if auto-approval is enabled
  if (!legs.journeys.auto_approval_enabled) {
    console.log(`[AI Assessment] Auto-approval not enabled for journey ${legs.journeys.id}, skipping assessment`);
    return; // No assessment needed
  }

  // Check if user has consented to AI processing (GDPR compliance)
  const { data: userConsents } = await supabase
    .from('user_consents')
    .select('ai_processing_consent')
    .eq('user_id', registration.user_id)
    .single();

  if (!userConsents?.ai_processing_consent) {
    console.log(`[AI Assessment] User ${registration.user_id} has not consented to AI processing, skipping assessment`);
    // Notify owner that manual review is needed due to missing AI consent
    const ownerId = legs?.journeys?.boats?.owner_id;
    
    if (!ownerId) {
      console.error(`[AI Assessment] Cannot notify owner: ownerId is null. Registration: ${registration.id}, Journey: ${legs?.journeys?.id}`);
      // Still return - we can't proceed without AI consent anyway
      return;
    }
    
    await createNotification(supabase, {
      user_id: ownerId,
      type: NotificationType.AI_REVIEW_NEEDED,
      title: 'Manual Review Required',
      message: `A crew member has applied but has not consented to AI matching. Please review manually.`,
      link: `/owner/registrations/${registration.id}`,
      metadata: {
        registration_id: registration.id,
        journey_id: legs?.journeys?.id,
        reason: 'no_ai_consent',
      },
    });
    return; // Cannot proceed without AI consent
  }

  console.log(`[AI Assessment] Auto-approval enabled, threshold: ${legs.journeys.auto_approval_threshold}%`);

  // Load requirements first - if no requirements, skip assessment
  const journeyId = legs.journeys.id;
  const { data: requirements } = await supabase
    .from('journey_requirements')
    .select('*')
    .eq('journey_id', journeyId)
    .order('order', { ascending: true });

  if (!requirements || requirements.length === 0) {
    console.log(`[AI Assessment] No requirements found for journey ${journeyId}, skipping assessment`);
    return; // No requirements means no assessment needed
  }

  // Load answers - wait a bit to ensure they're committed to database
  // Add a small delay to ensure answers are committed (race condition prevention)
  await new Promise(resolve => setTimeout(resolve, 500));
  
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

  // Validate that we have answers for all required questions
  const requiredRequirements = requirements.filter((r: any) => r.is_required);
  const answeredRequirementIds = (answers || []).map((a: any) => a.requirement_id);
  const missingRequired = requiredRequirements.filter((r: any) => !answeredRequirementIds.includes(r.id));

  if (missingRequired.length > 0) {
    console.error(`[AI Assessment] Missing answers for required questions:`, missingRequired.map((r: any) => r.id));
    throw new Error(`Missing answers for required questions: ${missingRequired.map((r: any) => r.question_text).join(', ')}`);
  }

  if (!answers || answers.length === 0) {
    console.error(`[AI Assessment] No answers found for registration ${registrationId}, cannot proceed with assessment`);
    throw new Error(`No answers found for registration ${registrationId}`);
  }

  // Load crew profile
  const { data: crewProfile } = await supabase
    .from('profiles')
    .select('full_name, sailing_experience, skills, risk_level, sailing_preferences')
    .eq('id', registration.user_id)
    .single();

  if (!crewProfile) {
    console.error(`[AI Assessment] Crew profile not found for user: ${registration.user_id}`);
    throw new Error(`Crew profile not found for user: ${registration.user_id}`);
  }

  console.log(`[AI Assessment] Crew profile loaded:`, {
    userId: registration.user_id,
    fullName: crewProfile.full_name,
    experienceLevel: crewProfile.sailing_experience,
    skillsCount: Array.isArray(crewProfile.skills) ? crewProfile.skills.length : 0,
    riskLevel: crewProfile.risk_level,
  });

  console.log(`[AI Assessment] Requirements and answers loaded:`, {
    requirementsCount: requirements.length,
    answersCount: answers.length,
    requirements: requirements.map((r: any) => ({
      id: r.id,
      question: r.question_text,
      type: r.question_type,
      weight: r.weight,
      required: r.is_required,
    })),
    answers: answers.map((a: any) => ({
      requirementId: a.requirement_id,
      answerText: a.answer_text,
      answerJson: a.answer_json,
    })),
  });

  // Build prompt
  console.log(`[AI Assessment] Building assessment prompt...`);
  const prompt = buildAssessmentPrompt({
    crewProfile,
    journey: legs.journeys,
    leg: legs,
    requirements: requirements || [],
    answers: answers || [],
  });

  console.log(`[AI Assessment] Prompt built, length: ${prompt.length} characters`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AI Assessment] Prompt preview (first 500 chars):`, prompt.substring(0, 500));
  }

  // Call AI
  console.log(`[AI Assessment] Calling AI service...`);
  const aiStartTime = Date.now();
  let aiResult;
  try {
    aiResult = await callAI({
      useCase: 'assess-registration',
      prompt,
    });
  } catch (aiError: any) {
    const aiDuration = Date.now() - aiStartTime;
    console.error(`[AI Assessment] AI call failed after ${aiDuration}ms:`, {
      error: aiError.message,
      provider: aiError.provider,
      model: aiError.model,
      originalError: aiError.originalError,
    });
    // Re-throw with more context
    throw new Error(`AI assessment failed: ${aiError.message} (Provider: ${aiError.provider || 'unknown'}, Model: ${aiError.model || 'unknown'})`);
  }
  
  const aiDuration = Date.now() - aiStartTime;
  console.log(`[AI Assessment] AI call completed in ${aiDuration}ms:`, {
    provider: aiResult.provider,
    model: aiResult.model,
    responseLength: aiResult.text.length,
  });

  // Parse response
  console.log(`[AI Assessment] Parsing AI response...`);
  let assessment: {
    match_score: number;
    reasoning: string;
    recommendation: 'approve' | 'deny' | 'review';
  };

  try {
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      assessment = JSON.parse(jsonMatch[0]);
      console.log(`[AI Assessment] Successfully parsed assessment:`, {
        matchScore: assessment.match_score,
        recommendation: assessment.recommendation,
        reasoningLength: assessment.reasoning?.length || 0,
      });
    } else {
      console.error(`[AI Assessment] No JSON found in AI response. Full response:`, aiResult.text);
      throw new Error('No JSON found in AI response');
    }
  } catch (parseError) {
    console.error(`[AI Assessment] Failed to parse AI response:`, {
      error: parseError,
      responseText: aiResult.text,
    });
    throw new Error(`Failed to parse AI assessment: ${parseError}`);
  }

  // Validate
  if (typeof assessment.match_score !== 'number' || assessment.match_score < 0 || assessment.match_score > 100) {
    console.error(`[AI Assessment] Invalid match_score:`, assessment.match_score);
    throw new Error(`Invalid match_score: ${assessment.match_score}`);
  }

  const threshold = legs.journeys.auto_approval_threshold || 80;
  const shouldAutoApprove = assessment.match_score >= threshold && assessment.recommendation !== 'deny';
  
  console.log(`[AI Assessment] Assessment results:`, {
    matchScore: assessment.match_score,
    threshold: threshold,
    recommendation: assessment.recommendation,
    shouldAutoApprove: shouldAutoApprove,
    currentStatus: registration.status,
  });

  // Update registration
  const updateData: any = {
    ai_match_score: Math.round(assessment.match_score),
    ai_match_reasoning: assessment.reasoning || null,
  };

  if (shouldAutoApprove && registration.status === 'Pending approval') {
    updateData.status = 'Approved';
    updateData.auto_approved = true;
    console.log(`[AI Assessment] Auto-approving registration: ${registrationId}`);
  } else {
    console.log(`[AI Assessment] Not auto-approving (score: ${assessment.match_score}%, threshold: ${threshold}%, status: ${registration.status})`);
  }

  console.log(`[AI Assessment] Updating registration with:`, {
    ai_match_score: updateData.ai_match_score,
    ai_match_reasoning_length: updateData.ai_match_reasoning?.length || 0,
    status: updateData.status || 'unchanged',
    auto_approved: updateData.auto_approved || false,
  });

  const { error: updateError } = await supabase
    .from('registrations')
    .update(updateData)
    .eq('id', registrationId);

  if (updateError) {
    console.error(`[AI Assessment] Failed to update registration:`, {
      registrationId,
      error: updateError,
      updateData,
    });
    throw new Error(`Failed to update registration: ${updateError.message}`);
  }

  console.log(`[AI Assessment] Successfully completed assessment for registration: ${registrationId}`, {
    finalStatus: updateData.status || registration.status,
    matchScore: updateData.ai_match_score,
    autoApproved: updateData.auto_approved || false,
  });

  // Get crew and owner info for notifications
  // journeyId is already defined earlier in the function
  const journeyName = legs?.journeys?.name;
  const crewUserId = registration.user_id;
  const ownerId = legs?.journeys?.boats?.owner_id;
  
  if (!ownerId) {
    console.error(`[AI Assessment] Cannot send notifications: ownerId is null. Registration: ${registration.id}, Journey: ${journeyId}`);
    // Continue with assessment update but skip notifications
  }

  // Get crew name for owner notification
  const { data: crewProfileData } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', crewUserId)
    .single();

  const crewName = crewProfileData?.full_name || crewProfileData?.username || 'A crew member';

  // Get owner name for crew notification
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', ownerId)
    .single();

  const ownerName = ownerProfile?.full_name || ownerProfile?.username || 'The boat owner';

  // Send notifications based on AI assessment result
  // Only send notifications if we have a valid ownerId
  if (ownerId) {
    if (updateData.auto_approved) {
      // Notify crew member of approval
      const crewNotifyResult = await notifyRegistrationApproved(supabase, crewUserId, journeyId, journeyName, ownerName, ownerId);
      if (crewNotifyResult.error) {
        console.error('[AI Assessment] Failed to send approval notification to crew:', crewNotifyResult.error);
      } else {
        console.log('[AI Assessment] Approval notification sent to crew:', crewUserId);
      }

      // Get crew profile info for avatar
      const { data: crewProfile } = await supabase
        .from('profiles')
        .select('profile_image_url')
        .eq('id', crewUserId)
        .single();

      // Notify owner that AI auto-approved the registration
      const ownerNotifyResult = await createNotification(supabase, {
        user_id: ownerId,
        type: NotificationType.AI_AUTO_APPROVED,
        title: 'Registration Auto-Approved',
        message: `${crewName}'s registration for "${journeyName}" was automatically approved by AI (Score: ${assessment.match_score}%).`,
        link: `/owner/registrations/${registrationId}`,
        metadata: {
          registration_id: registrationId,
          journey_id: journeyId,
          journey_name: journeyName,
          crew_name: crewName,
          crew_id: crewUserId,
          match_score: assessment.match_score,
          recommendation: assessment.recommendation,
          sender_id: crewUserId,
          sender_name: crewName,
          sender_avatar_url: crewProfile?.profile_image_url || null,
        },
      });
      if (ownerNotifyResult.error) {
        console.error('[AI Assessment] Failed to send auto-approval notification to owner:', ownerNotifyResult.error);
      } else {
        console.log('[AI Assessment] Auto-approval notification sent to owner:', ownerId);
      }
    } else {
      // Get crew profile info for avatar
      const { data: crewProfileForReview } = await supabase
        .from('profiles')
        .select('profile_image_url')
        .eq('id', crewUserId)
        .single();

      // Notify owner that manual review is needed
      const reviewNotifyResult = await createNotification(supabase, {
        user_id: ownerId,
        type: NotificationType.AI_REVIEW_NEEDED,
        title: 'Registration Needs Review',
        message: `${crewName}'s registration for "${journeyName}" needs your review (AI Score: ${assessment.match_score}%).`,
        link: `/owner/registrations/${registrationId}`,
        metadata: {
          registration_id: registrationId,
          journey_id: journeyId,
          journey_name: journeyName,
          crew_name: crewName,
          crew_id: crewUserId,
          match_score: assessment.match_score,
          recommendation: assessment.recommendation,
          sender_id: crewUserId,
          sender_name: crewName,
          sender_avatar_url: crewProfileForReview?.profile_image_url || null,
        },
      });
      if (reviewNotifyResult.error) {
        console.error('[AI Assessment] Failed to send review notification to owner:', reviewNotifyResult.error);
      } else {
        console.log('[AI Assessment] Review needed notification sent to owner:', ownerId);
      }

      // Send email notification to owner
      try {
        const { data: ownerEmailData } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', ownerId)
          .single();

        if (ownerEmailData?.email) {
          const registrationLink = `https://www.sailms.art/owner/registrations?registration=${registrationId}`;
          const emailResult = await sendReviewNeededEmail(
            supabase,
            ownerEmailData.email,
            ownerId,
            crewName,
            journeyName,
            assessment.match_score,
            registrationLink
          );
          if (emailResult.error) {
            console.error('[AI Assessment] Failed to send review needed email:', emailResult.error);
          } else {
            console.log('[AI Assessment] Review needed email sent to:', ownerEmailData.email);
          }
        } else {
          console.warn('[AI Assessment] Could not get email for owner:', ownerId);
        }
      } catch (emailErr) {
        console.error('[AI Assessment] Error sending review needed email:', emailErr);
      }
    }
  } else {
    console.warn('[AI Assessment] Skipping notifications: ownerId is null');
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
