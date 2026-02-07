import { getSupabaseAdmin } from '../utils/supabase-admin.js';
import { getRandom } from '../utils/seeded-random.js';
import type { GeneratedProfile } from './profiles.js';
import type { GeneratedLeg } from './legs.js';
import type { GeneratedJourney } from './journeys.js';
import type { GeneratedBoat } from './boats.js';

// Registration status enum from database
const REGISTRATION_STATUSES = ['Pending approval', 'Approved', 'Not approved', 'Cancelled'] as const;
type RegistrationStatus = typeof REGISTRATION_STATUSES[number];

export interface GeneratedRegistration {
  id: string;
  leg_id: string;
  user_id: string;
  status: RegistrationStatus;
  notes: string | null;
  match_percentage: number;
}

export interface RegistrationGeneratorOptions {
  profiles: GeneratedProfile[];
  legs: GeneratedLeg[];
  journeys: GeneratedJourney[];
  boats: GeneratedBoat[];
  registrationsCount: number;
  onProgress?: (message: string) => void;
}

// Registration notes
const REGISTRATION_NOTES = [
  'Excited to join this leg! I have experience with similar routes.',
  'Looking to gain more offshore experience.',
  'Available for the entire duration, flexible on dates.',
  'First time sailing this region, eager to learn!',
  'Can help with cooking and general crew duties.',
  'Experienced in navigation, happy to share watch duties.',
  'I bring my own safety gear and have current first aid certification.',
  'Would love to practice my spinnaker handling skills.',
  'Comfortable with night watches and early starts.',
  'Can commit to the full passage, no time constraints.',
];

/**
 * Generate registrations (crew applying for legs)
 */
export async function generateRegistrations(
  options: RegistrationGeneratorOptions
): Promise<GeneratedRegistration[]> {
  const {
    profiles,
    legs,
    journeys,
    boats,
    registrationsCount,
    onProgress = console.log,
  } = options;

  const random = getRandom();
  const admin = getSupabaseAdmin();
  const registrations: GeneratedRegistration[] = [];

  // Get crew profiles (not owners)
  const crewProfiles = profiles.filter(p => !p.roles.includes('owner'));

  // Get published journey IDs and their legs
  const publishedJourneyIds = new Set(
    journeys.filter(j => j.state === 'Published').map(j => j.id)
  );
  const availableLegs = legs.filter(l => publishedJourneyIds.has(l.journey_id));

  if (availableLegs.length === 0) {
    onProgress('No published journeys with legs available for registrations');
    return [];
  }

  if (crewProfiles.length === 0) {
    onProgress('No crew profiles available for registrations');
    return [];
  }

  // Create a map of journey to boat owner
  const journeyToOwner = new Map<string, string>();
  for (const journey of journeys) {
    const boat = boats.find(b => b.id === journey.boat_id);
    if (boat) {
      journeyToOwner.set(journey.id, boat.owner_id);
    }
  }

  // Track existing registrations to avoid duplicates
  const existingRegistrations = new Set<string>();

  onProgress(`Generating ${registrationsCount} registrations...`);

  let created = 0;
  let attempts = 0;
  const maxAttempts = registrationsCount * 3;

  while (created < registrationsCount && attempts < maxAttempts) {
    attempts++;

    // Pick a random crew member and leg
    const crew = random.pick(crewProfiles);
    const leg = random.pick(availableLegs);

    // Get the journey and boat owner
    const journey = journeys.find(j => j.id === leg.journey_id);
    if (!journey) continue;

    const boatOwnerId = journeyToOwner.get(journey.id);
    if (!boatOwnerId) continue;

    // Can't register for your own boat's legs
    if (crew.id === boatOwnerId) continue;

    // Check for duplicate registration
    const regKey = `${leg.id}-${crew.id}`;
    if (existingRegistrations.has(regKey)) continue;

    // Calculate match percentage based on skills and experience
    const matchPercentage = calculateMatchPercentage(crew, leg, journey);

    // Determine status (weighted by match percentage)
    let status: RegistrationStatus;
    if (matchPercentage >= 80) {
      status = random.weighted([
        { value: 'Approved', weight: 60 },
        { value: 'Pending approval', weight: 30 },
        { value: 'Not approved', weight: 5 },
        { value: 'Cancelled', weight: 5 },
      ]);
    } else if (matchPercentage >= 50) {
      status = random.weighted([
        { value: 'Approved', weight: 30 },
        { value: 'Pending approval', weight: 50 },
        { value: 'Not approved', weight: 15 },
        { value: 'Cancelled', weight: 5 },
      ]);
    } else {
      status = random.weighted([
        { value: 'Approved', weight: 10 },
        { value: 'Pending approval', weight: 40 },
        { value: 'Not approved', weight: 40 },
        { value: 'Cancelled', weight: 10 },
      ]);
    }

    const registration: GeneratedRegistration = {
      id: random.uuid(),
      leg_id: leg.id,
      user_id: crew.id,
      status,
      notes: random.bool(0.6) ? random.pick(REGISTRATION_NOTES) : null,
      match_percentage: matchPercentage,
    };

    // Insert registration into database
    const { data, error } = await admin.from('registrations').insert({
      leg_id: registration.leg_id,
      user_id: registration.user_id,
      status: registration.status,
      notes: registration.notes,
      match_percentage: registration.match_percentage,
    }).select('id').single();

    if (error) {
      if (error.message.includes('duplicate')) {
        // Skip duplicates
        continue;
      }
      throw new Error(`Failed to insert registration: ${error.message}`);
    }

    registration.id = data.id;
    registrations.push(registration);
    existingRegistrations.add(regKey);
    created++;

    if (created % 10 === 0 || created === registrationsCount) {
      onProgress(`  Created ${created}/${registrationsCount} registrations`);
    }
  }

  if (created < registrationsCount) {
    onProgress(`  Could only create ${created} registrations (not enough unique crew/leg combinations)`);
  }

  return registrations;
}

