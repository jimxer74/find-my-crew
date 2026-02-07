import { getSupabaseAdmin } from '../utils/supabase-admin.js';
import { getRandom } from '../utils/seeded-random.js';
import { BOAT_NAMES } from '../data/sailing-names.js';
import {
  BOAT_SPECS,
  COUNTRY_FLAGS,
  HOME_PORTS,
  calculatePerformanceRatios,
  type BoatSpec,
} from '../data/boat-specs.js';
import type { GeneratedProfile } from './profiles.js';

export interface GeneratedBoat {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  make_model: string;
  capacity: number;
  home_port: string;
  country_flag: string;
  loa_m: number;
  lwl_m: number;
  beam_m: number;
  max_draft_m: number;
  displcmt_m: number;
  ballast_kg: number;
  sail_area_sqm: number;
  average_speed_knots: number;
  link_to_specs: string | null;
  images: string[];
  characteristics: string | null;
  capabilities: string | null;
  accommodations: string | null;
  sa_displ_ratio: number;
  ballast_displ_ratio: number;
  displ_len_ratio: number;
  comfort_ratio: number;
  capsize_screening: number;
  hull_speed_knots: number;
}

export interface BoatGeneratorOptions {
  owners: GeneratedProfile[];
  boatsPerOwner?: number | { min: number; max: number };
  onProgress?: (message: string) => void;
}

// Boat characteristics descriptions
const CHARACTERISTICS = [
  'Well-maintained with recent antifouling and rigging inspection.',
  'Classic lines with modern systems upgrades.',
  'Performance-oriented hull design with comfortable cruising interior.',
  'Easy to single-hand with all lines led to cockpit.',
  'Robust construction built for offshore passages.',
  'Light and fast, perfect for coastal racing and cruising.',
  'Traditional design with proven seaworthiness.',
  'Modern deck layout with large cockpit for entertaining.',
];

// Boat capabilities descriptions
const CAPABILITIES = [
  'Equipped for offshore passages with watermaker and solar panels.',
  'Radar, AIS, and full electronics suite for safe navigation.',
  'Full safety equipment including liferaft, EPIRB, and MOB gear.',
  'Self-tacking jib and in-mast furling for easy sail handling.',
  'Bow thruster for tight marina maneuvering.',
  'Coastal cruiser with basic navigation equipment.',
  'Racing-ready with full sail inventory including spinnaker.',
  'Long-range fuel tanks for extended motoring capability.',
];

// Accommodations descriptions
const ACCOMMODATIONS = [
  'Spacious saloon with convertible dining area, 3 cabins and 2 heads.',
  'Owner\'s cabin forward, guest cabin aft, crew quarters in forepeak.',
  'Open plan layout with galley-up design and excellent ventilation.',
  'Two double cabins with en-suite heads, plus crew cabin.',
  'Comfortable for 4 on extended cruises, 6 for weekends.',
  'Master cabin with island bed, guest cabin with twin bunks.',
  'Generous storage throughout, large lazarette for water toys.',
  'Bright interior with panoramic windows and quality furnishings.',
];

/**
 * Generate boats for owner profiles
 */
