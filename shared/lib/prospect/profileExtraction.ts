/**
 * Profile Extraction Utility
 * Extracts profile data from conversation history using deterministic parsing
 * Used as fallback when AI fails to complete profile creation
 */

import { ProspectMessage } from '@shared/ai/prospect/types';
import skillsConfig from '@/app/config/skills-config.json';

export interface ExtractedProfile {
  full_name?: string;
  user_description?: string;
  sailing_experience?: number; // 1-4
  risk_level?: string[]; // ["Coastal sailing", "Offshore sailing", "Extreme sailing"]
  skills?: Array<{ skill_name: string; description: string }>;
  sailing_preferences?: string;
  certifications?: string;
  phone?: string;
}

/**
 * Extract experience level from text
 * Returns 1-4 or null
 */
function extractExperienceLevel(text: string): number | null {
  const lowerText = text.toLowerCase();
  
  // Check for explicit numbers first
  const numMatch = text.match(/\b([1-4])\b/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }
  
  // Map text descriptions
  if (lowerText.includes('beginner') || lowerText.includes('new to sailing') || lowerText.includes('just starting')) {
    return 1;
  } else if (lowerText.includes('competent crew') || lowerText.includes('competent') || 
             lowerText.includes('can steer') || lowerText.includes('can reef') || 
             lowerText.includes('stand watch') || lowerText.includes('crew member')) {
    return 2;
  } else if (lowerText.includes('coastal skipper') || lowerText.includes('coastal') ||
             lowerText.includes('can skipper') || lowerText.includes('passage planning')) {
    return 3;
  } else if (lowerText.includes('offshore skipper') || lowerText.includes('offshore') ||
             lowerText.includes('ocean crossing') || lowerText.includes('transatlantic') ||
             lowerText.includes('long distance')) {
    return 4;
  }
  
  return null;
}

/**
 * Extract risk level from text
 */
function extractRiskLevel(text: string): string[] {
  const riskLevels: string[] = [];
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('coastal') || lowerText.includes('day sail') || lowerText.includes('short distance')) {
    riskLevels.push('Coastal sailing');
  }
  if (lowerText.includes('offshore') || lowerText.includes('open ocean') || lowerText.includes('ocean crossing') || 
      lowerText.includes('transatlantic') || lowerText.includes('multi-day')) {
    riskLevels.push('Offshore sailing');
  }
  if (lowerText.includes('extreme') || lowerText.includes('high latitude') || lowerText.includes('challenging conditions')) {
    riskLevels.push('Extreme sailing');
  }
  
  return riskLevels;
}

/**
 * Extract skills from text
 * Maps user descriptions to valid skill names from skills-config.json
 */
function extractSkills(text: string): Array<{ skill_name: string; description: string }> {
  const skills: Array<{ skill_name: string; description: string }> = [];
  const lowerText = text.toLowerCase();
  const validSkillNames = new Set(skillsConfig.general.map(s => s.name));
  
  // Skill mapping patterns
  const skillPatterns: Record<string, string[]> = {
    'technical_skills': ['carpentry', 'mechanics', 'electrical', 'engine', 'repair', 'maintenance', 'technical'],
    'cooking': ['cooking', 'chef', 'galley', 'meal', 'food'],
    'physical_fitness': ['fitness', 'yoga', 'exercise', 'athletic', 'strong', 'fit'],
    'navigation': ['navigation', 'gps', 'chartplotter', 'charts', 'plotting', 'celestial'],
    'sailing_experience': ['sailing', 'sail', 'steer', 'helm', 'reef', 'trim'],
    'watch_keeping': ['watch', 'lookout', 'stand watch', 'night watch'],
    'night_sailing': ['night', 'dark', 'night sailing', 'night watch'],
    'radio_communication': ['radio', 'vhf', 'communication', 'comms'],
    'first_aid': ['first aid', 'medical', 'cpr', 'emergency'],
    'knots': ['knot', 'rope', 'line', 'rigging'],
  };
  
  // Check each skill pattern
  for (const [skillName, patterns] of Object.entries(skillPatterns)) {
    if (!validSkillNames.has(skillName)) continue;
    
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        // Extract context around the skill mention
        const patternIndex = lowerText.indexOf(pattern);
        const start = Math.max(0, patternIndex - 50);
        const end = Math.min(text.length, patternIndex + pattern.length + 50);
        const context = text.substring(start, end).trim();
        
        // Check if we already added this skill
        if (!skills.find(s => s.skill_name === skillName)) {
          skills.push({
            skill_name: skillName,
            description: context,
          });
        }
        break;
      }
    }
  }
  
  return skills;
}

