/**
 * Proactive Suggestions Matching Service
 *
 * Generates suggestions for users when new matching opportunities arise.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SuggestionType } from './types';

interface MatchResult {
  userId: string;
  score: number;
  reason: string;
}

/**
 * Find crew members that match a leg's requirements
 * Call this when a new leg is published or requirements change
 */
export async function findMatchingCrew(
  supabase: SupabaseClient,
  legId: string,
  options: {
    minScore?: number;
    maxResults?: number;
  } = {}
): Promise<MatchResult[]> {
  const { minScore = 50, maxResults = 20 } = options;

  // Get leg requirements
  const { data: leg } = await supabase
    .from('legs')
    .select(`
      id,
      name,
      skills,
      risk_level,
      min_experience_level,
      journeys!inner (
        id,
        name,
        state,
        boats!inner (
          owner_id
        )
      )
    `)
    .eq('id', legId)
    .single();

  if (!leg || (leg as any).journeys.state !== 'Published') {
    return [];
  }

  const ownerId = (leg as any).journeys.boats.owner_id;
  const requiredSkills = leg.skills || [];
  const legRiskLevel = leg.risk_level;
  const minExperience = leg.min_experience_level || 1;

  // Get all crew members with AI consent who haven't already registered
  const { data: registeredUsers } = await supabase
    .from('registrations')
    .select('user_id')
    .eq('leg_id', legId);

  const registeredUserIds = new Set((registeredUsers || []).map(r => r.user_id));
  registeredUserIds.add(ownerId); // Exclude owner

  // Get potential crew members
  const { data: crewProfiles } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      sailing_experience,
      skills,
      risk_level
    `)
    .contains('roles', ['crew']);

  if (!crewProfiles) return [];

  // Check AI consent for each user
  const { data: consents } = await supabase
    .from('user_consents')
    .select('user_id, ai_processing_consent')
    .eq('ai_processing_consent', true);

  const usersWithConsent = new Set((consents || []).map(c => c.user_id));

  // Calculate match scores
  const matches: MatchResult[] = [];

  for (const profile of crewProfiles) {
    // Skip if already registered or no AI consent
    if (registeredUserIds.has(profile.id) || !usersWithConsent.has(profile.id)) {
      continue;
    }

    const userSkills = profile.skills || [];
    const userRiskLevels = profile.risk_level || [];
    const userExperience = profile.sailing_experience || 1;

    // Calculate skill match
    const matchingSkills = requiredSkills.filter((s: string) => userSkills.includes(s));
    const skillScore = requiredSkills.length > 0
      ? (matchingSkills.length / requiredSkills.length) * 40
      : 40;

    // Calculate experience match
    const experienceScore = userExperience >= minExperience ? 40 : 0;

    // Calculate risk level match
    const riskScore = !legRiskLevel || userRiskLevels.includes(legRiskLevel) ? 20 : 0;

    const totalScore = Math.round(skillScore + experienceScore + riskScore);

    if (totalScore >= minScore) {
      const reasons: string[] = [];
      if (matchingSkills.length > 0) {
        reasons.push(`Matching skills: ${matchingSkills.join(', ')}`);
      }
      if (experienceScore > 0) {
        reasons.push('Experience level meets requirements');
      }
      if (riskScore > 0) {
        reasons.push(`Comfortable with ${legRiskLevel || 'this type of sailing'}`);
      }

      matches.push({
        userId: profile.id,
        score: totalScore,
        reason: reasons.join('. '),
      });
    }
  }

  // Sort by score and limit results
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, maxResults);
}

/**
 * Find legs that match a crew member's profile
 * Call this when a user updates their profile or for periodic recommendations
 */
export async function findMatchingLegs(
  supabase: SupabaseClient,
  userId: string,
  options: {
    minScore?: number;
    maxResults?: number;
    excludeRegistered?: boolean;
  } = {}
): Promise<Array<{ legId: string; score: number; reason: string }>> {
  const { minScore = 50, maxResults = 10, excludeRegistered = true } = options;

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('sailing_experience, skills, risk_level')
    .eq('id', userId)
    .single();

  if (!profile) return [];

  // Check AI consent
  const { data: consent } = await supabase
    .from('user_consents')
    .select('ai_processing_consent')
    .eq('user_id', userId)
    .single();

  if (!consent?.ai_processing_consent) return [];

  // Get user's existing registrations
  let registeredLegIds = new Set<string>();
  if (excludeRegistered) {
    const { data: registrations } = await supabase
      .from('registrations')
      .select('leg_id')
      .eq('user_id', userId);
    registeredLegIds = new Set((registrations || []).map(r => r.leg_id));
  }

  // Get available legs from published journeys
  const { data: legs } = await supabase
    .from('legs')
    .select(`
      id,
      name,
      skills,
      risk_level,
      min_experience_level,
      crew_needed,
      journeys!inner (
        id,
        name,
        state
      )
    `)
    .eq('journeys.state', 'Published')
    .gt('crew_needed', 0);

  if (!legs) return [];

  const userSkills = profile.skills || [];
  const userRiskLevels = profile.risk_level || [];
  const userExperience = profile.sailing_experience || 1;

  const matches: Array<{ legId: string; score: number; reason: string }> = [];

  for (const leg of legs) {
    if (registeredLegIds.has(leg.id)) continue;

    const requiredSkills = leg.skills || [];
    const legRiskLevel = leg.risk_level;
    const minExperience = leg.min_experience_level || 1;

    // Calculate skill match
    const matchingSkills = requiredSkills.filter((s: string) => userSkills.includes(s));
    const skillScore = requiredSkills.length > 0
      ? (matchingSkills.length / requiredSkills.length) * 40
      : 40;

    // Calculate experience match
    const experienceScore = userExperience >= minExperience ? 40 : 0;

    // Calculate risk level match
    const riskScore = !legRiskLevel || userRiskLevels.includes(legRiskLevel) ? 20 : 0;

    const totalScore = Math.round(skillScore + experienceScore + riskScore);

    if (totalScore >= minScore) {
      const reasons: string[] = [];
      if (matchingSkills.length > 0) {
        reasons.push(`Your skills match: ${matchingSkills.join(', ')}`);
      }
      if (experienceScore > 0) {
        reasons.push('Your experience meets requirements');
      }
      if (riskScore > 0) {
        reasons.push('Matches your sailing comfort level');
      }

      matches.push({
        legId: leg.id,
        score: totalScore,
        reason: reasons.join('. '),
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, maxResults);
}

/**
 * Create suggestions for matching crew-leg pairs
 */
export async function createMatchingSuggestions(
  supabase: SupabaseClient,
  matches: Array<{ userId: string; legId?: string; journeyId?: string; score: number; reason: string }>,
  suggestionType: SuggestionType
): Promise<number> {
  if (matches.length === 0) return 0;

  // Get leg/journey details for titles
  const legIds = matches.filter(m => m.legId).map(m => m.legId);
  const { data: legs } = await supabase
    .from('legs')
    .select(`
      id,
      name,
      journeys!inner (
        name
      )
    `)
    .in('id', legIds);

  const legMap = new Map((legs || []).map(l => [l.id, l]));

  // Create suggestions
  const suggestions = matches.map(match => {
    const leg = match.legId ? legMap.get(match.legId) : null;
    const journeyName = leg ? (leg as any).journeys.name : 'New Journey';
    const legName = leg?.name || 'Sailing opportunity';

    return {
      user_id: match.userId,
      suggestion_type: suggestionType,
      title: `${match.score}% match: ${legName}`,
      description: `${journeyName} - ${match.reason}`,
      metadata: {
        legId: match.legId,
        journeyId: match.journeyId,
        matchScore: match.score,
      },
    };
  });

  const { data, error } = await supabase
    .from('ai_suggestions')
    .insert(suggestions)
    .select('id');

  if (error) {
    console.error('Failed to create suggestions:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Generate suggestions for a newly published leg
 */
export async function generateSuggestionsForNewLeg(
  supabase: SupabaseClient,
  legId: string
): Promise<number> {
  const matches = await findMatchingCrew(supabase, legId);

  if (matches.length === 0) return 0;

  // Get leg details
  const { data: leg } = await supabase
    .from('legs')
    .select('id, name, journey_id')
    .eq('id', legId)
    .single();

  const suggestions = matches.map(match => ({
    userId: match.userId,
    legId,
    journeyId: leg?.journey_id,
    score: match.score,
    reason: match.reason,
  }));

  return createMatchingSuggestions(supabase, suggestions, 'matching_leg');
}

/**
 * Generate suggestions for a user based on their profile
 */
export async function generateSuggestionsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const matches = await findMatchingLegs(supabase, userId);

  if (matches.length === 0) return 0;

  const suggestions = matches.map(match => ({
    userId,
    legId: match.legId,
    score: match.score,
    reason: match.reason,
  }));

  return createMatchingSuggestions(supabase, suggestions, 'matching_leg');
}
