/**
 * Real sailboat specifications for test data generation.
 * Based on popular production sailboats from various manufacturers.
 */

import type { SeededRandom } from '../utils/seeded-random.js';

// Sailboat category enum (matches database)
export type SailboatCategory =
  | 'Daysailers'
  | 'Coastal cruisers'
  | 'Traditional offshore cruisers'
  | 'Performance cruisers'
  | 'Multihulls'
  | 'Expedition sailboats';

export interface BoatSpec {
  makeModel: string;
  type: SailboatCategory;
  loa_m: number;        // Length overall in meters
  lwl_m: number;        // Length waterline in meters
  beam_m: number;       // Beam in meters
  draft_m: number;      // Draft in meters
  displacement_kg: number;
  ballast_kg: number;
  sailArea_sqm: number;
  capacity: number;     // Number of berths
  yearRange: [number, number]; // Production year range
}

export const BOAT_SPECS: BoatSpec[] = [
  // Coastal Cruisers (30-38 feet)
  {
    makeModel: 'Bavaria 34 Cruiser',
    type: 'Coastal cruisers',
    loa_m: 10.34,
    lwl_m: 9.45,
    beam_m: 3.46,
    draft_m: 1.75,
    displacement_kg: 5400,
    ballast_kg: 1650,
    sailArea_sqm: 52,
    capacity: 6,
    yearRange: [2012, 2022],
  },
  {
    makeModel: 'Jeanneau Sun Odyssey 349',
    type: 'Coastal cruisers',
    loa_m: 10.34,
    lwl_m: 9.33,
    beam_m: 3.44,
    draft_m: 1.98,
    displacement_kg: 5500,
    ballast_kg: 1600,
    sailArea_sqm: 55,
    capacity: 6,
    yearRange: [2015, 2023],
  },
  {
    makeModel: 'Beneteau Oceanis 35.1',
    type: 'Coastal cruisers',
    loa_m: 10.45,
    lwl_m: 9.60,
    beam_m: 3.72,
    draft_m: 1.90,
    displacement_kg: 6100,
    ballast_kg: 1600,
    sailArea_sqm: 56,
    capacity: 6,
    yearRange: [2016, 2024],
  },
  {
    makeModel: 'Hanse 348',
    type: 'Coastal cruisers',
    loa_m: 10.36,
    lwl_m: 9.69,
    beam_m: 3.55,
    draft_m: 1.95,
    displacement_kg: 5900,
    ballast_kg: 1500,
    sailArea_sqm: 54,
    capacity: 6,
    yearRange: [2017, 2024],
  },
  {
    makeModel: 'Dufour 360 Grand Large',
    type: 'Coastal cruisers',
    loa_m: 10.73,
    lwl_m: 9.80,
    beam_m: 3.65,
    draft_m: 1.90,
    displacement_kg: 6400,
    ballast_kg: 1900,
    sailArea_sqm: 58,
    capacity: 6,
    yearRange: [2018, 2024],
  },

  // Traditional Offshore Cruisers (40-50 feet)
  {
    makeModel: 'Hallberg-Rassy 44',
    type: 'Traditional offshore cruisers',
    loa_m: 13.45,
    lwl_m: 11.40,
    beam_m: 4.10,
    draft_m: 2.00,
    displacement_kg: 13000,
    ballast_kg: 4800,
    sailArea_sqm: 95,
    capacity: 8,
    yearRange: [2010, 2023],
  },
  {
    makeModel: 'Oyster 475',
    type: 'Traditional offshore cruisers',
    loa_m: 14.45,
    lwl_m: 12.20,
    beam_m: 4.35,
    draft_m: 2.10,
    displacement_kg: 15500,
    ballast_kg: 5500,
    sailArea_sqm: 110,
    capacity: 8,
    yearRange: [2012, 2024],
  },
  {
    makeModel: 'Bavaria 46 Cruiser',
    type: 'Traditional offshore cruisers',
    loa_m: 14.27,
    lwl_m: 12.79,
    beam_m: 4.35,
    draft_m: 2.10,
    displacement_kg: 11500,
    ballast_kg: 3300,
    sailArea_sqm: 98,
    capacity: 10,
    yearRange: [2015, 2023],
  },
  {
    makeModel: 'Jeanneau Sun Odyssey 440',
    type: 'Traditional offshore cruisers',
    loa_m: 13.39,
    lwl_m: 12.58,
    beam_m: 4.29,
    draft_m: 2.18,
    displacement_kg: 9432,
    ballast_kg: 2800,
    sailArea_sqm: 87,
    capacity: 8,
    yearRange: [2018, 2024],
  },
  {
    makeModel: 'Beneteau Oceanis 46.1',
    type: 'Traditional offshore cruisers',
    loa_m: 14.39,
    lwl_m: 13.45,
    beam_m: 4.50,
    draft_m: 2.15,
    displacement_kg: 10850,
    ballast_kg: 3300,
    sailArea_sqm: 100,
    capacity: 10,
    yearRange: [2018, 2024],
  },

  // Performance Cruisers
  {
    makeModel: 'J/122',
    type: 'Performance cruisers',
    loa_m: 12.19,
    lwl_m: 10.67,
    beam_m: 3.66,
    draft_m: 2.29,
    displacement_kg: 7712,
    ballast_kg: 2950,
    sailArea_sqm: 89,
    capacity: 6,
    yearRange: [2006, 2020],
  },
  {
    makeModel: 'Grand Soleil 44',
    type: 'Performance cruisers',
    loa_m: 13.70,
    lwl_m: 12.00,
    beam_m: 4.12,
    draft_m: 2.50,
    displacement_kg: 9800,
    ballast_kg: 3500,
    sailArea_sqm: 105,
    capacity: 8,
    yearRange: [2015, 2024],
  },
  {
    makeModel: 'X-Yachts X4³',
    type: 'Performance cruisers',
    loa_m: 13.29,
    lwl_m: 12.16,
    beam_m: 4.15,
    draft_m: 2.30,
    displacement_kg: 10500,
    ballast_kg: 3600,
    sailArea_sqm: 100,
    capacity: 8,
    yearRange: [2019, 2024],
  },
  {
    makeModel: 'Dehler 42',
    type: 'Performance cruisers',
    loa_m: 12.88,
    lwl_m: 11.74,
    beam_m: 3.99,
    draft_m: 2.20,
    displacement_kg: 9400,
    ballast_kg: 3100,
    sailArea_sqm: 93,
    capacity: 8,
    yearRange: [2020, 2024],
  },

  // Multihulls
  {
    makeModel: 'Lagoon 42',
    type: 'Multihulls',
    loa_m: 12.80,
    lwl_m: 12.33,
    beam_m: 7.70,
    draft_m: 1.30,
    displacement_kg: 12500,
    ballast_kg: 0,
    sailArea_sqm: 100,
    capacity: 10,
    yearRange: [2017, 2024],
  },
  {
    makeModel: 'Fountaine Pajot Elba 45',
    type: 'Multihulls',
    loa_m: 13.41,
    lwl_m: 13.00,
    beam_m: 7.42,
    draft_m: 1.25,
    displacement_kg: 12900,
    ballast_kg: 0,
    sailArea_sqm: 115,
    capacity: 10,
    yearRange: [2019, 2024],
  },
  {
    makeModel: 'Leopard 45',
    type: 'Multihulls',
    loa_m: 13.72,
    lwl_m: 13.20,
    beam_m: 7.35,
    draft_m: 1.42,
    displacement_kg: 14150,
    ballast_kg: 0,
    sailArea_sqm: 120,
    capacity: 10,
    yearRange: [2018, 2024],
  },
  {
    makeModel: 'Bali 4.3',
    type: 'Multihulls',
    loa_m: 13.10,
    lwl_m: 12.50,
    beam_m: 7.42,
    draft_m: 1.20,
    displacement_kg: 10980,
    ballast_kg: 0,
    sailArea_sqm: 95,
    capacity: 10,
    yearRange: [2016, 2023],
  },

  // Expedition Sailboats
  {
    makeModel: 'Garcia Exploration 45',
    type: 'Expedition sailboats',
    loa_m: 13.75,
    lwl_m: 12.50,
    beam_m: 4.50,
    draft_m: 1.60,
    displacement_kg: 14000,
    ballast_kg: 4500,
    sailArea_sqm: 95,
    capacity: 6,
    yearRange: [2015, 2024],
  },
  {
    makeModel: 'Allures 45',
    type: 'Expedition sailboats',
    loa_m: 13.72,
    lwl_m: 12.80,
    beam_m: 4.30,
    draft_m: 1.50,
    displacement_kg: 13500,
    ballast_kg: 4200,
    sailArea_sqm: 98,
    capacity: 6,
    yearRange: [2018, 2024],
  },
  {
    makeModel: 'Ovni 400',
    type: 'Expedition sailboats',
    loa_m: 12.20,
    lwl_m: 10.80,
    beam_m: 4.00,
    draft_m: 0.85,
    displacement_kg: 8500,
    ballast_kg: 2500,
    sailArea_sqm: 75,
    capacity: 6,
    yearRange: [2010, 2022],
  },

  // Daysailers
  {
    makeModel: 'J/70',
    type: 'Daysailers',
    loa_m: 6.93,
    lwl_m: 6.10,
    beam_m: 2.25,
    draft_m: 1.37,
    displacement_kg: 794,
    ballast_kg: 295,
    sailArea_sqm: 26,
    capacity: 4,
    yearRange: [2012, 2024],
  },
  {
    makeModel: 'Beneteau First 24',
    type: 'Daysailers',
    loa_m: 7.49,
    lwl_m: 6.90,
    beam_m: 2.60,
    draft_m: 1.65,
    displacement_kg: 1250,
    ballast_kg: 400,
    sailArea_sqm: 35,
    capacity: 4,
    yearRange: [2018, 2024],
  },
];

