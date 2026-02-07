import { getSupabaseAdmin } from '../utils/supabase-admin.js';
import { getRandom } from '../utils/seeded-random.js';
import { JOURNEY_DESCRIPTIONS } from '../data/sailing-names.js';
import { SAILING_ROUTES, type SailingRoute } from '../data/sailing-routes.js';
import type { GeneratedBoat } from './boats.js';

// Enums from database
const JOURNEY_STATES = ['In planning', 'Published', 'Archived'] as const;
const COST_MODELS = [
  'Shared contribution',
  'Owner covers all costs',
  'Crew pays a fee',
  'Delivery/paid crew',
  'Not defined',
] as const;
const RISK_LEVELS = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'] as const;

type JourneyState = typeof JOURNEY_STATES[number];
type CostModel = typeof COST_MODELS[number];
type RiskLevel = typeof RISK_LEVELS[number];

export interface GeneratedJourney {
  id: string;
  boat_id: string;
  name: string;
  start_date: string;
  end_date: string;
  description: string | null;
  risk_level: RiskLevel[];
  skills: string[];
  min_experience_level: number | null;
  cost_model: CostModel;
  state: JourneyState;
  is_ai_generated: boolean;
  ai_prompt: string | null;
  images: string[];
  // Additional data for leg generation
  _route: SailingRoute;
}

export interface JourneyGeneratorOptions {
  boats: GeneratedBoat[];
  journeysPerBoat?: number | { min: number; max: number };
  publishedRatio?: number; // Ratio of journeys that should be published (0-1)
  onProgress?: (message: string) => void;
}

/**
 * Generate journeys for boats
 */
export async function generateJourneys(
  options: JourneyGeneratorOptions
): Promise<GeneratedJourney[]> {
  const {
    boats,
    journeysPerBoat = { min: 1, max: 3 },
    publishedRatio = 0.7,
    onProgress = console.log,
  } = options;

  const random = getRandom();
  const admin = getSupabaseAdmin();
  const journeys: GeneratedJourney[] = [];

  // Calculate total journeys
  const journeyCounts = boats.map(() => {
    if (typeof journeysPerBoat === 'number') {
      return journeysPerBoat;
    }
    return random.int(journeysPerBoat.min, journeysPerBoat.max);
  });
  const totalJourneys = journeyCounts.reduce((a, b) => a + b, 0);

  onProgress(`Generating ${totalJourneys} journeys for ${boats.length} boats...`);

  let journeyIndex = 0;
  for (let boatIdx = 0; boatIdx < boats.length; boatIdx++) {
    const boat = boats[boatIdx];
    const journeyCount = journeyCounts[boatIdx];

    for (let j = 0; j < journeyCount; j++) {
      // Select a route that matches boat capabilities
      const suitableRoutes = getSuitableRoutes(boat);
      const route = random.pick(suitableRoutes);

      // Generate dates (starting in the future)
      const startDate = random.futureDate(30, 180);
      const durationDays = random.int(7, 28);
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Determine journey state
      let state: JourneyState;
      if (random.next() < publishedRatio) {
        state = 'Published';
      } else if (random.bool(0.3)) {
        state = 'Archived';
      } else {
        state = 'In planning';
      }

      // Map route difficulty to risk levels
      const riskLevels: RiskLevel[] = [];
      switch (route.difficulty) {
        case 'coastal':
          riskLevels.push('Coastal sailing');
          break;
        case 'offshore':
          riskLevels.push('Coastal sailing', 'Offshore sailing');
          break;
        case 'extreme':
          riskLevels.push('Offshore sailing', 'Extreme sailing');
          break;
      }

      // Experience level based on route difficulty
      let minExperience: number | null = null;
      switch (route.difficulty) {
        case 'coastal':
          minExperience = random.pick([1, 2]);
          break;
        case 'offshore':
          minExperience = random.pick([2, 3]);
          break;
        case 'extreme':
          minExperience = random.pick([3, 4]);
          break;
      }

      // Required skills based on route
      const skills: string[] = ['Watch keeping'];
      if (route.difficulty !== 'coastal') {
        skills.push('Navigation', 'Weather routing');
      }
      if (route.difficulty === 'extreme') {
        skills.push('Heavy weather sailing', 'Night sailing');
      }

      // Cost model (weighted selection)
      const costModel: CostModel = random.weighted([
        { value: 'Shared contribution', weight: 40 },
        { value: 'Owner covers all costs', weight: 20 },
        { value: 'Crew pays a fee', weight: 15 },
        { value: 'Delivery/paid crew', weight: 5 },
        { value: 'Not defined', weight: 20 },
      ]);

      const journey: GeneratedJourney = {
        id: random.uuid(),
        boat_id: boat.id,
        name: route.name,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        description: random.bool(0.8) ? random.pick(JOURNEY_DESCRIPTIONS) : route.description,
        risk_level: riskLevels,
        skills,
        min_experience_level: minExperience,
        cost_model: costModel,
        state,
        is_ai_generated: false,
        ai_prompt: null,
        images: [],
        _route: route,
      };

      // Insert journey into database
      const { data, error } = await admin.from('journeys').insert({
        boat_id: journey.boat_id,
        name: journey.name,
        start_date: journey.start_date,
        end_date: journey.end_date,
        description: journey.description,
        risk_level: journey.risk_level,
        skills: journey.skills,
        min_experience_level: journey.min_experience_level,
        cost_model: journey.cost_model,
        state: journey.state,
        is_ai_generated: journey.is_ai_generated,
        ai_prompt: journey.ai_prompt,
        images: journey.images,
      }).select('id').single();

      if (error) {
        throw new Error(`Failed to insert journey: ${error.message}`);
      }

      journey.id = data.id;
      journeys.push(journey);
      journeyIndex++;

      if (journeyIndex % 5 === 0 || journeyIndex === totalJourneys) {
        onProgress(`  Created ${journeyIndex}/${totalJourneys} journeys`);
      }
    }
  }

  return journeys;
}

/**
 * Get routes suitable for a boat based on its type
 */
function getSuitableRoutes(boat: GeneratedBoat): SailingRoute[] {
  const all = [...SAILING_ROUTES];

  // Filter based on boat type
  switch (boat.type) {
    case 'Daysailers':
      // Only coastal routes
      return all.filter(r => r.difficulty === 'coastal');
    case 'Coastal cruisers':
      // Coastal and some offshore
      return all.filter(r => r.difficulty !== 'extreme');
    case 'Expedition sailboats':
      // All routes including extreme
      return all;
    case 'Multihulls':
      // Prefer Caribbean and Mediterranean
      return all.filter(r => r.region === 'caribbean' || r.region === 'mediterranean' || r.region === 'pacific');
    default:
      // Traditional and performance cruisers can do most routes
      return all;
  }
}

/**
 * Get journeys for a specific boat
 */
export function getJourneysByBoat(journeys: GeneratedJourney[], boatId: string): GeneratedJourney[] {
  return journeys.filter(j => j.boat_id === boatId);
}

/**
 * Get published journeys
 */
export function getPublishedJourneys(journeys: GeneratedJourney[]): GeneratedJourney[] {
  return journeys.filter(j => j.state === 'Published');
}
