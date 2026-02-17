/**
 * AI Registration Assessment Service
 *
 * Handles structured requirement assessment for crew registrations:
 * 1. Risk Level - instant check (no AI)
 * 2. Experience Level - instant check (no AI)
 * 3. Passport - AI verification with optional photo-ID
 * 4. Skill - AI assessment with weighted scoring
 * 5. Question - AI assessment against qualification criteria
 */

import { callAI } from './service';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  notifyRegistrationApproved,
  createNotification,
  NotificationType,
  sendReviewNeededEmail,
  notifyPendingRegistration,
} from '@/app/lib/notifications';

type RequirementType = 'risk_level' | 'experience_level' | 'skill' | 'passport' | 'question';

interface Requirement {
  id: string;
  journey_id: string;
  requirement_type: RequirementType;
  question_text?: string;
  skill_name?: string;
  qualification_criteria?: string;
  weight: number;
  require_photo_validation?: boolean;
  pass_confidence_score?: number;
  is_required: boolean;
  order: number;
}

interface SkillAssessmentResult {
  requirement_id: string;
  skill_name: string;
  score: number; // 0-10
  reasoning: string;
  passed: boolean;
}

interface QuestionAssessmentResult {
  requirement_id: string;
  score: number; // 0-10
  reasoning: string;
  passed: boolean;
}

/**
 * Perform instant (non-AI) pre-checks for risk level and experience level.
 * Returns null if all checks pass, or an error message if a check fails.
 */
export async function performPreChecks(
  supabase: SupabaseClient<any>,
  userId: string,
  journeyId: string,
  requirements: Requirement[]
): Promise<{ passed: boolean; failReason?: string; failType?: string }> {
  console.log(`[Pre-Checks] Starting pre-checks for user ${userId}, journey ${journeyId}`);

  // Load crew profile
  const { data: crewProfile } = await supabase
    .from('profiles')
    .select('sailing_experience, risk_level')
    .eq('id', userId)
    .single();

  if (!crewProfile) {
    return { passed: false, failReason: 'Crew profile not found', failType: 'profile_missing' };
  }

  // Load journey data for risk_level (array) and min_experience_level
  const { data: journey } = await supabase
    .from('journeys')
    .select('risk_level, min_experience_level')
    .eq('id', journeyId)
    .single();

  console.log(`[Pre-Checks] Journey data:`, {
    risk_level: journey?.risk_level,
    risk_level_type: typeof journey?.risk_level,
    risk_level_is_array: Array.isArray(journey?.risk_level),
    min_experience_level: journey?.min_experience_level
  });

  if (!journey) {
    return { passed: false, failReason: 'Journey not found', failType: 'journey_missing' };
  }

  // Check 1: Risk Level
  const riskReq = requirements.find(r => r.requirement_type === 'risk_level');
  if (riskReq) {
    console.log(`[Pre-Checks] Risk level check for requirement ${riskReq.id}`);

    // Ensure journeyRiskLevels is always an array - handle both array and scalar cases
    const rawJourneyRiskLevel = (journey as any).risk_level;
    let journeyRiskLevels: string[];

    if (Array.isArray(rawJourneyRiskLevel)) {
      // Already an array
      journeyRiskLevels = rawJourneyRiskLevel;
    } else if (rawJourneyRiskLevel && typeof rawJourneyRiskLevel === 'string') {
      // Single string value - convert to array
      journeyRiskLevels = [rawJourneyRiskLevel];
    } else if (rawJourneyRiskLevel && typeof rawJourneyRiskLevel === 'string') {
      // Handle edge case where it might be a JSON array string
      try {
        const parsed = JSON.parse(rawJourneyRiskLevel);
        journeyRiskLevels = Array.isArray(parsed) ? parsed : [rawJourneyRiskLevel];
      } catch {
        journeyRiskLevels = [rawJourneyRiskLevel];
      }
    } else {
      // No risk level defined - empty array
      journeyRiskLevels = [];
    }

    const crewRiskLevels: string[] = Array.isArray(crewProfile.risk_level)
      ? crewProfile.risk_level
      : crewProfile.risk_level ? [crewProfile.risk_level] : [];

    console.log(`[Pre-Checks] Risk levels comparison:`, {
      rawJourneyRiskLevel,
      journeyRiskLevels,
      crewRiskLevels,
      crewRiskLevels_type: typeof crewRiskLevels,
      crewRiskLevels_is_array: Array.isArray(crewRiskLevels)
    });

    // Crew must have ALL risk levels defined for the journey
    const missingRiskLevels = journeyRiskLevels.filter(
      (rl: string) => !crewRiskLevels.includes(rl)
    );

    console.log(`[Pre-Checks] Missing risk levels:`, missingRiskLevels);

    if (missingRiskLevels.length > 0) {
      return {
        passed: false,
        failReason: `Your comfort level doesn't match the journey requirements. Missing: ${missingRiskLevels.join(', ')}. Please update your profile to include these comfort levels.`,
        failType: 'risk_level',
      };
    }
  }

  // Check 2: Experience Level
  const expReq = requirements.find(r => r.requirement_type === 'experience_level');
  if (expReq) {
    const requiredLevel = (journey as any).min_experience_level || 1;
    const crewLevel = crewProfile.sailing_experience || 1;

    if (crewLevel < requiredLevel) {
      const levelNames: Record<number, string> = {
        1: 'Beginner',
        2: 'Competent Crew',
        3: 'Coastal Skipper',
        4: 'Offshore Skipper',
      };
      return {
        passed: false,
        failReason: `Your experience level (${levelNames[crewLevel] || crewLevel}) is below the required level (${levelNames[requiredLevel] || requiredLevel}).`,
        failType: 'experience_level',
      };
    }
  }

  return { passed: true };
}