/**
 * Get boat specs by category
 */
export function getSpecsByCategory(category: SailboatCategory): BoatSpec[] {
  return BOAT_SPECS.filter(spec => spec.type === category);
}

/**
 * Calculate sailboat performance ratios
 */
export function calculatePerformanceRatios(spec: BoatSpec): {
  saDisplRatio: number;
  ballastDisplRatio: number;
  displLenRatio: number;
  comfortRatio: number;
  capsizeScreening: number;
  hullSpeedKnots: number;
} {
  // Displacement in long tons for calculations
  const displacementLongTons = spec.displacement_kg / 1016.05;

  // SA/Displ ratio = Sail Area (sq ft) / Displacement (lbs)^0.667
  const sailAreaSqFt = spec.sailArea_sqm * 10.764;
  const displacementLbs = spec.displacement_kg * 2.205;
  const saDisplRatio = sailAreaSqFt / Math.pow(displacementLbs, 0.667);

  // Ballast/Displacement ratio
  const ballastDisplRatio = (spec.ballast_kg / spec.displacement_kg) * 100;

  // Displacement/Length ratio = (Displacement in long tons / (0.01 x LWL in feet)^3)
  const lwlFeet = spec.lwl_m * 3.281;
  const displLenRatio = displacementLongTons / Math.pow(0.01 * lwlFeet, 3);

  // Comfort Ratio = Displacement (lbs) / (0.65 x (0.7 x LWL + 0.3 x LOA) x Beam^1.33)
  const loaFeet = spec.loa_m * 3.281;
  const beamFeet = spec.beam_m * 3.281;
  const comfortRatio = displacementLbs / (0.65 * (0.7 * lwlFeet + 0.3 * loaFeet) * Math.pow(beamFeet, 1.33));

  // Capsize Screening = Beam / (Displacement / 64.2)^0.333
  const capsizeScreening = beamFeet / Math.pow(displacementLbs / 64.2, 0.333);

  // Hull speed = 1.34 x sqrt(LWL in feet)
  const hullSpeedKnots = 1.34 * Math.sqrt(lwlFeet);

  return {
    saDisplRatio: Math.round(saDisplRatio * 100) / 100,
    ballastDisplRatio: Math.round(ballastDisplRatio * 10) / 10,
    displLenRatio: Math.round(displLenRatio),
    comfortRatio: Math.round(comfortRatio * 10) / 10,
    capsizeScreening: Math.round(capsizeScreening * 100) / 100,
    hullSpeedKnots: Math.round(hullSpeedKnots * 10) / 10,
  };
}

