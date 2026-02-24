/**
 * Crew Matching Service
 *
 * Provides intelligent crew search and matching functionality for the AI assistant.
 * Matches crew members based on experience level, risk tolerance, location, skills, and availability.
 */

import { logger } from '@/app/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { toCanonicalSkillName } from '@/app/lib/skillUtils';
import { checkExperienceLevelMatch } from '@/app/lib/skillMatching';

export interface CrewSearchParams {
  experienceLevel?: number; // 1-4: Minimum experience level
  riskLevels?: string[]; // ["Coastal sailing", "Offshore sailing", "Extreme sailing"]
  location?: {
    lat: number;
    lng: number;
    radius?: number; // km, default 500
  };
  dateRange?: {
    start: string; // ISO date
    end: string;   // ISO date
  };
  skills?: string[]; // Array of skill names
  limit?: number; // default 10, max 50
  includePrivateInfo?: boolean; // Whether to include names/images (authenticated users only)
}

export interface CrewMatch {
  id: string;
  name: string | null; // Null for unauthenticated searches
  image_url: string | null; // Null for unauthenticated searches
  experience_level: number; // 1-4
  risk_levels: string[]; // ["Coastal sailing", etc.]
  skills: string[]; // Array of skill names
  location: string; // Formatted location string
  matchScore: number; // 0-100
  availability?: string; // Formatted availability text
}

export interface CrewSearchResult {
  matches: CrewMatch[];
  totalCount: number;
}

/**
 * Calculate match score between skipper requirements and crew profile
 */
