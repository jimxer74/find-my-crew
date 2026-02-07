/**
 * Real sailing routes with waypoint coordinates.
 * Each route contains named waypoints with lat/lng in WGS84.
 */

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
}

export interface SailingRoute {
  id: string;
  name: string;
  description: string;
  region: 'mediterranean' | 'caribbean' | 'baltic' | 'atlantic' | 'pacific';
  difficulty: 'coastal' | 'offshore' | 'extreme';
  waypoints: Waypoint[];
}

export const SAILING_ROUTES: SailingRoute[] = [
  // Mediterranean Routes
  {
    id: 'med-french-riviera',
    name: 'French Riviera Cruise',
    description: 'Classic Mediterranean sailing along the Cote d\'Azur',
    region: 'mediterranean',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Nice', lat: 43.7102, lng: 7.2620 },
      { name: 'Villefranche-sur-Mer', lat: 43.7045, lng: 7.3114 },
      { name: 'Monaco', lat: 43.7384, lng: 7.4246 },
      { name: 'Menton', lat: 43.7747, lng: 7.5008 },
      { name: 'San Remo', lat: 43.8159, lng: 7.7769 },
      { name: 'Portofino', lat: 44.3034, lng: 9.2097 },
    ],
  },
  {
    id: 'med-greek-islands',
    name: 'Greek Islands Odyssey',
    description: 'Island hopping through the Cyclades',
    region: 'mediterranean',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Athens (Piraeus)', lat: 37.9475, lng: 23.6445 },
      { name: 'Kea', lat: 37.6278, lng: 24.3342 },
      { name: 'Syros', lat: 37.4500, lng: 24.9167 },
      { name: 'Mykonos', lat: 37.4467, lng: 25.3289 },
      { name: 'Paros', lat: 37.0853, lng: 25.1522 },
      { name: 'Naxos', lat: 37.1036, lng: 25.3756 },
      { name: 'Santorini', lat: 36.3932, lng: 25.4615 },
    ],
  },
  {
    id: 'med-croatia-split',
    name: 'Croatian Coast Adventure',
    description: 'Exploring the Dalmatian coast from Split',
    region: 'mediterranean',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Split', lat: 43.5081, lng: 16.4402 },
      { name: 'Brac (Bol)', lat: 43.2617, lng: 16.6556 },
      { name: 'Hvar', lat: 43.1722, lng: 16.4411 },
      { name: 'Vis', lat: 43.0622, lng: 16.1828 },
      { name: 'Korcula', lat: 42.9597, lng: 17.1361 },
      { name: 'Dubrovnik', lat: 42.6507, lng: 18.0944 },
    ],
  },
  {
    id: 'med-balearics',
    name: 'Balearic Islands Circuit',
    description: 'Sailing the Spanish islands of Mallorca, Menorca, and Ibiza',
    region: 'mediterranean',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Palma de Mallorca', lat: 39.5696, lng: 2.6502 },
      { name: 'Soller', lat: 39.7950, lng: 2.6961 },
      { name: 'Ciudadela (Menorca)', lat: 40.0017, lng: 3.8381 },
      { name: 'Mahon', lat: 39.8883, lng: 4.2656 },
      { name: 'Ibiza Town', lat: 38.9067, lng: 1.4206 },
      { name: 'Formentera', lat: 38.7083, lng: 1.4361 },
    ],
  },
  {
    id: 'med-turkey-coast',
    name: 'Turkish Turquoise Coast',
    description: 'The stunning Lycian coast from Bodrum to Antalya',
    region: 'mediterranean',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Bodrum', lat: 37.0344, lng: 27.4305 },
      { name: 'Datca', lat: 36.7333, lng: 27.6833 },
      { name: 'Marmaris', lat: 36.8550, lng: 28.2725 },
      { name: 'Fethiye', lat: 36.6514, lng: 29.1231 },
      { name: 'Kas', lat: 36.2019, lng: 29.6386 },
      { name: 'Kekova', lat: 36.1833, lng: 29.8500 },
      { name: 'Antalya', lat: 36.8841, lng: 30.7056 },
    ],
  },

  // Caribbean Routes
  {
    id: 'caribbean-bvi',
    name: 'British Virgin Islands',
    description: 'Classic Caribbean sailing in the BVI',
    region: 'caribbean',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Tortola (Road Town)', lat: 18.4167, lng: -64.6167 },
      { name: 'Norman Island', lat: 18.3167, lng: -64.6167 },
      { name: 'Peter Island', lat: 18.3500, lng: -64.5833 },
      { name: 'Virgin Gorda', lat: 18.4500, lng: -64.4333 },
      { name: 'Anegada', lat: 18.7333, lng: -64.3333 },
      { name: 'Jost Van Dyke', lat: 18.4500, lng: -64.7500 },
    ],
  },
  {
    id: 'caribbean-windward',
    name: 'Windward Islands Passage',
    description: 'Sailing south through the Windward Islands',
    region: 'caribbean',
    difficulty: 'offshore',
    waypoints: [
      { name: 'Martinique (Fort-de-France)', lat: 14.6042, lng: -61.0742 },
      { name: 'St. Lucia (Rodney Bay)', lat: 14.0833, lng: -60.9500 },
      { name: 'St. Vincent', lat: 13.1600, lng: -61.2250 },
      { name: 'Bequia', lat: 13.0167, lng: -61.2333 },
      { name: 'Mustique', lat: 12.8833, lng: -61.1833 },
      { name: 'Tobago Cays', lat: 12.6333, lng: -61.3500 },
      { name: 'Grenada', lat: 12.0500, lng: -61.7500 },
    ],
  },
  {
    id: 'caribbean-usvi-svi',
    name: 'US & Spanish Virgin Islands',
    description: 'Island hopping between USVI and Spanish Virgin Islands',
    region: 'caribbean',
    difficulty: 'coastal',
    waypoints: [
      { name: 'St. Thomas (Charlotte Amalie)', lat: 18.3419, lng: -64.9307 },
      { name: 'St. John (Cruz Bay)', lat: 18.3311, lng: -64.7967 },
      { name: 'Culebra', lat: 18.3008, lng: -65.3028 },
      { name: 'Vieques', lat: 18.1261, lng: -65.4400 },
      { name: 'Fajardo (Puerto Rico)', lat: 18.3358, lng: -65.6528 },
    ],
  },

  // Baltic Routes
  {
    id: 'baltic-stockholm-archipelago',
    name: 'Stockholm Archipelago',
    description: 'Exploring the 30,000 islands of the Swedish archipelago',
    region: 'baltic',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Stockholm (Wasahamnen)', lat: 59.3293, lng: 18.0686 },
      { name: 'Vaxholm', lat: 59.4028, lng: 18.3525 },
      { name: 'Grinda', lat: 59.4333, lng: 18.5667 },
      { name: 'Sandhamn', lat: 59.2833, lng: 18.9167 },
      { name: 'Utö', lat: 58.9500, lng: 18.2667 },
      { name: 'Nynäshamn', lat: 58.9028, lng: 17.9486 },
    ],
  },
  {
    id: 'baltic-finland-gulf',
    name: 'Gulf of Finland Crossing',
    description: 'Helsinki to Tallinn and the Finnish archipelago',
    region: 'baltic',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Helsinki', lat: 60.1699, lng: 24.9384 },
      { name: 'Suomenlinna', lat: 60.1456, lng: 24.9881 },
      { name: 'Tallinn', lat: 59.4370, lng: 24.7536 },
      { name: 'Hanko', lat: 59.8236, lng: 22.9681 },
      { name: 'Turku', lat: 60.4518, lng: 22.2666 },
    ],
  },
  {
    id: 'baltic-danish-straits',
    name: 'Danish Straits & Islands',
    description: 'Sailing through the Danish archipelago',
    region: 'baltic',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Copenhagen', lat: 55.6761, lng: 12.5683 },
      { name: 'Roskilde', lat: 55.6419, lng: 12.0878 },
      { name: 'Odense (Kerteminde)', lat: 55.4501, lng: 10.6606 },
      { name: 'Svendborg', lat: 55.0594, lng: 10.6078 },
      { name: 'Aero (Marstal)', lat: 54.8556, lng: 10.5167 },
      { name: 'Flensburg', lat: 54.7833, lng: 9.4333 },
    ],
  },

  // Atlantic Crossings
  {
    id: 'atlantic-arc-rally',
    name: 'Atlantic Crossing (ARC Route)',
    description: 'Classic trade wind crossing from Canaries to Caribbean',
    region: 'atlantic',
    difficulty: 'offshore',
    waypoints: [
      { name: 'Las Palmas (Gran Canaria)', lat: 28.1000, lng: -15.4167 },
      { name: 'Mid-Atlantic Waypoint', lat: 20.0000, lng: -40.0000 },
      { name: 'St. Lucia (Rodney Bay)', lat: 14.0833, lng: -60.9500 },
    ],
  },
  {
    id: 'atlantic-azores-crossing',
    name: 'Azores Crossing',
    description: 'Portugal to Azores mid-Atlantic adventure',
    region: 'atlantic',
    difficulty: 'offshore',
    waypoints: [
      { name: 'Lisbon (Cascais)', lat: 38.6977, lng: -9.4215 },
      { name: 'Horta (Faial)', lat: 38.5333, lng: -28.6333 },
      { name: 'Ponta Delgada (Sao Miguel)', lat: 37.7394, lng: -25.6687 },
    ],
  },
  {
    id: 'atlantic-biscay-crossing',
    name: 'Bay of Biscay Crossing',
    description: 'UK to Spain across the notorious Bay of Biscay',
    region: 'atlantic',
    difficulty: 'offshore',
    waypoints: [
      { name: 'Plymouth', lat: 50.3755, lng: -4.1427 },
      { name: 'Ushant (waypoint)', lat: 48.4500, lng: -5.1000 },
      { name: 'La Coruna', lat: 43.3667, lng: -8.3833 },
      { name: 'Porto', lat: 41.1496, lng: -8.6109 },
    ],
  },

  // Pacific Routes
  {
    id: 'pacific-french-polynesia',
    name: 'French Polynesia Island Hop',
    description: 'Tahiti to the Tuamotus and Society Islands',
    region: 'pacific',
    difficulty: 'offshore',
    waypoints: [
      { name: 'Papeete (Tahiti)', lat: -17.5516, lng: -149.5585 },
      { name: 'Moorea', lat: -17.5388, lng: -149.8295 },
      { name: 'Huahine', lat: -16.7167, lng: -151.0333 },
      { name: 'Raiatea', lat: -16.8333, lng: -151.4333 },
      { name: 'Bora Bora', lat: -16.5004, lng: -151.7415 },
    ],
  },
  {
    id: 'pacific-fiji',
    name: 'Fiji Islands Explorer',
    description: 'Sailing the Fiji archipelago',
    region: 'pacific',
    difficulty: 'coastal',
    waypoints: [
      { name: 'Suva', lat: -18.1416, lng: 178.4419 },
      { name: 'Beqa Island', lat: -18.3833, lng: 177.9833 },
      { name: 'Kadavu', lat: -19.0667, lng: 178.1667 },
      { name: 'Lau Group', lat: -18.2500, lng: -178.8333 },
      { name: 'Savusavu', lat: -16.7833, lng: 179.3333 },
    ],
  },
];

/**
 * Get routes by region
 */
export function getRoutesByRegion(region: SailingRoute['region']): SailingRoute[] {
  return SAILING_ROUTES.filter(r => r.region === region);
}

/**
 * Get routes by difficulty
 */
export function getRoutesByDifficulty(difficulty: SailingRoute['difficulty']): SailingRoute[] {
  return SAILING_ROUTES.filter(r => r.difficulty === difficulty);
}

/**
 * Get a subset of waypoints from a route (for creating legs)
 */
export function getRouteSegment(
  route: SailingRoute,
  startIndex: number,
  count: number
): Waypoint[] {
  return route.waypoints.slice(startIndex, startIndex + count);
}