/**
 * Extract bio/description from conversation
 * Looks for personal statements, goals, background
 */
function extractBio(messages: ProspectMessage[]): string | null {
  const bioPatterns = [
    /(?:i am|i'm|about me|my background|i have|i love|i enjoy|i like|passionate about|interested in)[^.!?]{20,200}/gi,
    /(?:i want|i'd like|i'm looking|my goal|my dream|i hope)[^.!?]{20,200}/gi,
  ];
  
  const bioSentences: string[] = [];
  
  for (const message of messages) {
    if (message.role !== 'user') continue;
    
    for (const pattern of bioPatterns) {
      const matches = message.content.match(pattern);
      if (matches) {
        bioSentences.push(...matches.map(m => m.trim()));
      }
    }
  }
  
  if (bioSentences.length > 0) {
    // Combine and clean up
    return bioSentences.join(' ').substring(0, 500);
  }
  
  return null;
}

/**
 * Extract sailing preferences from conversation
 */
function extractSailingPreferences(messages: ProspectMessage[]): string | null {
  const preferencePatterns = [
    /(?:i want|i'd like|i'm interested|looking for|prefer|interested in).{10,200}/gi,
    /(?:mediterranean|caribbean|atlantic|pacific|baltic|adriatic|aegean|canary|azores|british isles)/gi,
  ];
  
  const preferences: string[] = [];
  
  for (const message of messages) {
    if (message.role !== 'user') continue;
    
    for (const pattern of preferencePatterns) {
      const matches = message.content.match(pattern);
      if (matches) {
        preferences.push(...matches.map(m => m.trim()));
      }
    }
  }
  
  if (preferences.length > 0) {
    return preferences.join(', ').substring(0, 300);
  }
  
  return null;
}

/**
 * Extract certifications from conversation
 */
function extractCertifications(text: string): string | null {
  const certPatterns = [
    /(?:RYA|ASA|US Sailing|Coastal Skipper|Offshore Skipper|Yachtmaster|Day Skipper|Competent Crew|STCW|certificate|certification|certified)/gi,
  ];
  
  const certs: string[] = [];
  
  for (const pattern of certPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      certs.push(...matches);
    }
  }
  
  if (certs.length > 0) {
    return [...new Set(certs)].join(', ');
  }
  
  return null;
}

/**
 * Extract phone number from conversation
 */
function extractPhone(text: string): string | null {
  const phonePatterns = [
    /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    /\d{10,15}/g,
  ];
  
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      return match[0].trim();
    }
  }
  
  return null;
}

/**
 * Main extraction function
 * Extracts all profile data from conversation history
 */
export function extractProfileFromConversation(messages: ProspectMessage[]): ExtractedProfile {
  const extracted: ExtractedProfile = {};
  
  // Combine all user messages for analysis
  const allUserText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');
  
  // Extract experience level
  const experience = extractExperienceLevel(allUserText);
  if (experience) {
    extracted.sailing_experience = experience;
  }
  
  // Extract risk level
  const riskLevels = extractRiskLevel(allUserText);
  if (riskLevels.length > 0) {
    extracted.risk_level = riskLevels;
  }
  
  // Extract skills
  const skills = extractSkills(allUserText);
  if (skills.length > 0) {
    extracted.skills = skills;
  }
  
  // Extract bio
  const bio = extractBio(messages);
  if (bio) {
    extracted.user_description = bio;
  }
  
  // Extract preferences
  const preferences = extractSailingPreferences(messages);
  if (preferences) {
    extracted.sailing_preferences = preferences;
  }
  
  // Extract certifications
  const certs = extractCertifications(allUserText);
  if (certs) {
    extracted.certifications = certs;
  }
  
  // Extract phone
  const phone = extractPhone(allUserText);
  if (phone) {
    extracted.phone = phone;
  }
  
  return extracted;
}