function calculateCrewMatchScore(
  crewProfile: any,
  params: CrewSearchParams
): number {
  let score = 0;
  let maxScore = 0;
  const debugInfo = {
    experienceLevel: params.experienceLevel,
    riskLevels: params.riskLevels,
    skills: params.skills,
    crewExperience: crewProfile.experience_level,
    crewRiskLevels: crewProfile.risk_level,
    scoreBreakdown: {} as any,
  };

  // Experience level matching (weight: 34%)
  if (params.experienceLevel) {
    maxScore += 34;
    if (crewProfile.experience_level >= params.experienceLevel) {
      // Perfect match if exactly at level, bonus for higher
      const levelDiff = crewProfile.experience_level - params.experienceLevel;
      score += 34 + (levelDiff * 5); // Bonus up to 15 points for higher levels
      score = Math.min(score, maxScore); // Cap at maxScore
      debugInfo.scoreBreakdown.experience = `+34 (match)`;
    } else {
      debugInfo.scoreBreakdown.experience = `0 (no match)`;
    }
  }

  // Risk level matching (weight: 33%)
  if (params.riskLevels && params.riskLevels.length > 0) {
    maxScore += 33;
    const crewRiskLevels = Array.isArray(crewProfile.risk_level)
      ? crewProfile.risk_level
      : crewProfile.risk_level ? [crewProfile.risk_level] : [];

    // Check if any crew risk levels match params
    const hasMatch = crewRiskLevels.some((level: string) =>
      params.riskLevels!.includes(level)
    );

    if (hasMatch) {
      score += 33;
      debugInfo.scoreBreakdown.risk = `+33 (match)`;
    } else {
      debugInfo.scoreBreakdown.risk = `0 (no match)`;
    }
  }

  // Skills matching (weight: 33%)
  if (params.skills && params.skills.length > 0) {
    maxScore += 33;
    const crewSkills = (crewProfile.skills || []).map((s: string) =>
      toCanonicalSkillName(s)
    );
    const requiredSkills = params.skills.map(s => toCanonicalSkillName(s));

    const matchingSkills = requiredSkills.filter(skill =>
      crewSkills.includes(skill)
    );

    const skillMatchRatio = matchingSkills.length / requiredSkills.length;
    score += skillMatchRatio * 33;
    debugInfo.scoreBreakdown.skills = `+${Math.round(skillMatchRatio * 33)} (${matchingSkills.length}/${requiredSkills.length} match)`;
  } else {
    debugInfo.scoreBreakdown.skills = 'skipped (no skills required)';
  }

  // If no criteria specified, return neutral score
  if (maxScore === 0) {
    logger.debug('[calculateCrewMatchScore] DEBUG (neutral):', debugInfo);
    return 50;
  }

  const finalScore = Math.round((score / maxScore) * 100);
  debugInfo.scoreBreakdown.final = `${score}/${maxScore} = ${finalScore}%`;
  logger.debug('[calculateCrewMatchScore] DEBUG:', debugInfo);

  // Normalize to 0-100 range
  return finalScore;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format location string for display (hide exact coordinates for privacy)
 */
function formatLocation(homePort: string | null, lat: number | null, lng: number | null): string {
  if (homePort) {
    // Extract city/region only (remove country if comma-separated)
    const parts = homePort.split(',').map(p => p.trim());
    return parts[0]; // Return first part (usually city)
  }
  
  if (lat !== null && lng !== null) {
    // Rough geographic region based on coordinates
    return 'Available'; // Generic fallback
  }
  
  return 'Location not specified';
}

/**
 * Format availability for display
 */
function formatAvailability(startDate: string | null, endDate: string | null): string | undefined {
  if (!startDate && !endDate) return undefined;

  if (startDate && endDate) {
    return `${startDate} to ${endDate}`;
  } else if (startDate) {
    return `From ${startDate}`;
  } else if (endDate) {
    return `Until ${endDate}`;
  }

  return undefined;
}

/**
 * Parse skills array - handles both string names and JSON objects
 */
function parseSkills(skillsData: any): string[] {
  if (!Array.isArray(skillsData)) {
    return [];
  }

  return skillsData
    .map((skill) => {
      // If already a string, return as-is
      if (typeof skill === 'string') {
        // Try to parse as JSON in case it's a stringified object
        try {
          const parsed = JSON.parse(skill);
          if (typeof parsed === 'object' && parsed !== null) {
            return parsed['skill Name'] || parsed.skillName || parsed.name || '';
          }
        } catch {
          // Not JSON, return the string as-is
          return skill;
        }
        return skill;
      }

      // If object, extract skill name
      if (typeof skill === 'object' && skill !== null) {
        return skill['skill Name'] || skill.skillName || skill.name || '';
      }

      return '';
    })
    .filter((skill) => skill.length > 0); // Remove empty strings
}

/**
 * Normalize crew profile for API response
 */
function normalizeCrewProfile(
  profile: any,
  matchScore: number,
  includePrivateInfo: boolean
): CrewMatch {
  // Extract location from preferred_departure_location JSONB if available
  const depLocation = profile.preferred_departure_location as any;
  const homePort = depLocation?.name || null;
  const depLat = depLocation?.lat || null;
  const depLng = depLocation?.lng || null;

  return {
    id: profile.id,
    name: includePrivateInfo ? (profile.full_name || 'Anonymous') : null,
    image_url: includePrivateInfo ? profile.profile_image_url : null,
    experience_level: profile.sailing_experience || 1,
    risk_levels: Array.isArray(profile.risk_level)
      ? profile.risk_level
      : profile.risk_level ? [profile.risk_level] : [],
    skills: parseSkills(profile.skills),
    location: formatLocation(homePort, depLat, depLng),
    matchScore,
    availability: formatAvailability(profile.availability_start_date, profile.availability_end_date),
  };
}

/**
 * Search for matching crew members
 * Main entry point for crew search functionality
 */
export async function searchMatchingCrew(
  supabase: SupabaseClient,
  params: CrewSearchParams
): Promise<CrewSearchResult> {
  try {
    // Build query
    let query = supabase
      .from('profiles')
      .select('id, full_name, profile_image_url, sailing_experience, risk_level, skills, preferred_departure_location, availability_start_date, availability_end_date');

    // Filter by experience level (minimum requirement)
    if (params.experienceLevel) {
      query = query.gte('sailing_experience', params.experienceLevel);
    }

    // Filter by risk levels (crew must have at least one matching risk level)
    if (params.riskLevels && params.riskLevels.length > 0) {
      // Use overlaps operator for array fields
      query = query.overlaps('risk_level', params.riskLevels);
    }

    // Note: Location filtering is not applied at query level since profiles store locations as JSONB.
    // Distance filtering will be done in post-processing after retrieving profiles.

    // Execute query
    const { data: profiles, error } = await query;

    if (error) {
      logger.error('[searchMatchingCrew] Database error:', { error: error?.message || String(error) });
      throw error;
    }

    if (!profiles || profiles.length === 0) {
      return { matches: [], totalCount: 0 };
    }

    // Calculate match scores for each profile
    const scoredProfiles = profiles.map(profile => {
      const score = calculateCrewMatchScore(profile, params);

      return {
        profile,
        score,
      };
    });

    // Sort by score (no location filtering)
    const filteredAndSorted = scoredProfiles
      .sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = Math.min(params.limit || 10, 50);
    const limitedResults = filteredAndSorted.slice(0, limit);

    // Normalize profiles for API response
    const matches = limitedResults.map(item =>
      normalizeCrewProfile(item.profile, item.score, params.includePrivateInfo || false)
    );

    return {
      matches,
      totalCount: filteredAndSorted.length,
    };
  } catch (error) {
    logger.error('[searchMatchingCrew] Error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    throw error;
  }
}
