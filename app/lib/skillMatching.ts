/**
 * Utility functions for calculating skill match percentages
 */

import { toCanonicalSkillName } from './skillUtils';

/**
 * Calculate match percentage between user skills and leg required skills
 * @param userSkills - Array of user's skill names
 * @param legSkills - Array of leg's required skill names
 * @param userExperienceLevel - User's experience level (1-4) or null
 * @param legMinExperienceLevel - Leg's minimum required experience level (1-4) or null
 * @returns Match percentage (0-100), or 100 if leg has no requirements
 *          Returns 0 if experience level doesn't match (user level < required level)
 */
export function calculateMatchPercentage(
  userSkills: string[],
  legSkills: string[],
  userExperienceLevel: number | null = null,
  legMinExperienceLevel: number | null = null
): number {
  // If experience level doesn't match, always return 0 (non-matching)
  if (legMinExperienceLevel !== null && userExperienceLevel !== null) {
    if (userExperienceLevel < legMinExperienceLevel) {
      return 0; // User's experience level is insufficient
    }
  }

  // If leg has no skill requirements, it's a perfect match
  if (legSkills.length === 0) {
    return 100;
  }

  // Normalize all skills to canonical format for comparison
  const normalizedUserSkills = userSkills.map(skill => toCanonicalSkillName(String(skill).trim())).filter(s => s.length > 0);
  const normalizedLegSkills = legSkills.map(skill => toCanonicalSkillName(String(skill).trim())).filter(s => s.length > 0);
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development' && normalizedUserSkills.length > 0 && normalizedLegSkills.length > 0) {
    console.log('[calculateMatchPercentage]', {
      userSkills: userSkills,
      legSkills: legSkills,
      normalizedUserSkills,
      normalizedLegSkills,
    });
  }
  
  // Count how many leg skills the user has
  const matchingSkills = normalizedLegSkills.filter(skill => normalizedUserSkills.includes(skill));
  const matchPercentage = Math.round((matchingSkills.length / normalizedLegSkills.length) * 100);
  
  // Debug logging
  if (process.env.NODE_ENV === 'development' && normalizedUserSkills.length > 0 && normalizedLegSkills.length > 0) {
    console.log('[calculateMatchPercentage] Result:', {
      matchingSkills,
      matchPercentage,
      userCount: normalizedUserSkills.length,
      legCount: normalizedLegSkills.length,
    });
  }
  
  return matchPercentage;
}

const matchBgColors = {
  '0match': 'bg-red-500/80',
  '25match': 'bg-orange-300/80',
  '50match': 'bg-yellow-300/80',
  '80match': 'bg-green-300/80',
};

const matchBgColorsHex = {
  '0match': '#ef4444',
  '25match': '#fdba74',
  '50match': '#fde047',
  '80match': '#22c55e',
};

const matchBorderColors = {
  '0match': 'border-red-600',
  '25match': 'border-orange-600',
  '50match': 'border-yellow-600',
  '80match': 'border-green-500',

};

const matchBorderColorsHex = {
  '0match': '#dc2626',
  '25match': '#ea580c',
  '50match': '#ca8a04',
  '80match': '#16a34a',
};

/**
 * Get color class for match percentage
 * @param percentage - Match percentage (0-100)
 * @returns Tailwind CSS color classes
 */
export function getMatchColorClass(percentage: number): string {
  if (percentage >= 80) return matchBgColors['80match'] + ' ' + matchBorderColors['80match'];
  if (percentage >= 50) return matchBgColors['50match'] + ' ' + matchBorderColors['50match'];
  if (percentage >= 25) return matchBgColors['25match'] + ' ' + matchBorderColors['25match'];
  return matchBgColors['0match'] + ' ' + matchBorderColors['0match'];
}

/**
 * Get color class for match percentage
 * @param percentage - Match percentage (0-100)
 * @returns Tailwind CSS color classes
 */
export function getMatchColorForMap(percentage: number): string {
  if (percentage >= 80) return matchBgColorsHex['80match'];
  if (percentage >= 50) return matchBgColorsHex['50match'];
  if (percentage >= 25) return matchBgColorsHex['25match'];
  return matchBgColorsHex['0match'];
}

/**
 * Get color class for match percentage
 * @param percentage - Match percentage (0-100)
 * @returns Tailwind CSS color classes
 */
