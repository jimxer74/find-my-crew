/**
 * Utility functions for skill name normalization and formatting
 * Ensures consistent storage format across profiles, journeys, and legs
 */

import skillsConfig from '@/app/config/skills-config.json';

/**
 * Convert skill name to canonical format (lowercase with underscores)
 * This is the format used for storage in the database
 * Examples:
 *   "Navigation" -> "navigation"
 *   "Sailing Experience" -> "sailing_experience"
 *   "navigation" -> "navigation" (already canonical)
 *   "sailing_experience" -> "sailing_experience" (already canonical)
 */
export function toCanonicalSkillName(skillName: string): string {
  if (!skillName || typeof skillName !== 'string') return '';
  
  return skillName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_'); // Replace spaces with underscores
}

/**
 * Convert canonical skill name to display format (Title Case with spaces)
 * This is used for UI display
 * Examples:
 *   "navigation" -> "Navigation"
 *   "sailing_experience" -> "Sailing Experience"
 */
export function toDisplaySkillName(canonicalName: string): string {
  if (!canonicalName || typeof canonicalName !== 'string') return '';
  
  return canonicalName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize an array of skill names to canonical format
 * Handles both display format and canonical format inputs
 * Also handles JSON strings from profiles: '{"skill_name": "navigation", "description": "..."}'
 */
export function normalizeSkillNames(
  skillNames: (string | { skill_name: string; [key: string]: any })[]
): string[] {
  if (!Array.isArray(skillNames)) return [];
  
  return skillNames
    .map(skill => {
      if (typeof skill === 'string') {
        // Check if it's a JSON string (from profiles)
        if (skill.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(skill);
            if (parsed && typeof parsed === 'object' && 'skill_name' in parsed) {
              return toCanonicalSkillName(String(parsed.skill_name));
            }
          } catch {
            // Not valid JSON, strip braces and treat as plain skill name
            skill = skill.trim().replace(/^\{|\}$/g, '');
          }
        }
        // Plain string - normalize it (handles both display and canonical formats)
        return toCanonicalSkillName(skill);
      }
      // Handle objects with skill_name property (already parsed)
      if (typeof skill === 'object' && skill !== null && 'skill_name' in skill) {
        return toCanonicalSkillName(String(skill.skill_name));
      }
      return '';
    })
    .filter(skill => skill.length > 0);
}

/**
 * Get all available skill names from config in canonical format
 */
export function getAllCanonicalSkillNames(): string[] {
  const allSkills = [
    ...skillsConfig.general,
    ...skillsConfig.offshore,
    ...skillsConfig.extreme
  ];
  
  return allSkills.map(skill => skill.name); // Already in canonical format from config
}

/**
 * Get all available skill names from config in display format
 */
export function getAllDisplaySkillNames(): string[] {
  return getAllCanonicalSkillNames().map(toDisplaySkillName);
}

/**
 * Validate if a skill name exists in the config
 */
export function isValidSkillName(skillName: string): boolean {
  const canonicalName = toCanonicalSkillName(skillName);
  const validNames = getAllCanonicalSkillNames();
  return validNames.includes(canonicalName);
}
