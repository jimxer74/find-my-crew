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
import { logger } from '@/app/lib/logger';
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
  logger.debug(`Starting pre-checks for user ${userId}, journey ${journeyId}`, { userId, journeyId }, true);

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

  logger.debug(`Journey data loaded`, {
    risk_level: journey?.risk_level,
    risk_level_type: typeof journey?.risk_level,
    risk_level_is_array: Array.isArray(journey?.risk_level),
    min_experience_level: journey?.min_experience_level
  }, true);

  if (!journey) {
    return { passed: false, failReason: 'Journey not found', failType: 'journey_missing' };
  }

  // Check 1: Risk Level
  const riskReq = requirements.find(r => r.requirement_type === 'risk_level');
  if (riskReq) {
    logger.debug(`Risk level check for requirement ${riskReq.id}`, { requirementId: riskReq.id }, true);

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

    logger.debug(`Risk levels comparison`, {
      rawJourneyRiskLevel,
      journeyRiskLevels,
      crewRiskLevels,
      crewRiskLevels_type: typeof crewRiskLevels,
      crewRiskLevels_is_array: Array.isArray(crewRiskLevels)
    }, true);

    // Crew must have ALL risk levels defined for the journey
    const missingRiskLevels = journeyRiskLevels.filter(
      (rl: string) => !crewRiskLevels.includes(rl)
    );

    logger.debug(`Missing risk levels`, { missingRiskLevels }, true);

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
      logger.error(`No JSON array found in skill assessment response`, { response: aiResult.text.substring(0, 200) });
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
    logger.error(`Skill assessment failed`, { error: error instanceof Error ? error.message : String(error) });
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
      logger.error(`No JSON array found in question assessment response`, { response: aiResult.text.substring(0, 200) });
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
    logger.error(`Question assessment failed`, { error: error instanceof Error ? error.message : String(error) });
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
  if (results.length === 0) {
    logger.debug(`No results to score, returning 100`, {}, true);
    return 100; // No AI-assessed requirements = full score
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;
  const scoreBreakdown: Array<{ requirementId: string; type: string; score: number; weight: number; weighted: number }> = [];

  for (const result of results) {
    const req = requirements.find(r => r.id === result.requirement_id);
    const weight = req?.weight || 5;
    const weighted = result.score * weight;

    scoreBreakdown.push({
      requirementId: result.requirement_id,
      type: req?.requirement_type || 'unknown',
      score: result.score,
      weight,
      weighted,
    });

    totalWeightedScore += weighted;
    totalWeight += weight;
  }

  logger.debug(`Score breakdown`, { scoreBreakdown }, true);
  logger.debug(`Totals`, { totalWeightedScore, totalWeight }, true);

  if (totalWeight === 0) {
    logger.debug(`Total weight is 0, returning 100`, {}, true);
    return 100;
  }

  // Scale from 0-10 to 0-100
  const finalScore = Math.round((totalWeightedScore / totalWeight) * 10);
  logger.debug(`Final calculation`, {
    formula: `(${totalWeightedScore} / ${totalWeight}) * 10`,
    result: finalScore,
  }, true);

  return finalScore;
}

/**
 * Assess passport requirement using AI vision.
 * Validates passport document and optionally matches facial photo if require_photo_validation is true.
 */
async function assessPassportRequirement(
  supabase: SupabaseClient<any>,
  registrationId: string,
  userId: string,
  requirements: Requirement[]
): Promise<Array<{ requirement_id: string; score: number; passed: boolean; reasoning: string; photoVerified?: boolean; photoConfidenceScore?: number }>> {
  logger.aiFlow('Passport', 'Starting passport requirement assessment', {});
  const passportReqs = requirements.filter(r => r.requirement_type === 'passport');
  if (passportReqs.length === 0) {
    logger.debug(`No passport requirements found`, {}, true);
    return [];
  }

  logger.debug(`Found ${passportReqs.length} passport requirement(s)`, { count: passportReqs.length }, true);

  try {
    // Fetch passport answer to get document ID and photo data
    logger.debug(`Fetching passport answer for registration`, { registrationId }, true);
    const { data: passportAnswers } = await supabase
      .from('registration_answers')
      .select('requirement_id, passport_document_id, photo_file_data')
      .eq('registration_id', registrationId)
      .eq('requirement_id', passportReqs[0].id)
      .single();

    logger.debug(`Passport answer retrieved`, {
      hasPassportId: !!passportAnswers?.passport_document_id,
      hasPhotoData: !!passportAnswers?.photo_file_data,
      photoDataLength: passportAnswers?.photo_file_data?.length || 0,
    }, true);

    if (!passportAnswers?.passport_document_id) {
      logger.debug(`No passport document ID found in answers`, {}, true);
      return passportReqs.map(req => ({
        requirement_id: req.id,
        score: 0,
        passed: false,
        reasoning: 'No passport document provided',
      }));
    }

    const passportDocId = passportAnswers.passport_document_id;
    const passportReq = passportReqs[0];
    const requirePhotoValidation = passportReq.require_photo_validation || false;
    const passConfidenceThreshold = (passportReq.pass_confidence_score || 7) / 10; // Convert 0-10 scale to 0-1

    logger.debug(`Configuration`, {
      passportDocId,
      requirePhotoValidation,
      passConfidenceThreshold,
      passConfidenceScore: passportReq.pass_confidence_score,
    }, true);

    // Fetch passport document from storage
    logger.debug(`Fetching document from vault`, { passportDocId }, true);
    const { data: passportDoc, error: docError } = await supabase
      .from('document_vault')
      .select('id, file_path, metadata')
      .eq('id', passportDocId)
      .eq('owner_id', userId)
      .single();

    logger.debug(`Document fetch result`, { hasError: !!docError, hasDoc: !!passportDoc }, true);

    if (docError || !passportDoc) {
      logger.error(`Passport document not accessible`, { error: docError instanceof Error ? docError.message : String(docError) });
      return [{
        requirement_id: passportReq.id,
        score: 0,
        passed: false,
        reasoning: 'Passport document not accessible',
      }];
    }

    logger.debug(`Document found`, { id: passportDoc.id, filePath: passportDoc.file_path }, true);

    // Download passport file from storage (using service role)
    logger.debug(`Downloading file from storage`, { filePath: passportDoc.file_path }, true);
    const { data: passportFileData, error: downloadError } = await supabase.storage
      .from('secure-documents')
      .download(passportDoc.file_path);

    logger.debug(`Download result`, { hasError: !!downloadError, hasData: !!passportFileData }, true);

    if (downloadError || !passportFileData) {
      logger.error(`Failed to download passport file`, { error: downloadError instanceof Error ? downloadError.message : String(downloadError) });
      return [{
        requirement_id: passportReq.id,
        score: 0,
        passed: false,
        reasoning: 'Could not download passport document',
      }];
    }

    logger.debug(`File downloaded successfully`, { size: passportFileData.size }, true);

    // Convert file to base64 for AI processing
    const passportBase64 = await passportFileData.arrayBuffer().then(buffer =>
      Buffer.from(buffer).toString('base64')
    );

    logger.debug(`Base64 encoding complete`, { length: passportBase64.length }, true);

    // Build passport validation prompt
    const passportPrompt = `You are validating a passport document for crew member registration.

Examine this passport image and provide:
1. Is this a valid passport document? (yes/no)
2. Is the passport expired? Check the expiry date. (yes/no)
3. Extract the holder name from the passport (first and last name)
4. Provide a confidence score 0-1.0 on whether this is a legitimate passport

Respond with ONLY a JSON object:
{
  "is_valid_passport": true/false,
  "is_expired": true/false,
  "holder_name": "<name>",
  "confidence_score": <number 0-1.0>,
  "reasoning": "<brief explanation>"
}

Respond with ONLY the JSON object, no additional text.`;

    logger.debug(`Sending to AI for passport validation`, { imageLength: passportBase64.length, promptLength: passportPrompt.length }, true);

    // Call AI for passport validation
    const passportResult = await callAI({
      useCase: 'assess-registration',
      prompt: passportPrompt,
      image: {
        data: passportBase64,
        mimeType: 'image/jpeg',
      },
    });

    logger.debug(`AI Response received`, {
      text: passportResult.text.substring(0, 200),
      textLength: passportResult.text.length,
    }, true);

    let passportValidation = {
      is_valid_passport: false,
      is_expired: false,
      holder_name: '',
      confidence_score: 0,
      reasoning: 'Failed to parse response',
    };

    try {
      const jsonMatch = passportResult.text.match(/\{[\s\S]*\}/);
      logger.debug(`JSON match result`, { matched: !!jsonMatch, result: jsonMatch ? jsonMatch[0].substring(0, 100) : 'NO MATCH' }, true);

      if (jsonMatch) {
        passportValidation = JSON.parse(jsonMatch[0]);
        logger.debug(`Parsed validation`, passportValidation, true);
      } else {
        logger.error(`No JSON found in response`, {});
      }
    } catch (e) {
      logger.error(`Failed to parse passport validation response`, { error: e instanceof Error ? e.message : String(e) });
    }

    // Calculate passport score (0-10 scale)
    let passportScore = 0;
    let photoVerified = false;
    let photoConfidenceScore = 0;

    if (passportValidation.is_valid_passport && !passportValidation.is_expired) {
      passportScore = Math.round(passportValidation.confidence_score * 10);

      // If photo validation required, attempt to verify photo against passport
      if (requirePhotoValidation) {
        const photoFileData = passportAnswers?.photo_file_data;

        if (photoFileData) {
          // Photo was provided - perform facial matching with AI
          logger.aiFlow('Passport', 'Performing facial matching with provided photo', {});

          const photoMatchingPrompt = `You are performing facial verification for a crew member registration.

You have:
1. A passport document image
2. A facial photo (selfie or ID photo) from the crew member

Your task: Compare the face in the passport image with the face in the provided photo and determine if they match.

Provide your analysis in this JSON format:
{
  "faces_match": true/false,
  "confidence_score": <number 0-1.0>,
  "reasoning": "<explanation of your conclusion>",
  "face_quality": "<good|acceptable|poor>",
  "match_indicators": ["<indicator 1>", "<indicator 2>"]
}

Respond with ONLY the JSON object, no additional text.`;

          try {
            // Call AI with both images for facial matching
            const matchingResult = await callAI({
              useCase: 'assess-registration',
              prompt: photoMatchingPrompt,
              image: {
                data: photoFileData, // Use the stored photo data
                mimeType: 'image/jpeg',
              },
            });

            logger.debug(`Facial matching result received`, {
              textLength: matchingResult.text.length,
            }, true);

            let photoMatching = {
              faces_match: false,
              confidence_score: 0,
              reasoning: 'Failed to parse response',
              face_quality: 'poor',
              match_indicators: [],
            };

            try {
              const jsonMatch = matchingResult.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                photoMatching = JSON.parse(jsonMatch[0]);
                logger.debug(`Parsed photo matching`, photoMatching, true);
              }
            } catch (e) {
              logger.error(`Failed to parse photo matching response`, { error: e instanceof Error ? e.message : String(e) });
            }

            if (photoMatching.faces_match && photoMatching.confidence_score >= 0.7) {
              photoVerified = true;
              photoConfidenceScore = photoMatching.confidence_score;
              logger.debug(`Photo verified with confidence: ${(photoConfidenceScore * 100).toFixed(0)}%`, { photoConfidenceScore }, true);
            } else {
              logger.debug(`Photo verification failed or low confidence: ${(photoMatching.confidence_score * 100).toFixed(0)}%`, { confidence: photoMatching.confidence_score }, true);
              passportScore = Math.max(0, passportScore - 3); // Deduct points for failed photo verification
            }
          } catch (photoError) {
            logger.error(`Failed to perform facial matching`, { error: photoError instanceof Error ? photoError.message : String(photoError) });
            passportScore = Math.max(0, passportScore - 3); // Deduct points for failed photo verification attempt
          }
        } else {
          // Photo validation required but no photo provided
          logger.warn(`Photo validation required but no photo provided`, {});
          passportScore = Math.max(0, passportScore - 3); // Deduct points for missing photo
        }
      }
    }

    const passed = passportScore >= (passportReq.pass_confidence_score || 7);

    logger.debug(`Final result`, {
      score: passportScore,
      passed,
      photoVerified,
      photoConfidenceScore,
      threshold: passportReq.pass_confidence_score || 7,
    }, true);

    return [{
      requirement_id: passportReq.id,
      score: passportScore,
      passed,
      reasoning: `Passport ${passportValidation.is_valid_passport ? 'valid' : 'invalid'}${passportValidation.is_expired ? ', expired' : ''}. Confidence: ${(passportValidation.confidence_score * 100).toFixed(0)}%.${requirePhotoValidation ? (photoVerified ? ` Photo verified (${(photoConfidenceScore * 100).toFixed(0)}% match).` : ' Photo verification failed.') : ''}`,
      photoVerified,
      photoConfidenceScore: photoConfidenceScore || 0,
    }];
  } catch (error: any) {
    logger.error(`Passport assessment failed`, { error: error instanceof Error ? error.message : String(error) });
    return passportReqs.map(req => ({
      requirement_id: req.id,
      score: 0,
      passed: false,
      reasoning: `Assessment error: ${error.message}`,
    }));
  }
}

