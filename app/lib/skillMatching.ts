/**
 * Utility functions for calculating skill match percentages
 */

import { toCanonicalSkillName } from './skillUtils';


/** Normalize risk level to an array (DB may return string or string[]). */
function toRiskLevelArray(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export const matchRiskLevel = (userRiskLevel: string[], legRiskLevel: string | null, journeyRiskLevel: string | string[] | null): boolean => {

  if (!userRiskLevel || !Array.isArray(userRiskLevel)) return false;
  const journeyArr = toRiskLevelArray(journeyRiskLevel);
  if (!legRiskLevel && journeyArr.length === 0) return true;

  // Check if user risk level matches leg risk level
  if (legRiskLevel && userRiskLevel.includes(legRiskLevel)) return true;
  // Check if user risk level matches journey risk level
  if (journeyArr.length > 0 && journeyArr.some(riskLevel => userRiskLevel.includes(riskLevel))) return true;

  return false;
};

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
  userRiskLevel: string[] | null,
  legRiskLevel: string | null,
  journeyRiskLevel: string[] | null,
  userExperienceLevel: number | null = null,
  legMinExperienceLevel: number | null = null
): number {


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

  // Calculate matches to experience level and risk level
  const matchExperienceLevel = checkExperienceLevelMatch(userExperienceLevel, legMinExperienceLevel);
  const match = matchRiskLevel(userRiskLevel || [], legRiskLevel, journeyRiskLevel);
  let legFactors = normalizedLegSkills.length + 2;
  // Add if risk level or experience level matches
  let userFactors = matchingSkills.length += matchExperienceLevel ? 1 : 0;
  userFactors += match ? 1 : 0;

  const matchPercentage = Math.round((userFactors / legFactors) * 100);
  
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

// ────────────────────────────────────────────────
// Full literal Tailwind class strings — prevents purge in production
// ────────────────────────────────────────────────

const matchStyles = {
  '0match':  'bg-red-500/80 border-red-600',
  '25match': 'bg-orange-300/80 border-orange-600',
  '50match': 'bg-yellow-300/80 border-yellow-600',
  '80match': 'bg-green-300/80 border-green-500',
} as const;

const matchHexColors = {
  '0match':  '#ef4444',   // red-500
  '25match': '#fdba74',   // orange-300
  '50match': '#fde047',   // yellow-300
  '80match': '#22c55e',   // green-500
} as const;

const matchBorderHexColors = {
  '0match':  '#dc2626',   // red-600
  '25match': '#ea580c',   // orange-600
  '50match': '#ca8a04',   // yellow-600
  '80match': '#16a34a',   // green-500
} as const;

/**
 * Get full Tailwind class string for match percentage (bg + border + text)
 * @param percentage - Match percentage (0-100)
 * @returns Complete Tailwind class string
 */
export function getMatchColorClass(percentage: number): string {
  if (percentage >= 80) return matchStyles['80match'];
  if (percentage >= 50) return matchStyles['50match'];
  if (percentage >= 25) return matchStyles['25match'];
  return matchStyles['0match'];
}

/**
 * Get background hex color for map markers / custom rendering
 * @param percentage - Match percentage (0-100)
 * @returns Hex color string
 */
export function getMatchColorForMap(percentage: number): string {
  if (percentage >= 80) return matchHexColors['80match'];
  if (percentage >= 50) return matchHexColors['50match'];
  if (percentage >= 25) return matchHexColors['25match'];
  return matchHexColors['0match'];
}

/**
 * Get border hex color for map markers / custom rendering
 * @param percentage - Match percentage (0-100)
 * @returns Hex color string
 */
export function getMatchBorderColorForMap(percentage: number): string {
  if (percentage >= 80) return matchBorderHexColors['80match'];
  if (percentage >= 50) return matchBorderHexColors['50match'];
  if (percentage >= 25) return matchBorderHexColors['25match'];
  return matchBorderHexColors['0match'];
}

/**
 * Get text color class (darker variant for contrast)
 * @param percentage - Match percentage (0-100)
 * @returns Tailwind text color class
 */
export function getMatchTextColorClass(percentage: number): string {
  if (percentage >= 80) return 'text-green-800';
  if (percentage >= 50) return 'text-yellow-800';
  if (percentage >= 25) return 'text-orange-800';
  return 'text-red-800';
}

/**
 * Get light background + border for cards/tooltips
 * @param percentage - Match percentage (0-100)
 * @returns Tailwind classes for light background + border
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