/**
 * Assess skill requirements using AI.
 * Evaluates each skill requirement individually against the crew's profile skill descriptions.
 */
async function assessSkillRequirements(
  supabase: SupabaseClient<any>,
  crewProfile: any,
  requirements: Requirement[]
): Promise<SkillAssessmentResult[]> {
  const skillReqs = requirements.filter(r => r.requirement_type === 'skill');
  if (skillReqs.length === 0) return [];

  // Parse crew skills from JSON strings into a map of skill_name -> description
  const crewSkillsMap: Record<string, string> = {};
  const crewSkills = crewProfile.skills || [];
  for (const skillJson of crewSkills) {
    try {
      const parsed = typeof skillJson === 'string' ? JSON.parse(skillJson) : skillJson;
      if (parsed.skill_name) {
        crewSkillsMap[parsed.skill_name] = parsed.description || '';
      }
    } catch {
      // Not a JSON skill entry, skip
    }
  }

  // Build a single prompt for all skill assessments (batched for cost efficiency)
  const skillAssessments = skillReqs.map((req, idx) => {
    const crewDescription = crewSkillsMap[req.skill_name!] || 'No description provided by crew member';
    return `
Skill ${idx + 1}: ${req.skill_name}
Weight: ${req.weight}/10
Qualification Criteria (set by skipper): ${req.qualification_criteria}
Crew's Skill Description: ${crewDescription}`;
  });

  const prompt = `You are assessing a crew member's skills for a sailing journey registration.

For each skill below, evaluate how well the crew member's skill description meets the skipper's qualification criteria. Return a score from 0 to 10 for each skill.

${skillAssessments.join('\n')}

Respond with ONLY a JSON array, one object per skill, in order:
[
  {
    "skill_name": "<skill name>",
    "score": <integer 0-10>,
    "reasoning": "<brief explanation>"
  }
]

Scoring guide:
- 0: No evidence at all
- 1-3: Minimal/weak evidence
- 4-6: Moderate evidence, partially meets criteria
- 7-8: Strong evidence, meets most criteria
- 9-10: Excellent evidence, fully meets or exceeds criteria

Respond with ONLY the JSON array, no additional text.`;

  try {
    const aiResult = await callAI({ useCase: 'assess-registration', prompt });

    // Parse response
    const jsonMatch = aiResult.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[AI Assessment] No JSON array found in skill assessment response:', aiResult.text);
      throw new Error('Failed to parse skill assessment response');
    }

    const assessments = JSON.parse(jsonMatch[0]);

    return skillReqs.map((req, idx) => {
      const assessment = assessments[idx] || { score: 0, reasoning: 'Assessment failed' };
      const score = Math.max(0, Math.min(10, Math.round(assessment.score)));
      return {
        requirement_id: req.id,
        skill_name: req.skill_name!,
        score,
        reasoning: assessment.reasoning || '',
        passed: true, // Individual pass/fail is determined by combined score
      };
    });
  } catch (error: any) {
    console.error('[AI Assessment] Skill assessment failed:', error);
    throw error;
  }
}

/**
 * Assess question requirements using AI.
 */
