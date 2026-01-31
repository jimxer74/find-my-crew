/**
 * Proactive Suggestions Matching Service
 *
 * Generates suggestions for users when new matching opportunities arise.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SuggestionType } from './types';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Matching Service] ${message}`, data !== undefined ? data : '');
  }
};

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
  log('--- findMatchingCrew started ---', { legId, options });
  const { minScore = 50, maxResults = 20 } = options;

  // Get leg requirements
  log('Fetching leg requirements...');
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
    log('Leg not found or journey not published');
    return [];
  }

  log('Leg requirements:', { skills: leg.skills, riskLevel: leg.risk_level, minExperience: leg.min_experience_level });
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

  if (!crewProfiles) {
    log('No crew profiles found');
    return [];
  }

  log('Found potential crew members:', { count: crewProfiles.length });

  // Check AI consent for each user
  const { data: consents } = await supabase
    .from('user_consents')
    .select('user_id, ai_processing_consent')
    .eq('ai_processing_consent', true);

  const usersWithConsent = new Set((consents || []).map(c => c.user_id));
  log('Users with AI consent:', { count: usersWithConsent.size });

  // Calculate match scores
  const matches: MatchResult[] = [];
  log('Calculating match scores...');

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
  const results = matches.slice(0, maxResults);
  log('--- findMatchingCrew completed ---', { matchesFound: results.length });
  return results;
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
  log('--- findMatchingLegs started ---', { userId, options });
  const { minScore = 50, maxResults = 10, excludeRegistered = true } = options;

  // Get user profile
  log('Fetching user profile...');
  const { data: profile } = await supabase
    .from('profiles')
    .select('sailing_experience, skills, risk_level')
    .eq('id', userId)
    .single();

  if (!profile) {
    log('User profile not found');
    return [];
  }

  log('User profile:', { experience: profile.sailing_experience, skills: profile.skills, riskLevels: profile.risk_level });

  // Check AI consent
  const { data: consent } = await supabase
    .from('user_consents')
    .select('ai_processing_consent')
    .eq('user_id', userId)
    .single();

  if (!consent?.ai_processing_consent) {
    log('User does not have AI consent');
    return [];
  }

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

  if (!legs) {
    log('No available legs found');
    return [];
  }

  log('Found available legs:', { count: legs.length });
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
  const results = matches.slice(0, maxResults);
  log('--- findMatchingLegs completed ---', { matchesFound: results.length });
  return results;
}

/**
 * Create suggestions for matching crew-leg pairs
 */
export async function createMatchingSuggestions(
  supabase: SupabaseClient,
  matches: Array<{ userId: string; legId?: string; journeyId?: string; score: number; reason: string }>,
  suggestionType: SuggestionType
): Promise<number> {
  log('--- createMatchingSuggestions started ---', { matchCount: matches.length, suggestionType });
  if (matches.length === 0) {
    log('No matches to create suggestions for');
    return 0;
  }

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
    log('Failed to create suggestions:', error);
    console.error('Failed to create suggestions:', error);
    return 0;
  }

  log('--- createMatchingSuggestions completed ---', { suggestionsCreated: data?.length || 0 });
  return data?.length || 0;
}

/**
 * Generate suggestions for a newly published leg
 */
export async function generateSuggestionsForNewLeg(
  supabase: SupabaseClient,
  legId: string
): Promise<number> {
  log('=== generateSuggestionsForNewLeg ===', { legId });
  const matches = await findMatchingCrew(supabase, legId);

  if (matches.length === 0) {
    log('No matching crew found for new leg');
    return 0;
  }

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
  log('=== generateSuggestionsForUser ===', { userId });
  const matches = await findMatchingLegs(supabase, userId);

  if (matches.length === 0) {
    log('No matching legs found for user');
    return 0;
  }

  const suggestions = matches.map(match => ({
    userId,
    legId: match.legId,
    score: match.score,
    reason: match.reason,
  }));

  return createMatchingSuggestions(supabase, suggestions, 'matching_leg');
}