/**
 * Main assessment function: Assess a registration using AI and update accordingly.
 * Called after pre-checks have passed and registration is created.
 */
export async function assessRegistrationWithAI(
  supabase: SupabaseClient<any>,
  registrationId: string
): Promise<void> {
  logger.aiFlow('Assessment', `Starting assessment for registration: ${registrationId}`, { registrationId });

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
    logger.error(`Error loading registration ${registrationId}`, { error: regError instanceof Error ? regError.message : String(regError) });
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
    logger.debug(`Auto-approval not enabled for journey, skipping`, { journeyId: legs.journeys.id }, true);
    return;
  }

  // Check GDPR AI consent
  const { data: userConsents } = await supabase
    .from('user_consents')
    .select('ai_processing_consent')
    .eq('user_id', registration.user_id)
    .single();

  if (!userConsents?.ai_processing_consent) {
    logger.debug(`User has not consented to AI processing`, { userId: registration.user_id }, true);
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
  logger.aiFlow('Assessment', 'STARTING ASSESSMENT', { journeyId, registrationId, userId: registration.user_id });

  const { data: requirements } = await supabase
    .from('journey_requirements')
    .select('*')
    .eq('journey_id', journeyId)
    .order('order', { ascending: true });

  if (!requirements || requirements.length === 0) {
    logger.debug(`No requirements for journey, skipping`, { journeyId }, true);
    return;
  }

  logger.debug(`Requirements found`, {
    count: requirements.length,
    types: requirements.map(r => r.requirement_type).join(', '),
    details: requirements.map(r => ({
      id: r.id,
      type: r.requirement_type,
      required_value: r.required_value,
    })),
  }, true);

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

  logger.debug(`Crew profile loaded`, {
    name: crewProfile.full_name,
    experience: crewProfile.sailing_experience,
    skillsCount: crewProfile.skills?.length || 0,
    riskLevel: crewProfile.risk_level,
  }, true);

  const typedRequirements = requirements as Requirement[];
  let assessmentFailed = false;
  let overallReasoning: string[] = [];

  // Collect all individual AI-assessed results for unified scoring
  const allScoredResults: Array<{ requirement_id: string; score: number }> = [];

  // --- Assess Passport Requirement ---
  const passportReqs = typedRequirements.filter(r => r.requirement_type === 'passport');
  if (passportReqs.length > 0) {
    logger.aiFlow('Assessment', `Starting passport assessment (${passportReqs.length} requirements)`, { count: passportReqs.length });
    try {
      const passportResults = await assessPassportRequirement(supabase, registrationId, registration.user_id, typedRequirements);

      logger.debug(`Passport assessment results`, { count: passportResults.length, results: passportResults }, true);

      for (const result of passportResults) {
        allScoredResults.push({ requirement_id: result.requirement_id, score: result.score });

        await supabase.from('registration_answers').upsert({
          registration_id: registrationId,
          requirement_id: result.requirement_id,
          ai_score: result.score,
          ai_reasoning: result.reasoning,
          photo_verification_passed: result.photoVerified || null,
          photo_confidence_score: result.photoConfidenceScore || null,
          passed: null, // Individual pass/fail determined by overall score
        }, { onConflict: 'registration_id,requirement_id' });

        overallReasoning.push(`Passport: ${result.score}/10 - ${result.reasoning}`);
      }
    } catch (error) {
      logger.error(`Passport assessment failed`, { error: error instanceof Error ? error.message : String(error) });
      overallReasoning.push('Passport assessment: Failed due to error');
      assessmentFailed = true;
    }
  }

  // --- Assess Skill Requirements ---
  const skillReqs = typedRequirements.filter(r => r.requirement_type === 'skill');
  logger.debug(`Skill requirements found`, { count: skillReqs.length }, true);
  if (skillReqs.length > 0) {
    try {
      logger.aiFlow('Assessment', `Assessing skills: ${skillReqs.map(r => r.skill_name || 'unknown').join(', ')}`, { skills: skillReqs.map(r => r.skill_name) });
      const skillResults = await assessSkillRequirements(supabase, crewProfile, typedRequirements);

      logger.debug(`Skill assessment results`, { count: skillResults.length, results: skillResults }, true);

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
      logger.error(`Skill assessment failed`, { error: error instanceof Error ? error.message : String(error) });
      overallReasoning.push('Skills assessment: Failed due to error');
      assessmentFailed = true;
    }
  }

  // --- Assess Question Requirements ---
  const questionReqs = typedRequirements.filter(r => r.requirement_type === 'question');
  logger.debug(`Question requirements found`, { requirementCount: questionReqs.length, answerCount: answers?.length || 0 }, true);
  if (questionReqs.length > 0 && answers && answers.length > 0) {
    try {
      logger.aiFlow('Assessment', `Assessing questions with ${answers.length} answers`, { answerCount: answers.length });
      const questionResults = await assessQuestionRequirements(supabase, answers, typedRequirements);

      logger.debug(`Question assessment results`, { count: questionResults.length, results: questionResults }, true);

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
      logger.error(`Question assessment failed`, { error: error instanceof Error ? error.message : String(error) });
      overallReasoning.push('Questions assessment: Failed due to error');
      assessmentFailed = true;
    }
  }

  // --- Mark non-AI requirements as passed (risk_level, experience_level already checked in pre-checks) ---
  const preCheckReqs = typedRequirements.filter(r => r.requirement_type === 'risk_level' || r.requirement_type === 'experience_level');
  logger.debug(`Pre-check requirements marked as passed`, { count: preCheckReqs.length }, true);
  for (const req of preCheckReqs) {
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
  logger.debug(`Calculating overall score`, { resultCount: allScoredResults.length, results: allScoredResults }, true);
  const finalScore = calculateOverallScore(allScoredResults, typedRequirements);

  const threshold = legs.journeys.auto_approval_threshold || 80;
  const shouldAutoApprove = !assessmentFailed && finalScore >= threshold;

  logger.debug(`Score calculation complete`, {
    finalScore,
    threshold,
    shouldAutoApprove,
    assessmentFailed,
  }, true);

  // Update individual answer records with the overall pass/fail
  for (const result of allScoredResults) {
    await supabase.from('registration_answers')
      .update({ passed: shouldAutoApprove })
      .eq('registration_id', registrationId)
      .eq('requirement_id', result.requirement_id);
  }

  overallReasoning.push(`Overall: ${finalScore}% (threshold: ${threshold}%). ${shouldAutoApprove ? 'AUTO-APPROVED' : assessmentFailed ? 'FAILED (error)' : 'BELOW THRESHOLD'}`);
  logger.aiFlow('Assessment', 'ASSESSMENT COMPLETE', {
    finalScore,
    threshold,
    assessmentFailed,
    shouldAutoApprove,
    reasoning: overallReasoning.join(' | ')
  });

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
    logger.warn(`No ownerId, skipping notifications`, {});
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
      logger.error('[AI Assessment] Error sending review needed email:', { error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
    }
  }
}