async function assessQuestionRequirements(
  supabase: SupabaseClient<any>,
  answers: any[],
  requirements: Requirement[]
): Promise<QuestionAssessmentResult[]> {
  const questionReqs = requirements.filter(r => r.requirement_type === 'question');
  if (questionReqs.length === 0) return [];

  const qaSection = questionReqs.map((req, idx) => {
    const answer = answers.find((a: any) => a.requirement_id === req.id);
    const answerText = answer?.answer_text || answer?.answer_json || 'No answer provided';
    return `
Question ${idx + 1} (Weight: ${req.weight}/10):
Question: ${req.question_text}
Qualification Criteria: ${req.qualification_criteria}
Crew's Answer: ${typeof answerText === 'string' ? answerText : JSON.stringify(answerText)}`;
  });

  const prompt = `You are assessing a crew member's answers to registration questions for a sailing journey.

For each question below, evaluate how well the crew member's answer meets the qualification criteria set by the skipper.

${qaSection.join('\n')}

Respond with ONLY a JSON array, one object per question, in order:
[
  {
    "score": <integer 0-10>,
    "reasoning": "<brief explanation>"
  }
]

Scoring guide:
- 0: No relevant answer / completely off-topic
- 1-3: Poor answer, barely addresses criteria
- 4-6: Adequate answer, partially meets criteria
- 7-8: Good answer, meets most criteria
- 9-10: Excellent answer, fully meets criteria

Respond with ONLY the JSON array, no additional text.`;

  try {
    const aiResult = await callAI({ useCase: 'assess-registration', prompt });

    const jsonMatch = aiResult.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[AI Assessment] No JSON array found in question assessment response:', aiResult.text);
      throw new Error('Failed to parse question assessment response');
    }

    const assessments = JSON.parse(jsonMatch[0]);

    return questionReqs.map((req, idx) => {
      const assessment = assessments[idx] || { score: 0, reasoning: 'Assessment failed' };
      const score = Math.max(0, Math.min(10, Math.round(assessment.score)));
      return {
        requirement_id: req.id,
        score,
        reasoning: assessment.reasoning || '',
        passed: true, // Pass/fail determined by combined logic
      };
    });
  } catch (error: any) {
    console.error('[AI Assessment] Question assessment failed:', error);
    throw error;
  }
}

/**
 * Calculate the combined weighted score across all AI-assessed results.
 * Each result has a score (0-10) and an associated weight.
 * Returns a score scaled to 0-100 for comparison against auto_approval_threshold.
 *
 * The overall score is: (sum of score*weight for each requirement) / (sum of weights) * 10
 * This gives a 0-100 percentage where 100 means every requirement scored 10/10.
 */
function calculateOverallScore(
  results: Array<{ requirement_id: string; score: number }>,
  requirements: Requirement[]
): number {
  if (results.length === 0) return 100; // No AI-assessed requirements = full score

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const result of results) {
    const req = requirements.find(r => r.id === result.requirement_id);
    const weight = req?.weight || 5;
    totalWeightedScore += result.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 100;
  // Scale from 0-10 to 0-100
  return Math.round((totalWeightedScore / totalWeight) * 10);
}

/**
 * Main assessment function: Assess a registration using AI and update accordingly.
 * Called after pre-checks have passed and registration is created.
 */