export function getMatchBorderColorForMap(percentage: number): string {
  if (percentage >= 80) return matchBorderColorsHex['80match'];
  if (percentage >= 50) return matchBorderColorsHex['50match'];
  if (percentage >= 25) return matchBorderColorsHex['25match'];
  return matchBorderColorsHex['0match'];
}

/**
 * Get text color class for match percentage
 * @param percentage - Match percentage (0-100)
 * @returns Tailwind CSS text color classes
 */
export function getMatchTextColorClass(percentage: number): string {
  if (percentage >= 80) return 'text-green-800';
  if (percentage >= 50) return 'text-yellow-800';
  if (percentage >= 25) return 'text-orange-800';
  return 'text-red-800';
}

/**
 * Get background color class for match percentage (lighter variant)
 * @param percentage - Match percentage (0-100)
 * @returns Tailwind CSS background color classes
 */
export function getMatchBgColorClass(percentage: number): string {
  if (percentage >= 80) return 'bg-green-50 border-green-200';
  if (percentage >= 50) return 'bg-yellow-50 border-yellow-200';
  if (percentage >= 25) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

/**
 * Get marker color for map display
 * @param percentage - Match percentage (0-100)
 * @param experienceLevelMatches - Whether user's experience level meets the requirement
 * @returns Hex color code for map markers
 */
export function getMatchMarkerColor(percentage: number, experienceLevelMatches: boolean = true): string {
  // Always show red if experience level doesn't match
  if (!experienceLevelMatches) {
    return '#ef4444'; // red-500
  }
  
  if (percentage >= 80) return '#22c55e'; // green-500
  if (percentage >= 50) return '#eab308'; // yellow-500
  if (percentage >= 25) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

/**
 * Check if user's experience level meets the leg's requirement
 * @param userExperienceLevel - User's experience level (1-4) or null
 * @param legMinExperienceLevel - Leg's minimum required experience level (1-4) or null
 * @returns true if experience level matches or no requirement, false if insufficient
 */
export function checkExperienceLevelMatch(
  userExperienceLevel: number | null,
  legMinExperienceLevel: number | null
): boolean {
  // If no requirement, it's always a match
  if (legMinExperienceLevel === null) {
    return true;
  }
  
  // If user has no experience level, it's not a match
  if (userExperienceLevel === null) {
    return false;
  }
  
  // User's level must be >= required level
  return userExperienceLevel >= legMinExperienceLevel;
}

/**
 * Normalize skill name for comparison (trim whitespace, handle null/undefined, convert to canonical format)
 */
function normalizeSkillName(skill: any): string {
  if (skill === null || skill === undefined) return '';
  let skillName = '';
  if (typeof skill === 'object' && skill.skill_name) {
    skillName = String(skill.skill_name).trim();
  } else {
    skillName = String(skill).trim();
  }
  return toCanonicalSkillName(skillName);
}

/**
 * Get matching and missing skills
 * @param userSkills - Array of user's skill names
 * @param legSkills - Array of leg's required skill names
 * @returns Object with matching and missing skill arrays
 */
export function getMatchingAndMissingSkills(
  userSkills: string[],
  legSkills: string[]
): { matching: string[]; missing: string[] } {
  // Normalize all skill names for comparison
  const normalizedUserSkills = userSkills.map(normalizeSkillName).filter(s => s.length > 0);
  const normalizedLegSkills = legSkills.map(normalizeSkillName).filter(s => s.length > 0);
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development' && normalizedUserSkills.length > 0 && normalizedLegSkills.length > 0) {
    console.log('[getMatchingAndMissingSkills]', {
      userSkills,
      legSkills,
      normalizedUserSkills,
      normalizedLegSkills,
    });
  }
  
  const matching = normalizedLegSkills.filter(skill => normalizedUserSkills.includes(skill));
  const missing = normalizedLegSkills.filter(skill => !normalizedUserSkills.includes(skill));
  
  // Debug logging
  if (process.env.NODE_ENV === 'development' && normalizedUserSkills.length > 0 && normalizedLegSkills.length > 0) {
    console.log('[getMatchingAndMissingSkills] Result:', {
      matching,
      missing,
    });
  }
  
  return { matching, missing };
}
