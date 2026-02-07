import { getSupabaseAdmin, createAuthUser } from '../utils/supabase-admin.js';
import { getRandom } from '../utils/seeded-random.js';
import {
  FIRST_NAMES,
  LAST_NAMES,
  CERTIFICATIONS,
  SKILL_COMBINATIONS,
  SAILING_DESCRIPTIONS,
  SAILING_PREFERENCES,
} from '../data/sailing-names.js';

// Risk levels from database enum
const RISK_LEVELS = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'] as const;
type RiskLevel = typeof RISK_LEVELS[number];

// Test email domain
const TEST_EMAIL_DOMAIN = '@test.sailsmart.local';

export interface GeneratedProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  user_description: string | null;
  certifications: string | null;
  phone: string | null;
  risk_level: RiskLevel[];
  sailing_preferences: string | null;
  skills: string[];
  sailing_experience: number; // 1-4: Beginner, Competent Crew, Coastal Skipper, Offshore Skipper
  profile_image_url: string | null;
  roles: string[];
  profile_completion_percentage: number;
  language: 'en' | 'fi';
}

export interface ProfileGeneratorOptions {
  count: number;
  ownerRatio?: number; // Ratio of profiles that should have 'owner' role (0-1)
  onProgress?: (message: string) => void;
}

/**
 * Generate test profiles with auth.users entries
 */
export async function generateProfiles(
  options: ProfileGeneratorOptions
): Promise<GeneratedProfile[]> {
  const {
    count,
    ownerRatio = 0.3, // 30% owners by default
    onProgress = console.log,
  } = options;

  const random = getRandom();
  const admin = getSupabaseAdmin();
  const profiles: GeneratedProfile[] = [];

  const ownerCount = Math.floor(count * ownerRatio);

  onProgress(`Generating ${count} profiles (${ownerCount} owners, ${count - ownerCount} crew)...`);

  for (let i = 0; i < count; i++) {
    const isOwner = i < ownerCount;
    const firstName = random.pick(FIRST_NAMES);
    const lastName = random.pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;

    // Generate unique username
    const usernameBase = `${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(/[^a-z]/g, '');
    const username = `${usernameBase}${random.int(100, 999)}`;

    // Generate email
    const email = `${username}${TEST_EMAIL_DOMAIN}`;

    // Generate experience level and matching skills
    const experienceLevel = random.weighted([
      { value: 1, weight: 20 }, // Beginner
      { value: 2, weight: 35 }, // Competent Crew
      { value: 3, weight: 30 }, // Coastal Skipper
      { value: 4, weight: 15 }, // Offshore Skipper
    ]);

    // Select skill combination based on experience
    let skillSet: string[];
    switch (experienceLevel) {
      case 1:
        skillSet = [...SKILL_COMBINATIONS.beginner];
        break;
      case 2:
        skillSet = [...SKILL_COMBINATIONS.competentCrew];
        break;
      case 3:
        skillSet = [...SKILL_COMBINATIONS.daySkipper];
        // Maybe add some mechanic or sailmaker skills
        if (random.bool(0.3)) {
          skillSet.push(...random.pickMultiple(SKILL_COMBINATIONS.mechanic, 1));
        }
        break;
      case 4:
        skillSet = [...SKILL_COMBINATIONS.offshoreSkipper];
        if (random.bool(0.4)) {
          skillSet.push(...SKILL_COMBINATIONS.mechanic);
        }
        break;
      default:
        skillSet = [];
    }

    // Generate risk levels based on experience
    const riskLevels: RiskLevel[] = ['Coastal sailing'];
    if (experienceLevel >= 3) {
      riskLevels.push('Offshore sailing');
    }
    if (experienceLevel >= 4 && random.bool(0.3)) {
      riskLevels.push('Extreme sailing');
    }

    // Generate certifications based on experience
    const certificationCount = Math.min(experienceLevel, random.int(0, 3));
    const selectedCerts = certificationCount > 0
      ? random.pickMultiple(CERTIFICATIONS, certificationCount).join(', ')
      : null;

    // Generate phone (sometimes null)
    const phone = random.bool(0.7)
      ? `+${random.int(1, 99)} ${random.int(100, 999)} ${random.int(100, 999)} ${random.int(1000, 9999)}`
      : null;

    // Generate roles
    const roles: string[] = ['crew'];
    if (isOwner) {
      roles.push('owner');
    }

    // Profile completion (higher for owners and experienced users)
    const baseCompletion = isOwner ? 80 : 60;
    const profileCompletion = Math.min(100, baseCompletion + random.int(0, 20));

    try {
      // Create auth user
      const authUser = await createAuthUser(email, 'TestPassword123!', {
        full_name: fullName,
      });

      const profile: GeneratedProfile = {
        id: authUser.id,
        email,
        full_name: fullName,
        username,
        user_description: random.bool(0.8) ? random.pick(SAILING_DESCRIPTIONS) : null,
        certifications: selectedCerts,
        phone,
        risk_level: riskLevels,
        sailing_preferences: random.bool(0.7) ? random.pick(SAILING_PREFERENCES) : null,
        skills: skillSet,
        sailing_experience: experienceLevel,
        profile_image_url: null,
        roles,
        profile_completion_percentage: profileCompletion,
        language: random.bool(0.9) ? 'en' : 'fi',
      };

      // Insert profile into database
      const { error } = await admin.from('profiles').insert({
        id: profile.id,
        full_name: profile.full_name,
        username: profile.username,
        user_description: profile.user_description,
        certifications: profile.certifications,
        phone: profile.phone,
        risk_level: profile.risk_level,
        sailing_preferences: profile.sailing_preferences,
        skills: profile.skills,
        sailing_experience: profile.sailing_experience,
        profile_image_url: profile.profile_image_url,
        roles: profile.roles,
        profile_completion_percentage: profile.profile_completion_percentage,
        language: profile.language,
        email: profile.email,
      });

      if (error) {
        throw new Error(`Failed to insert profile: ${error.message}`);
      }

      profiles.push(profile);

      if ((i + 1) % 10 === 0 || i === count - 1) {
        onProgress(`  Created ${i + 1}/${count} profiles`);
      }
    } catch (err) {
      onProgress(`  Error creating profile ${i + 1}: ${err}`);
      throw err;
    }
  }

  return profiles;
}

/**
 * Get profiles that have the 'owner' role
 */
export function getOwnerProfiles(profiles: GeneratedProfile[]): GeneratedProfile[] {
  return profiles.filter(p => p.roles.includes('owner'));
}

/**
 * Get profiles that are crew only (no owner role)
 */
export function getCrewProfiles(profiles: GeneratedProfile[]): GeneratedProfile[] {
  return profiles.filter(p => !p.roles.includes('owner'));
}