export async function assessRegistrationWithAI(
  supabase: SupabaseClient<any>,
  registrationId: string
): Promise<void> {
  console.log(`[AI Assessment] Starting assessment for registration: ${registrationId}`);

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

  const legs = registration.legs as unknown as {
    id: string;
    journey_id: string;
    name: string;
    skills: string[];
    min_experience_level: number;
    risk_level: string; // Single enum value for legs
    start_date: string;
    end_date: string;
    journeys: {
      id: string;
      name: string;
      auto_approval_enabled: boolean;
      auto_approval_threshold: number;
      boat_id: string;
      risk_level: string[]; // Array of enum values for journeys
      boats: { id: string; name: string; owner_id: string };
    };
  } | null;

  if (!legs?.journeys) {
    throw new Error(`Missing journey data for registration: ${registration.id}`);
  }

  if (!legs.journeys.auto_approval_enabled) {
    console.log(`[AI Assessment] Auto-approval not enabled for journey ${legs.journeys.id}, skipping`);
    return;
  }

  // Check GDPR AI consent
  const { data: userConsents } = await supabase
    .from('user_consents')
    .select('ai_processing_consent')
    .eq('user_id', registration.user_id)
    .single();

  if (!userConsents?.ai_processing_consent) {
    console.log(`[AI Assessment] User ${registration.user_id} has not consented to AI processing`);
    const ownerId = legs.journeys.boats?.owner_id;
    if (ownerId) {
      await createNotification(supabase, {
        user_id: ownerId,
        type: NotificationType.AI_REVIEW_NEEDED,
        title: 'Manual Review Required',
        message: `A crew member has applied but has not consented to AI matching. Please review manually.`,
        link: `/owner/registrations/${registration.id}`,
        metadata: {
          registration_id: registration.id,
          journey_id: legs.journeys.id,
          reason: 'no_ai_consent',
        },
      });
    }
    return;
  }

  const journeyId = legs.journeys.id;

  // Load requirements
  const { data: requirements } = await supabase
    .from('journey_requirements')
    .select('*')
    .eq('journey_id', journeyId)
    .order('order', { ascending: true });

  if (!requirements || requirements.length === 0) {
    console.log(`[AI Assessment] No requirements for journey ${journeyId}, skipping`);
    return;
  }

  // Wait for answers to be committed
  await new Promise(resolve => setTimeout(resolve, 500));

  // Load answers
  const { data: answers } = await supabase
    .from('registration_answers')
    .select('*')
    .eq('registration_id', registrationId);

  // Load crew profile
  const { data: crewProfile } = await supabase
    .from('profiles')
    .select('full_name, sailing_experience, skills, risk_level, sailing_preferences')
    .eq('id', registration.user_id)
    .single();

  if (!crewProfile) {
    throw new Error(`Crew profile not found for user: ${registration.user_id}`);
  }

  const typedRequirements = requirements as Requirement[];
  let assessmentFailed = false;
  let overallReasoning: string[] = [];

  // Collect all individual AI-assessed results for unified scoring
  const allScoredResults: Array<{ requirement_id: string; score: number }> = [];

  // --- Assess Skill Requirements ---
  const skillReqs = typedRequirements.filter(r => r.requirement_type === 'skill');
  if (skillReqs.length > 0) {
    try {
      const skillResults = await assessSkillRequirements(supabase, crewProfile, typedRequirements);

      for (const result of skillResults) {
        allScoredResults.push({ requirement_id: result.requirement_id, score: result.score });

        await supabase.from('registration_answers').upsert({
          registration_id: registrationId,
          requirement_id: result.requirement_id,
          ai_score: result.score,
          ai_reasoning: result.reasoning,
          passed: null, // Individual pass/fail determined by overall score
        }, { onConflict: 'registration_id,requirement_id' });

        overallReasoning.push(`Skill "${result.skill_name}": ${result.score}/10 - ${result.reasoning}`);
      }
    } catch (error) {
      console.error('[AI Assessment] Skill assessment failed:', error);
      overallReasoning.push('Skills assessment: Failed due to error');
      assessmentFailed = true;
    }
  }

  // --- Assess Question Requirements ---
  const questionReqs = typedRequirements.filter(r => r.requirement_type === 'question');
  if (questionReqs.length > 0 && answers && answers.length > 0) {
    try {
      const questionResults = await assessQuestionRequirements(supabase, answers, typedRequirements);

      for (const result of questionResults) {
        allScoredResults.push({ requirement_id: result.requirement_id, score: result.score });

        const req = typedRequirements.find(r => r.id === result.requirement_id);
        await supabase.from('registration_answers').upsert({
          registration_id: registrationId,
          requirement_id: result.requirement_id,
          ai_score: result.score,
          ai_reasoning: result.reasoning,
          passed: null, // Individual pass/fail determined by overall score
        }, { onConflict: 'registration_id,requirement_id' });

        overallReasoning.push(`Question "${req?.question_text?.substring(0, 50) || '?'}": ${result.score}/10 - ${result.reasoning}`);
      }
    } catch (error) {
      console.error('[AI Assessment] Question assessment failed:', error);
      overallReasoning.push('Questions assessment: Failed due to error');
      assessmentFailed = true;
    }
  }

  // --- Mark non-AI requirements as passed (risk_level, experience_level already checked in pre-checks) ---
  for (const req of typedRequirements) {
    if (req.requirement_type === 'risk_level' || req.requirement_type === 'experience_level') {
      await supabase.from('registration_answers').upsert({
        registration_id: registrationId,
        requirement_id: req.id,
        passed: true, // Pre-checks already verified these
      }, { onConflict: 'registration_id,requirement_id' });
    }
  }

  // --- Calculate overall score ---
  // Single weighted average across ALL AI-assessed requirements (skills + questions), scaled to 0-100.
  // Each requirement's score (0-10) is weighted by its configured weight.
  // The result is a 0-100 percentage compared against the single auto_approval_threshold.
  const finalScore = calculateOverallScore(allScoredResults, typedRequirements);

  const threshold = legs.journeys.auto_approval_threshold || 80;
  const shouldAutoApprove = !assessmentFailed && finalScore >= threshold;

  // Update individual answer records with the overall pass/fail
  for (const result of allScoredResults) {
    await supabase.from('registration_answers')
      .update({ passed: shouldAutoApprove })
      .eq('registration_id', registrationId)
      .eq('requirement_id', result.requirement_id);
  }

  overallReasoning.push(`Overall: ${finalScore}% (threshold: ${threshold}%). ${shouldAutoApprove ? 'AUTO-APPROVED' : assessmentFailed ? 'FAILED (error)' : 'BELOW THRESHOLD'}`);
  console.log(`[AI Assessment] Final: score=${finalScore}, threshold=${threshold}, failed=${assessmentFailed}, autoApprove=${shouldAutoApprove}`);

  // Update registration
  const updateData: Record<string, any> = {
    ai_match_score: finalScore,
    ai_match_reasoning: overallReasoning.join('\n'),
  };

  if (shouldAutoApprove && registration.status === 'Pending approval') {
    updateData.status = 'Approved';
    updateData.auto_approved = true;
  }

  const { error: updateError } = await supabase
    .from('registrations')
    .update(updateData)
    .eq('id', registrationId);

  if (updateError) {
    throw new Error(`Failed to update registration: ${updateError.message}`);
  }

  // --- Notifications ---
  const ownerId = legs.journeys.boats?.owner_id;
  if (!ownerId) {
    console.warn('[AI Assessment] No ownerId, skipping notifications');
    return;
  }

  const { data: crewProfileData } = await supabase
    .from('profiles')
    .select('full_name, username, profile_image_url')
    .eq('id', registration.user_id)
    .single();

  const crewName = crewProfileData?.full_name || crewProfileData?.username || 'A crew member';
  const journeyName = legs.journeys.name;

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', ownerId)
    .single();
  const ownerName = ownerProfile?.full_name || ownerProfile?.username || 'The boat owner';

  if (updateData.auto_approved) {
    // Notify crew of approval
    await notifyRegistrationApproved(supabase, registration.user_id, journeyId, journeyName, ownerName, ownerId);

    // Notify owner of auto-approval
    await createNotification(supabase, {
      user_id: ownerId,
      type: NotificationType.AI_AUTO_APPROVED,
      title: 'Registration Auto-Approved',
      message: `${crewName}'s registration for "${journeyName}" was automatically approved (Score: ${finalScore}%).`,
      link: `/owner/registrations/${registrationId}`,
      metadata: {
        registration_id: registrationId,
        journey_id: journeyId,
        journey_name: journeyName,
        crew_name: crewName,
        crew_id: registration.user_id,
        match_score: finalScore,
        sender_id: registration.user_id,
        sender_name: crewName,
        sender_avatar_url: crewProfileData?.profile_image_url || null,
      },
    });
  } else {
    // Notify crew of pending
    await notifyPendingRegistration(
      supabase,
      registration.user_id,
      registrationId,
      journeyId,
      journeyName,
      legs.name || 'Unknown Leg'
    );

    // Notify owner to review
    await createNotification(supabase, {
      user_id: ownerId,
      type: NotificationType.AI_REVIEW_NEEDED,
      title: 'Registration Needs Review',
      message: `${crewName}'s registration for "${journeyName}" needs your review (AI Score: ${finalScore}%).`,
      link: `/owner/registrations/${registrationId}`,
      metadata: {
        registration_id: registrationId,
        journey_id: journeyId,
        journey_name: journeyName,
        crew_name: crewName,
        crew_id: registration.user_id,
        match_score: finalScore,
        sender_id: registration.user_id,
        sender_name: crewName,
        sender_avatar_url: crewProfileData?.profile_image_url || null,
      },
    });

    // Send email to owner
    try {
      const { data: ownerEmailData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', ownerId)
        .single();

      if (ownerEmailData?.email) {
        const registrationLink = `https://www.sailms.art/owner/registrations?registration=${registrationId}`;
        await sendReviewNeededEmail(
          supabase,
          ownerEmailData.email,
          ownerId,
          crewName,
          journeyName,
          finalScore,
          registrationLink
        );
      }
    } catch (emailErr) {
      console.error('[AI Assessment] Error sending review needed email:', emailErr);
    }
  }
}
