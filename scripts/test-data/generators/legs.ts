import { getSupabaseAdmin } from '../utils/supabase-admin.js';
import { getRandom } from '../utils/seeded-random.js';
import { LEG_DESCRIPTIONS, SAILING_SKILLS } from '../data/sailing-names.js';
import type { GeneratedJourney } from './journeys.js';

// Risk level enum from database
const RISK_LEVELS = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'] as const;
type RiskLevel = typeof RISK_LEVELS[number];

export interface GeneratedLeg {
  id: string;
  journey_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  crew_needed: number;
  skills: string[];
  risk_level: RiskLevel;
  min_experience_level: number | null;
  // Reference to waypoint indices in the route
  _waypointStartIndex: number;
  _waypointCount: number;
  _journeyRoute: GeneratedJourney['_route'];
}

export interface LegGeneratorOptions {
  journeys: GeneratedJourney[];
  legsPerJourney?: number | { min: number; max: number };
  onProgress?: (message: string) => void;
}

/**
 * Generate legs for journeys
 */
export async function generateLegs(
  options: LegGeneratorOptions
): Promise<GeneratedLeg[]> {
  const {
    journeys,
    legsPerJourney = { min: 2, max: 4 },
    onProgress = console.log,
  } = options;

  const random = getRandom();
  const admin = getSupabaseAdmin();
  const legs: GeneratedLeg[] = [];

  // Calculate total legs
  const legCounts = journeys.map(journey => {
    const maxLegs = Math.min(
      typeof legsPerJourney === 'number' ? legsPerJourney : legsPerJourney.max,
      journey._route.waypoints.length - 1 // Can't have more legs than waypoint pairs
    );
    const minLegs = typeof legsPerJourney === 'number' ? legsPerJourney : legsPerJourney.min;
    return random.int(Math.min(minLegs, maxLegs), maxLegs);
  });
  const totalLegs = legCounts.reduce((a, b) => a + b, 0);

  onProgress(`Generating ${totalLegs} legs for ${journeys.length} journeys...`);

  let legIndex = 0;
  for (let journeyIdx = 0; journeyIdx < journeys.length; journeyIdx++) {
    const journey = journeys[journeyIdx];
    const legCount = legCounts[journeyIdx];
    const route = journey._route;

    // Calculate date ranges for each leg
    const startDate = new Date(journey.start_date);
    const endDate = new Date(journey.end_date);
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const daysPerLeg = Math.floor(totalDays / legCount);

    // Distribute waypoints across legs
    const waypointsPerLeg = Math.floor(route.waypoints.length / legCount);

    for (let l = 0; l < legCount; l++) {
      // Calculate waypoint indices for this leg
      const waypointStartIndex = l * waypointsPerLeg;
      const isLastLeg = l === legCount - 1;
      const waypointCount = isLastLeg
        ? route.waypoints.length - waypointStartIndex
        : waypointsPerLeg + 1; // +1 for overlap with next leg

      // Get start and end waypoints for naming
      const startWaypoint = route.waypoints[waypointStartIndex];
      const endWaypointIndex = Math.min(waypointStartIndex + waypointCount - 1, route.waypoints.length - 1);
      const endWaypoint = route.waypoints[endWaypointIndex];

      const legName = `${startWaypoint.name} to ${endWaypoint.name}`;

      // Calculate dates for this leg
      const legStartDate = new Date(startDate.getTime() + l * daysPerLeg * 24 * 60 * 60 * 1000);
      const legEndDate = isLastLeg
        ? endDate
        : new Date(legStartDate.getTime() + daysPerLeg * 24 * 60 * 60 * 1000);

      // Crew needed (typically 2-4)
      const crewNeeded = random.int(1, 4);

      // Leg skills (subset of journey skills + possibly more specific)
      const legSkills = [...journey.skills];
      if (random.bool(0.3)) {
        legSkills.push(random.pick(SAILING_SKILLS.filter(s => !legSkills.includes(s))));
      }

      // Risk level (can be same or stricter than journey)
      const journeyMaxRisk = journey.risk_level[journey.risk_level.length - 1];
      let legRiskLevel: RiskLevel;
      if (journeyMaxRisk === 'Extreme sailing') {
        legRiskLevel = random.pick(['Offshore sailing', 'Extreme sailing'] as RiskLevel[]);
      } else if (journeyMaxRisk === 'Offshore sailing') {
        legRiskLevel = random.pick(['Coastal sailing', 'Offshore sailing'] as RiskLevel[]);
      } else {
        legRiskLevel = 'Coastal sailing';
      }

      // Experience level (can be same or stricter than journey)
      let legExperience = journey.min_experience_level;
      if (legExperience && random.bool(0.2)) {
        legExperience = Math.min(4, legExperience + 1);
      }

      const leg: GeneratedLeg = {
        id: random.uuid(),
        journey_id: journey.id,
        name: legName,
        description: random.bool(0.7) ? random.pick(LEG_DESCRIPTIONS) : null,
        start_date: legStartDate.toISOString(),
        end_date: legEndDate.toISOString(),
        crew_needed: crewNeeded,
        skills: legSkills,
        risk_level: legRiskLevel,
        min_experience_level: legExperience,
        _waypointStartIndex: waypointStartIndex,
        _waypointCount: waypointCount,
        _journeyRoute: route,
      };

      // Insert leg into database
      const { data, error } = await admin.from('legs').insert({
        journey_id: leg.journey_id,
        name: leg.name,
        description: leg.description,
        start_date: leg.start_date,
        end_date: leg.end_date,
        crew_needed: leg.crew_needed,
        skills: leg.skills,
        risk_level: leg.risk_level,
        min_experience_level: leg.min_experience_level,
      }).select('id').single();

      if (error) {
        throw new Error(`Failed to insert leg: ${error.message}`);
      }

      leg.id = data.id;
      legs.push(leg);
      legIndex++;

      if (legIndex % 10 === 0 || legIndex === totalLegs) {
        onProgress(`  Created ${legIndex}/${totalLegs} legs`);
      }
    }
  }

  return legs;
}

/**
 * Get legs for a specific journey
 */
export function getLegsByJourney(legs: GeneratedLeg[], journeyId: string): GeneratedLeg[] {
  return legs.filter(l => l.journey_id === journeyId);
}