/**
 * Calculate match percentage between crew and leg/journey requirements
 */
function calculateMatchPercentage(
  crew: GeneratedProfile,
  leg: GeneratedLeg,
  journey: GeneratedJourney
): number {
  let score = 0;
  let factors = 0;

  // Experience level match (40% weight)
  const requiredExp = leg.min_experience_level ?? journey.min_experience_level ?? 1;
  if (crew.sailing_experience >= requiredExp) {
    score += 40;
  } else if (crew.sailing_experience === requiredExp - 1) {
    score += 20;
  }
  factors += 40;

  // Skills match (40% weight)
  const requiredSkills = [...(leg.skills || []), ...(journey.skills || [])];
  const uniqueRequiredSkills = [...new Set(requiredSkills)];
  if (uniqueRequiredSkills.length > 0) {
    const matchedSkills = uniqueRequiredSkills.filter(s => crew.skills.includes(s));
    const skillScore = (matchedSkills.length / uniqueRequiredSkills.length) * 40;
    score += skillScore;
  } else {
    score += 40; // No skills required = full match
  }
  factors += 40;

  // Risk level match (20% weight)
  const legRisk = leg.risk_level;
  if (crew.risk_level.includes(legRisk)) {
    score += 20;
  } else if (
    (legRisk === 'Coastal sailing') ||
    (legRisk === 'Offshore sailing' && crew.risk_level.includes('Extreme sailing'))
  ) {
    score += 10;
  }
  factors += 20;

  return Math.round((score / factors) * 100);
}

/**
 * Get registrations for a specific leg
 */
export function getRegistrationsByLeg(registrations: GeneratedRegistration[], legId: string): GeneratedRegistration[] {
  return registrations.filter(r => r.leg_id === legId);
}

/**
 * Get registrations by a specific user
 */
export function getRegistrationsByUser(registrations: GeneratedRegistration[], userId: string): GeneratedRegistration[] {
  return registrations.filter(r => r.user_id === userId);
}
