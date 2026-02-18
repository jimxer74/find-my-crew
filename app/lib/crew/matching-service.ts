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

  // Experience level matching (weight: 30%)
  if (params.experienceLevel) {
    maxScore += 30;
    if (crewProfile.experience_level >= params.experienceLevel) {
      // Perfect match if exactly at level, bonus for higher
      const levelDiff = crewProfile.experience_level - params.experienceLevel;
      score += 30 + (levelDiff * 5); // Bonus up to 15 points for higher levels
      score = Math.min(score, maxScore); // Cap at maxScore
    }
  }

  // Risk level matching (weight: 25%)
  if (params.riskLevels && params.riskLevels.length > 0) {
    maxScore += 25;
    const crewRiskLevels = Array.isArray(crewProfile.risk_level) 
      ? crewProfile.risk_level 
      : crewProfile.risk_level ? [crewProfile.risk_level] : [];
    
    // Check if any crew risk levels match params
    const hasMatch = crewRiskLevels.some((level: string) => 
      params.riskLevels!.includes(level)
    );
    
    if (hasMatch) {
      score += 25;
    }
  }

  // Skills matching (weight: 35%)
  if (params.skills && params.skills.length > 0) {
    maxScore += 35;
    const crewSkills = (crewProfile.skills || []).map((s: string) => 
      toCanonicalSkillName(s)
    );
    const requiredSkills = params.skills.map(s => toCanonicalSkillName(s));
    
    const matchingSkills = requiredSkills.filter(skill => 
      crewSkills.includes(skill)
    );
    
    const skillMatchRatio = matchingSkills.length / requiredSkills.length;
    score += skillMatchRatio * 35;
  }

  // Location proximity (weight: 10%)
  if (params.location && crewProfile.home_port_lat && crewProfile.home_port_lng) {
    maxScore += 10;
    const distance = calculateDistance(
      params.location.lat,
      params.location.lng,
      crewProfile.home_port_lat,
      crewProfile.home_port_lng
    );
    
    const radius = params.location.radius || 500; // default 500km
    if (distance <= radius) {
      // Score decreases linearly with distance
      const proximityScore = (1 - (distance / radius)) * 10;
      score += proximityScore;
    }
  }

  // If no criteria specified, return neutral score
  if (maxScore === 0) {
    return 50;
  }

  // Normalize to 0-100 range
  return Math.round((score / maxScore) * 100);
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
function formatAvailability(availability: string | null): string | undefined {
  if (!availability) return undefined;
  
  // Availability is stored as text, could be formatted dates or free text
  return availability;
}

/**
 * Normalize crew profile for API response
 */
function normalizeCrewProfile(
  profile: any,
  matchScore: number,
  includePrivateInfo: boolean
): CrewMatch {
  return {
    id: profile.id,
    name: includePrivateInfo ? (profile.first_name || 'Anonymous') : null,
    image_url: includePrivateInfo ? profile.image_url : null,
    experience_level: profile.experience_level || 1,
    risk_levels: Array.isArray(profile.risk_level) 
      ? profile.risk_level 
      : profile.risk_level ? [profile.risk_level] : [],
    skills: profile.skills || [],
    location: formatLocation(profile.home_port, profile.home_port_lat, profile.home_port_lng),
    matchScore,
    availability: formatAvailability(profile.availability),
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
      .select('id, first_name, image_url, experience_level, risk_level, skills, home_port, home_port_lat, home_port_lng, availability');

    // Filter by experience level (minimum requirement)
    if (params.experienceLevel) {
      query = query.gte('experience_level', params.experienceLevel);
    }

    // Filter by risk levels (crew must have at least one matching risk level)
    if (params.riskLevels && params.riskLevels.length > 0) {
      // Use overlaps operator for array fields
      query = query.overlaps('risk_level', params.riskLevels);
    }

    // Filter by location (approximate bounding box first, then precise distance)
    if (params.location) {
      const radius = params.location.radius || 500; // km
      // Calculate approximate bounding box (1 degree ≈ 111km)
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos(params.location.lat * Math.PI / 180));
      
      query = query
        .gte('home_port_lat', params.location.lat - latDelta)
        .lte('home_port_lat', params.location.lat + latDelta)
        .gte('home_port_lng', params.location.lng - lngDelta)
        .lte('home_port_lng', params.location.lng + lngDelta);
    }

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
      
      // Apply precise distance filter if location specified
      let includeProfile = true;
      if (params.location && profile.home_port_lat && profile.home_port_lng) {
        const distance = calculateDistance(
          params.location.lat,
          params.location.lng,
          profile.home_port_lat,
          profile.home_port_lng
        );
        const radius = params.location.radius || 500;
        includeProfile = distance <= radius;
      }
      
      return {
        profile,
        score,
        includeProfile,
      };
    });

    // Filter by distance and sort by score
    const filteredAndSorted = scoredProfiles
      .filter(item => item.includeProfile)
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
