import experienceLevelsConfig from '@/app/config/experience-levels-config.json';

export type ExperienceLevel = 1 | 2 | 3 | 4;

export type ExperienceLevelConfig = {
  value: ExperienceLevel;
  name: string;
  displayName: string;
  icon: string;
  description: string;
  infoText: string;
  typicalEquivalents: string;
  note: string;
};

/**
 * Get experience level configuration by numeric value
 */
export function getExperienceLevelConfig(level: ExperienceLevel): ExperienceLevelConfig {
  const config = experienceLevelsConfig.levels.find(l => l.value === level);
  if (!config) {
    throw new Error(`Invalid experience level: ${level}`);
  }
  return config as ExperienceLevelConfig;
}

/**
 * Get experience level by name (for migration/backward compatibility)
 */
export function getExperienceLevelByName(name: string): ExperienceLevel | null {
  const config = experienceLevelsConfig.levels.find(l => l.name === name);
  return config ? (config.value as ExperienceLevel) : null;
}

/**
 * Get display name for an experience level
 */
export function getExperienceLevelDisplayName(level: ExperienceLevel): string {
  return getExperienceLevelConfig(level).displayName;
}

/**
 * Get all experience level configs
 */
export function getAllExperienceLevels(): ExperienceLevelConfig[] {
  return experienceLevelsConfig.levels as ExperienceLevelConfig[];
}

/**
 * Convert text value to numeric experience level (for migration)
 */
export function convertTextToExperienceLevel(text: string | null): ExperienceLevel | null {
  if (!text) return null;
  
  const mapping: Record<string, ExperienceLevel> = {
    'Beginner': 1,
    'Competent Crew': 2,
    'Coastal Skipper': 3,
    'Offshore Skipper': 4,
  };
  
  return mapping[text] || null;
}

/**
 * Convert numeric experience level to text (for backward compatibility if needed)
 */
export function convertExperienceLevelToText(level: ExperienceLevel | null): string | null {
  if (level === null) return null;
  return getExperienceLevelConfig(level).name;
}