export async function generateBoats(
  options: BoatGeneratorOptions
): Promise<GeneratedBoat[]> {
  const {
    owners,
    boatsPerOwner = { min: 1, max: 2 },
    onProgress = console.log,
  } = options;

  const random = getRandom();
  const admin = getSupabaseAdmin();
  const boats: GeneratedBoat[] = [];
  const usedNames = new Set<string>();

  // Calculate total boats
  const boatCounts = owners.map(() => {
    if (typeof boatsPerOwner === 'number') {
      return boatsPerOwner;
    }
    return random.int(boatsPerOwner.min, boatsPerOwner.max);
  });
  const totalBoats = boatCounts.reduce((a, b) => a + b, 0);

  onProgress(`Generating ${totalBoats} boats for ${owners.length} owners...`);

  let boatIndex = 0;
  for (let ownerIdx = 0; ownerIdx < owners.length; ownerIdx++) {
    const owner = owners[ownerIdx];
    const boatCount = boatCounts[ownerIdx];

    for (let b = 0; b < boatCount; b++) {
      // Select a unique boat name
      let boatName: string;
      do {
        boatName = random.pick(BOAT_NAMES);
        if (random.bool(0.2)) {
          boatName = `${boatName} II`;
        }
      } while (usedNames.has(boatName));
      usedNames.add(boatName);

      // Select boat specs
      const spec: BoatSpec = random.pick(BOAT_SPECS);
      const ratios = calculatePerformanceRatios(spec);

      // Select home port based on boat type
      let homePortRegion: keyof typeof HOME_PORTS;
      if (spec.type === 'Multihulls') {
        homePortRegion = random.pick(['caribbean', 'mediterranean'] as const);
      } else if (spec.type === 'Expedition sailboats') {
        homePortRegion = random.pick(['atlantic', 'northern_europe'] as const);
      } else {
        homePortRegion = random.pick(['mediterranean', 'northern_europe', 'caribbean', 'atlantic'] as const);
      }
      const homePort = random.pick(HOME_PORTS[homePortRegion]);

      // Calculate average speed (hull speed * efficiency factor)
      const speedEfficiency = random.float(0.75, 0.95);
      const averageSpeed = Math.round(ratios.hullSpeedKnots * speedEfficiency * 10) / 10;

      const boat: GeneratedBoat = {
        id: random.uuid(),
        owner_id: owner.id,
        name: boatName,
        type: spec.type,
        make_model: spec.makeModel,
        capacity: spec.capacity,
        home_port: homePort,
        country_flag: random.pick(COUNTRY_FLAGS),
        loa_m: spec.loa_m,
        lwl_m: spec.lwl_m,
        beam_m: spec.beam_m,
        max_draft_m: spec.draft_m,
        displcmt_m: spec.displacement_kg,
        ballast_kg: spec.ballast_kg,
        sail_area_sqm: spec.sailArea_sqm,
        average_speed_knots: averageSpeed,
        link_to_specs: random.bool(0.3) ? `https://sailboatdata.com/sailboat/${spec.makeModel.toLowerCase().replace(/\s+/g, '-')}` : null,
        images: [],
        characteristics: random.bool(0.7) ? random.pick(CHARACTERISTICS) : null,
        capabilities: random.bool(0.7) ? random.pick(CAPABILITIES) : null,
        accommodations: random.bool(0.7) ? random.pick(ACCOMMODATIONS) : null,
        sa_displ_ratio: ratios.saDisplRatio,
        ballast_displ_ratio: ratios.ballastDisplRatio,
        displ_len_ratio: ratios.displLenRatio,
        comfort_ratio: ratios.comfortRatio,
        capsize_screening: ratios.capsizeScreening,
        hull_speed_knots: ratios.hullSpeedKnots,
      };

      // Insert boat into database
      const { data, error } = await admin.from('boats').insert({
        owner_id: boat.owner_id,
        name: boat.name,
        type: boat.type,
        make_model: boat.make_model,
        capacity: boat.capacity,
        home_port: boat.home_port,
        country_flag: boat.country_flag,
        loa_m: boat.loa_m,
        lwl_m: boat.lwl_m,
        beam_m: boat.beam_m,
        max_draft_m: boat.max_draft_m,
        displcmt_m: boat.displcmt_m,
        ballast_kg: boat.ballast_kg,
        sail_area_sqm: boat.sail_area_sqm,
        average_speed_knots: boat.average_speed_knots,
        link_to_specs: boat.link_to_specs,
        images: boat.images,
        characteristics: boat.characteristics,
        capabilities: boat.capabilities,
        accommodations: boat.accommodations,
        sa_displ_ratio: boat.sa_displ_ratio,
        ballast_displ_ratio: boat.ballast_displ_ratio,
        displ_len_ratio: boat.displ_len_ratio,
        comfort_ratio: boat.comfort_ratio,
        capsize_screening: boat.capsize_screening,
        hull_speed_knots: boat.hull_speed_knots,
      }).select('id').single();

      if (error) {
        throw new Error(`Failed to insert boat: ${error.message}`);
      }

      boat.id = data.id;
      boats.push(boat);
      boatIndex++;

      if (boatIndex % 5 === 0 || boatIndex === totalBoats) {
        onProgress(`  Created ${boatIndex}/${totalBoats} boats`);
      }
    }
  }

  return boats;
}

/**
 * Get boats owned by a specific profile
 */
export function getBoatsByOwner(boats: GeneratedBoat[], ownerId: string): GeneratedBoat[] {
  return boats.filter(b => b.owner_id === ownerId);
}
