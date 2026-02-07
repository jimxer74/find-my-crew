export * from './profiles.js';
export * from './boats.js';
export * from './journeys.js';
export * from './legs.js';
export * from './waypoints.js';
export * from './registrations.js';
export * from './notifications.js';
export * from './consents.js';

import { generateProfiles, getOwnerProfiles, type GeneratedProfile } from './profiles.js';
import { generateBoats, type GeneratedBoat } from './boats.js';
import { generateJourneys, type GeneratedJourney } from './journeys.js';
import { generateLegs, type GeneratedLeg } from './legs.js';
import { generateWaypoints, type GeneratedWaypoint } from './waypoints.js';
import { generateRegistrations, type GeneratedRegistration } from './registrations.js';
import { generateNotifications, type GeneratedNotification } from './notifications.js';
import { generateConsents, type GeneratedUserConsent } from './consents.js';

export interface GeneratedData {
  profiles: GeneratedProfile[];
  boats: GeneratedBoat[];
  journeys: GeneratedJourney[];
  legs: GeneratedLeg[];
  waypoints: GeneratedWaypoint[];
  registrations: GeneratedRegistration[];
  notifications: GeneratedNotification[];
  userConsents: GeneratedUserConsent[];
}

export interface GenerateAllOptions {
  profileCount: number;
  ownerRatio?: number;
  boatsPerOwner?: number | { min: number; max: number };
  journeysPerBoat?: number | { min: number; max: number };
  legsPerJourney?: number | { min: number; max: number };
  registrationsCount: number;
  notificationsPerUser?: number | { min: number; max: number };
  onProgress?: (message: string) => void;
}

/**
 * Generate all test data in the correct order
 */
export async function generateAllData(
  options: GenerateAllOptions
): Promise<GeneratedData> {
  const {
    profileCount,
    ownerRatio = 0.3,
    boatsPerOwner = { min: 1, max: 2 },
    journeysPerBoat = { min: 1, max: 3 },
    legsPerJourney = { min: 2, max: 4 },
    registrationsCount,
    notificationsPerUser = { min: 0, max: 5 },
    onProgress = console.log,
  } = options;

  onProgress('\n=== Starting Test Data Generation ===\n');

  // 1. Generate profiles (includes auth.users)
  onProgress('Step 1/8: Generating profiles...');
  const profiles = await generateProfiles({
    count: profileCount,
    ownerRatio,
    onProgress,
  });

  // 2. Generate boats for owners
  onProgress('\nStep 2/8: Generating boats...');
  const owners = getOwnerProfiles(profiles);
  const boats = await generateBoats({
    owners,
    boatsPerOwner,
    onProgress,
  });

  // 3. Generate journeys for boats
  onProgress('\nStep 3/8: Generating journeys...');
  const journeys = await generateJourneys({
    boats,
    journeysPerBoat,
    onProgress,
  });

  // 4. Generate legs for journeys
  onProgress('\nStep 4/8: Generating legs...');
  const legs = await generateLegs({
    journeys,
    legsPerJourney,
    onProgress,
  });

  // 5. Generate waypoints for legs
  onProgress('\nStep 5/8: Generating waypoints...');
  const waypoints = await generateWaypoints({
    legs,
    onProgress,
  });

  // 6. Generate registrations
  onProgress('\nStep 6/8: Generating registrations...');
  const registrations = await generateRegistrations({
    profiles,
    legs,
    journeys,
    boats,
    registrationsCount,
    onProgress,
  });

  // 7. Generate notifications
  onProgress('\nStep 7/8: Generating notifications...');
  const notifications = await generateNotifications({
    profiles,
    notificationsPerUser,
    onProgress,
  });

  // 8. Generate consents
  onProgress('\nStep 8/8: Generating consents...');
  const userConsents = await generateConsents({
    profiles,
    onProgress,
  });

  onProgress('\n=== Test Data Generation Complete ===\n');

  return {
    profiles,
    boats,
    journeys,
    legs,
    waypoints,
    registrations,
    notifications,
    userConsents,
  };
}