/**
 * Generate a random boat year within the spec's production range
 */
export function getRandomYear(spec: BoatSpec, random: SeededRandom): number {
  return random.int(spec.yearRange[0], spec.yearRange[1]);
}

// Country flags (ISO 3166-1 alpha-2 codes) for boats
export const COUNTRY_FLAGS = [
  'US', 'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK',
  'FI', 'PL', 'GR', 'HR', 'PT', 'CH', 'AT', 'BE', 'IE', 'AU',
  'NZ', 'CA', 'ZA', 'BR', 'AR', 'MX', 'TR', 'CY', 'MT', 'MC',
];

// Home ports by region
export const HOME_PORTS = {
  mediterranean: [
    'Barcelona, Spain', 'Palma de Mallorca, Spain', 'Valencia, Spain',
    'Nice, France', 'Marseille, France', 'Cannes, France', 'Monaco',
    'Genoa, Italy', 'Naples, Italy', 'Venice, Italy', 'Sardinia, Italy',
    'Split, Croatia', 'Dubrovnik, Croatia', 'Athens, Greece', 'Rhodes, Greece',
    'Bodrum, Turkey', 'Marmaris, Turkey', 'Gibraltar',
  ],
  northern_europe: [
    'Southampton, UK', 'Plymouth, UK', 'Cowes, UK', 'Portsmouth, UK',
    'Amsterdam, Netherlands', 'Rotterdam, Netherlands',
    'Hamburg, Germany', 'Kiel, Germany', 'Copenhagen, Denmark',
    'Stockholm, Sweden', 'Gothenburg, Sweden', 'Oslo, Norway',
    'Helsinki, Finland', 'Tallinn, Estonia',
  ],
  caribbean: [
    'St. Thomas, USVI', 'Tortola, BVI', 'St. Martin', 'Antigua',
    'St. Lucia', 'Grenada', 'Martinique', 'Guadeloupe', 'Barbados',
  ],
  atlantic: [
    'Las Palmas, Canary Islands', 'Horta, Azores', 'Lisbon, Portugal',
    'Cascais, Portugal', 'La Rochelle, France', 'Brest, France',
  ],
};
