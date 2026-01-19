/**
 * AI Registration Assessment Service
 * 
 * This module handles AI assessment of crew registrations for automated approval.
 */

import { callAI } from './service';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Assess a registration using AI and update the registration accordingly
 */
export async function assessRegistrationWithAI(
  supabase: SupabaseClient<any>,
  registrationId: string
): Promise<void> {
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
    throw new Error(`Registration not found: ${registrationId}`);
  }

  // Check if auto-approval is enabled
  if (!registration.legs.journeys.auto_approval_enabled) {
    return; // No assessment needed
  }

  // Load crew profile
  const { data: crewProfile } = await supabase
    .from('profiles')
    .select('full_name, sailing_experience, skills, risk_level, sailing_preferences')
    .eq('id', registration.user_id)
    .single();

  if (!crewProfile) {
    throw new Error(`Crew profile not found for user: ${registration.user_id}`);
  }

  // Load requirements and answers
  const { data: requirements } = await supabase
    .from('journey_requirements')
    .select('*')
    .eq('journey_id', registration.legs.journeys.id)
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

  // Build prompt
  const prompt = buildAssessmentPrompt({
    crewProfile,
    journey: registration.legs.journeys,
    leg: registration.legs,
    requirements: requirements || [],
    answers: answers || [],
  });

  // Call AI
  const aiResult = await callAI({
    useCase: 'assess-registration',
    prompt,
  });

  // Parse response
  let assessment: {
    match_score: number;
    reasoning: string;
    recommendation: 'approve' | 'deny' | 'review';
  };

  try {
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      assessment = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in AI response');
    }
  } catch (parseError) {
    console.error('Failed to parse AI response:', aiResult.text);
    throw new Error(`Failed to parse AI assessment: ${parseError}`);
  }

  // Validate
  if (typeof assessment.match_score !== 'number' || assessment.match_score < 0 || assessment.match_score > 100) {
    throw new Error(`Invalid match_score: ${assessment.match_score}`);
  }

  const threshold = registration.legs.journeys.auto_approval_threshold || 80;
  const shouldAutoApprove = assessment.match_score >= threshold && assessment.recommendation !== 'deny';

  // Update registration
  const updateData: any = {
    ai_match_score: Math.round(assessment.match_score),
    ai_match_reasoning: assessment.reasoning || null,
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
