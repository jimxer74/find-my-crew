/**
 * AI Assistant Location Bounding Box Registry
 *
 * Provides predefined bounding boxes for common sailing regions.
 * Used by the AI to resolve location names to geographic coordinates.
 */

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface LocationRegion {
  name: string;
  aliases: string[];
  category: 'mediterranean' | 'atlantic' | 'caribbean' | 'northern_europe' | 'pacific' | 'indian_ocean' | 'south_america' | 'arctic' | 'antarctic';
  bbox: BoundingBox;
  description?: string;
}

/**
 * Registry of predefined sailing regions with their bounding boxes
 */
export const LOCATION_REGISTRY: LocationRegion[] = [
  // Mediterranean
  {
    name: 'Full Mediterranean',
    aliases: ['mediterranean', 'med', 'the med', 'mediterranean sea'],
    category: 'mediterranean',
    bbox: { minLng: -6, minLat: 30, maxLng: 36, maxLat: 46 },
    description: 'The entire Mediterranean Sea from Gibraltar to the Eastern Med',
  },
  {
    name: 'Western Mediterranean',
    aliases: ['western med', 'west med', 'western mediterranean'],
    category: 'mediterranean',
    bbox: { minLng: -6, minLat: 35, maxLng: 10, maxLat: 44 },
    description: 'Western Mediterranean including Spain, France, and Western Italy',
  },
  {
    name: 'Eastern Mediterranean',
    aliases: ['eastern med', 'east med', 'eastern mediterranean'],
    category: 'mediterranean',
    bbox: { minLng: 10, minLat: 32, maxLng: 36, maxLat: 42 },
    description: 'Eastern Mediterranean including Greece, Turkey, and the Levant',
  },
  {
    name: 'Barcelona area',
    aliases: ['barcelona', 'catalonia', 'costa brava'],
    category: 'mediterranean',
    bbox: { minLng: 1.5, minLat: 41.0, maxLng: 2.5, maxLat: 41.8 },
    description: 'Barcelona and surrounding Catalan coast',
  },
  {
    name: 'Balearic Islands',
    aliases: ['balearics', 'mallorca', 'majorca', 'ibiza', 'menorca', 'formentera'],
    category: 'mediterranean',
    bbox: { minLng: 1.0, minLat: 38.5, maxLng: 4.5, maxLat: 40.5 },
    description: 'Balearic Islands including Mallorca, Ibiza, and Menorca',
  },
  {
    name: 'French Riviera',
    aliases: ['cote d\'azur', 'côte d\'azur', 'riviera', 'nice', 'monaco', 'cannes', 'st tropez', 'saint tropez'],
    category: 'mediterranean',
    bbox: { minLng: 5.5, minLat: 42.8, maxLng: 7.8, maxLat: 43.8 },
    description: 'French Riviera from Marseille to the Italian border',
  },
  {
    name: 'Croatia',
    aliases: ['croatian coast', 'dalmatia', 'dalmatian coast', 'split', 'dubrovnik', 'adriatic croatia'],
    category: 'mediterranean',
    bbox: { minLng: 13.0, minLat: 42.0, maxLng: 17.5, maxLat: 45.5 },
    description: 'Croatian Adriatic coast including Dalmatian islands',
  },
  {
    name: 'Greek Islands',
    aliases: ['greece', 'aegean', 'cyclades', 'dodecanese', 'ionian islands', 'greek islands'],
    category: 'mediterranean',
    bbox: { minLng: 23.0, minLat: 35.0, maxLng: 28.0, maxLat: 39.5 },
    description: 'Greek Islands in the Aegean Sea',
  },
  {
    name: 'Sardinia',
    aliases: ['sardegna', 'costa smeralda'],
    category: 'mediterranean',
    bbox: { minLng: 8.0, minLat: 38.8, maxLng: 10.0, maxLat: 41.3 },
    description: 'Island of Sardinia, Italy',
  },
  {
    name: 'Corsica',
    aliases: ['corse'],
    category: 'mediterranean',
    bbox: { minLng: 8.5, minLat: 41.3, maxLng: 9.6, maxLat: 43.0 },
    description: 'Island of Corsica, France',
  },
  {
    name: 'Sicily',
    aliases: ['sicilia', 'aeolian islands'],
    category: 'mediterranean',
    bbox: { minLng: 12.0, minLat: 36.6, maxLng: 15.7, maxLat: 38.8 },
    description: 'Island of Sicily and surrounding waters',
  },
  {
    name: 'Turkish Riviera',
    aliases: ['turkey', 'turkish coast', 'bodrum', 'marmaris', 'fethiye', 'antalya'],
    category: 'mediterranean',
    bbox: { minLng: 27.0, minLat: 36.0, maxLng: 32.0, maxLat: 37.5 },
    description: 'Turkish Mediterranean coast',
  },

  // Atlantic
  {
    name: 'Canary Islands',
    aliases: ['canaries', 'gran canaria', 'tenerife', 'lanzarote', 'fuerteventura', 'la palma'],
    category: 'atlantic',
    bbox: { minLng: -18.5, minLat: 27.5, maxLng: -13.5, maxLat: 29.5 },
    description: 'Canary Islands, Spain - popular ARC start location',
  },
  {
    name: 'Azores',
    aliases: ['acores', 'azores islands'],
    category: 'atlantic',
    bbox: { minLng: -31.5, minLat: 36.5, maxLng: -25.0, maxLat: 40.0 },
    description: 'Azores archipelago - mid-Atlantic waypoint',
  },
  {
    name: 'Madeira',
    aliases: ['madeira island', 'funchal', 'porto santo'],
    category: 'atlantic',
    bbox: { minLng: -17.5, minLat: 32.3, maxLng: -16.2, maxLat: 33.2 },
    description: 'Madeira and Porto Santo islands',
  },
  {
    name: 'Cape Verde',
    aliases: ['cabo verde', 'cape verde islands', 'mindelo', 'sal'],
    category: 'atlantic',
    bbox: { minLng: -25.5, minLat: 14.5, maxLng: -22.5, maxLat: 17.5 },
    description: 'Cape Verde Islands - Atlantic crossing waypoint',
  },
  {
    name: 'Portugal coast',
    aliases: ['portugal', 'lisbon', 'lisboa', 'cascais', 'algarve', 'lagos', 'portuguese coast'],
    category: 'atlantic',
    bbox: { minLng: -10.0, minLat: 36.9, maxLng: -7.5, maxLat: 42.2 },
    description: 'Portuguese Atlantic coast from Algarve to northern Portugal',
  },
  {
    name: 'Galicia',
    aliases: ['galicia spain', 'northwest spain', 'nw spain', 'vigo', 'la coruña', 'rias baixas'],
    category: 'atlantic',
    bbox: { minLng: -9.5, minLat: 41.8, maxLng: -7.0, maxLat: 44.0 },
    description: 'Northwest Spain - Galicia region',
  },
  {
    name: 'Brittany',
    aliases: ['bretagne', 'brittany france', 'brest', 'saint malo'],
    category: 'atlantic',
    bbox: { minLng: -5.5, minLat: 47.0, maxLng: -1.0, maxLat: 49.0 },
    description: 'Brittany coast, France',
  },
  {
    name: 'Bay of Biscay',
    aliases: ['biscay', 'golfe de gascogne'],
    category: 'atlantic',
    bbox: { minLng: -10.0, minLat: 43.0, maxLng: -1.0, maxLat: 48.0 },
    description: 'Bay of Biscay between France and Spain',
  },

  // Caribbean
  {
    name: 'Eastern Caribbean',
    aliases: ['east caribbean', 'windward islands', 'leeward islands'],
    category: 'caribbean',
    bbox: { minLng: -65.0, minLat: 10.0, maxLng: -59.0, maxLat: 19.0 },
    description: 'Eastern Caribbean island chain',
  },
  {
    name: 'Western Caribbean',
    aliases: ['west caribbean'],
    category: 'caribbean',
    bbox: { minLng: -88.0, minLat: 15.0, maxLng: -77.0, maxLat: 23.0 },
    description: 'Western Caribbean including Belize, Honduras, and Jamaica',
  },
  {
    name: 'BVI/USVI',
    aliases: ['british virgin islands', 'bvi', 'us virgin islands', 'usvi', 'virgin islands', 'tortola', 'st thomas', 'st john'],
    category: 'caribbean',
    bbox: { minLng: -65.0, minLat: 17.5, maxLng: -64.0, maxLat: 18.8 },
    description: 'British and US Virgin Islands',
  },
  {
    name: 'Bahamas',
    aliases: ['the bahamas', 'nassau', 'exumas', 'abacos'],
    category: 'caribbean',
    bbox: { minLng: -79.5, minLat: 21.0, maxLng: -72.5, maxLat: 27.5 },
    description: 'The Bahamas archipelago',
  },
  {
    name: 'Greater Antilles',
    aliases: ['cuba', 'jamaica', 'hispaniola', 'haiti', 'dominican republic', 'puerto rico', 'cayman islands'],
    category: 'caribbean',
    bbox: { minLng: -85.0, minLat: 17.5, maxLng: -65.0, maxLat: 23.5 },
    description: 'Cuba, Jamaica, Hispaniola, Puerto Rico, and Cayman Islands',
  },
  {
    name: 'Leeward Islands',
    aliases: ['antigua', 'barbuda', 'st kitts', 'nevis', 'montserrat', 'guadeloupe', 'anguilla', 'st martin', 'st maarten'],
    category: 'caribbean',
    bbox: { minLng: -63.5, minLat: 15.0, maxLng: -59.0, maxLat: 19.0 },
    description: 'Northern Lesser Antilles from Anguilla to Guadeloupe',
  },
  {
    name: 'Windward Islands',
    aliases: ['dominica', 'martinique', 'st lucia', 'st vincent', 'grenadines', 'grenada', 'barbados'],
    category: 'caribbean',
    bbox: { minLng: -62.0, minLat: 12.0, maxLng: -59.0, maxLat: 15.5 },
    description: 'Southern Lesser Antilles from Dominica to Grenada',
  },
  {
    name: 'ABC Islands',
    aliases: ['southern caribbean', 'aruba', 'bonaire', 'curacao', 'curaçao', 'abc'],
    category: 'caribbean',
    bbox: { minLng: -70.5, minLat: 10.0, maxLng: -63.0, maxLat: 13.0 },
    description: 'Aruba, Bonaire, Curaçao and Venezuelan coast islands',
  },
  {
    name: 'Grenadines',
    aliases: ['st vincent and the grenadines', 'svgrenadines', 'bequia', 'mustique', 'tobago cays'],
    category: 'caribbean',
    bbox: { minLng: -61.5, minLat: 12.0, maxLng: -60.5, maxLat: 13.5 },
    description: 'St Vincent and the Grenadines',
  },
  {
    name: 'Turks and Caicos',
    aliases: ['turks & caicos', 'tci', 'providenciales', 'provo'],
    category: 'caribbean',
    bbox: { minLng: -72.5, minLat: 20.5, maxLng: -70.5, maxLat: 22.0 },
    description: 'Turks and Caicos Islands',
  },
  {
    name: 'Trinidad and Tobago',
    aliases: ['trinidad', 'tobago', 't&t'],
    category: 'caribbean',
    bbox: { minLng: -61.9, minLat: 10.0, maxLng: -60.5, maxLat: 11.4 },
    description: 'Trinidad and Tobago - southern Caribbean',
  },

  // Northern Europe
  {
    name: 'Baltic Sea',
    aliases: ['baltic', 'sweden', 'denmark', 'finland', 'estonia', 'stockholm', 'copenhagen', 'helsinki'],
    category: 'northern_europe',
    bbox: { minLng: 10.0, minLat: 53.5, maxLng: 30.0, maxLat: 66.0 },
    description: 'Baltic Sea region',
  },
  {
    name: 'British Isles',
    aliases: ['uk', 'united kingdom', 'britain', 'england', 'scotland', 'ireland', 'wales', 'solent', 'channel islands'],
    category: 'northern_europe',
    bbox: { minLng: -11.0, minLat: 49.5, maxLng: 2.0, maxLat: 61.0 },
    description: 'British Isles including UK and Ireland',
  },
  {
    name: 'English Channel',
    aliases: ['the channel', 'la manche', 'dover strait'],
    category: 'northern_europe',
    bbox: { minLng: -6.0, minLat: 48.5, maxLng: 2.0, maxLat: 51.5 },
    description: 'English Channel between England and France',
  },
  {
    name: 'North Sea',
    aliases: ['netherlands', 'belgium coast', 'german bight'],
    category: 'northern_europe',
    bbox: { minLng: -4.0, minLat: 51.0, maxLng: 9.0, maxLat: 62.0 },
    description: 'North Sea between UK and Scandinavia',
  },
  {
    name: 'Norway',
    aliases: ['norwegian coast', 'fjords', 'oslo', 'bergen', 'lofoten'],
    category: 'northern_europe',
    bbox: { minLng: 4.0, minLat: 57.0, maxLng: 31.0, maxLat: 71.5 },
    description: 'Norwegian coast including fjords',
  },

  // Pacific (common transit routes)
  {
    name: 'French Polynesia',
    aliases: ['tahiti', 'bora bora', 'moorea', 'marquesas', 'tuamotus'],
    category: 'pacific',
    bbox: { minLng: -154.0, minLat: -28.0, maxLng: -134.0, maxLat: -7.0 },
    description: 'French Polynesia including Society Islands and Marquesas',
  },
  {
    name: 'Fiji',
    aliases: ['fiji islands', 'suva', 'viti levu'],
    category: 'pacific',
    bbox: { minLng: 176.0, minLat: -21.0, maxLng: -179.0, maxLat: -12.0 },
    description: 'Fiji archipelago',
  },
  {
    name: 'Tonga',
    aliases: ['tonga islands', 'vavau'],
    category: 'pacific',
    bbox: { minLng: -176.5, minLat: -22.5, maxLng: -173.5, maxLat: -15.5 },
    description: 'Kingdom of Tonga',
  },
  {
    name: 'New Zealand',
    aliases: ['nz', 'auckland', 'bay of islands', 'north island', 'south island'],
    category: 'pacific',
    bbox: { minLng: 166.0, minLat: -47.5, maxLng: 179.0, maxLat: -34.0 },
    description: 'New Zealand waters',
  },
  // Mediterranean (additional popular sub-regions)
  {
    name: 'Amalfi Coast & Southern Italy',
    aliases: ['amalfi', 'amalfi coast', 'positano', 'capri', 'naples', 'sicilian coast', 'amalfitana'],
    category: 'mediterranean',
    bbox: { minLng: 14.0, minLat: 40.0, maxLng: 16.0, maxLat: 41.0 },
    description: 'Iconic Amalfi Coast, Capri, and southern Italian waters – dramatic cliffs and luxury anchorages',
  },
  {
    name: 'Ionian Islands',
    aliases: ['ionian', 'corfu', 'lefkas', 'zakynthos', 'cephalonia', 'ithaca', 'greek ionian'],
    category: 'mediterranean',
    bbox: { minLng: 19.5, minLat: 37.5, maxLng: 21.0, maxLat: 39.8 },
    description: 'Greek Ionian Islands – protected waters, lush scenery, and easy line-of-sight navigation',
  },

  // Atlantic (additional)
  {
    name: 'New England',
    aliases: ['new england', 'maine', 'cape cod', 'nantucket', 'martha\'s vineyard', 'boston coast'],
    category: 'atlantic',
    bbox: { minLng: -71.0, minLat: 41.0, maxLng: -66.0, maxLat: 45.0 },
    description: 'US Northeast coast – classic summer cruising with harbors, islands, and lobster',
  },

  // Caribbean (additional popular sub-regions)
  {
    name: 'Belize',
    aliases: ['belize', 'belize barrier reef', 'cayes', 'ambergris caye', 'placencia'],
    category: 'caribbean',
    bbox: { minLng: -89.0, minLat: 15.8, maxLng: -87.0, maxLat: 18.5 },
    description: 'Belize Barrier Reef and cayes – excellent snorkeling, protected waters, and laid-back vibe',
  },
  {
    name: 'St Barths & St Martin area',
    aliases: ['st barths', 'st barts', 'st martin', 'st maarten', 'anguilla area'],
    category: 'caribbean',
    bbox: { minLng: -63.2, minLat: 17.8, maxLng: -62.8, maxLat: 18.2 },
    description: 'St Barths, St Martin, and surrounding – luxury, glamour, and gourmet dining',
  },

  // Pacific (additional major areas)
  {
    name: 'Whitsundays',
    aliases: ['whitsundays', 'whitsunday islands', 'airlie beach', 'hamilton island', 'great barrier reef'],
    category: 'pacific',
    bbox: { minLng: 148.5, minLat: -21.0, maxLng: 149.5, maxLat: -19.5 },
    description: 'Australia’s Whitsundays – iconic Great Barrier Reef cruising with white-sand beaches',
  },
  {
    name: 'Seychelles',
    aliases: ['seychelles', 'mahe', 'praslin', 'la digue', 'inner islands'],
    category: 'indian_ocean',
    bbox: { minLng: 55.0, minLat: -5.0, maxLng: 56.0, maxLat: -4.0 },
    description: 'Seychelles inner islands – granite boulders, turquoise waters, and world-class snorkeling',
  },
  {
    name: 'Thailand',
    aliases: ['thailand', 'phuket', 'phang nga bay', 'krabi', 'phi phi', 'andaman sea'],
    category: 'indian_ocean',  // or 'southeast_asia' if you prefer a new category
    bbox: { minLng: 97.5, minLat: 7.5, maxLng: 99.0, maxLat: 9.5 },
    description: 'Andaman Sea coast – Phang Nga Bay limestone karsts, beaches, and island hopping',
  },
  {
    name: 'Alaska',
    aliases: ['alaska', 'inside passage', 'southeast alaska', 'glacier bay', 'juneau', 'ketchikan', 'sitka', 'alaskan fjords'],
    category: 'pacific',
    bbox: { minLng: -136.0, minLat: 54.5, maxLng: -130.0, maxLat: 59.5 },
    description: 'Southeast Alaska’s Inside Passage – protected fjords, glaciers, wildlife (whales, bears, eagles), and remote anchorages; premier expedition cruising destination',
  },

  // New category: Indian Ocean (common for exotics)
  // (add this category if you don't have it; or merge into pacific/exotics)

  // Other high-latitude / adventurous areas often cruised
  {
    name: 'Patagonia',
    aliases: ['patagonia', 'chilean channels', 'cape horn', 'tierra del fuego', 'chiloé'],
    category: 'south_america',
    bbox: { minLng: -76.0, minLat: -55.0, maxLng: -70.0, maxLat: -40.0 },
    description: 'Chilean Patagonia fjords – dramatic mountains, glaciers, and remote wilderness cruising',
  },
  {
    name: 'Pacific Northwest',
    aliases: ['pnw', 'puget sound', 'san juan islands', 'vancouver island', 'inside passage', 'british columbia'],
    category: 'pacific',
    bbox: { minLng: -127.0, minLat: 47.0, maxLng: -122.0, maxLat: 51.0 },
    description: 'US/Canada Pacific Northwest – protected inside passages, orcas, and forested anchorages',
  },
  // Arctic (high-latitude northern expeditions)
  {
    name: 'Greenland',
    aliases: ['greenland', 'east greenland', 'disko bay', 'nuuk', 'ilulissat', 'west greenland', 'south greenland'],
    category: 'arctic',
    bbox: { minLng: -55.0, minLat: 59.0, maxLng: -20.0, maxLat: 83.0 },
    description: 'Greenland’s dramatic fjords, massive icebergs, glaciers, and Inuit culture – premier high-Arctic expedition cruising, especially Disko Bay and East Greenland',
  },
  {
    name: 'Iceland',
    aliases: ['iceland', 'reykjavik', 'westfjords', 'isafjordur', 'akureyri', 'snæfellsnes', 'south coast iceland'],
    category: 'arctic',
    bbox: { minLng: -24.5, minLat: 63.0, maxLng: -13.0, maxLat: 66.5 },
    description: 'Iceland’s volcanic coast, fjords, hot springs, waterfalls, and wildlife – popular circumnavigation and expedition sailing with puffins, whales, and dramatic scenery',
  },
  {
    name: 'Svalbard',
    aliases: ['svalbard', 'spitsbergen', 'longyearbyen', 'north svalbard', 'arctic svalbard'],
    category: 'arctic',
    bbox: { minLng: 10.0, minLat: 76.0, maxLng: 30.0, maxLat: 81.0 },
    description: 'Svalbard archipelago – high Arctic wilderness with polar bears, walrus, glaciers, and fjords; iconic expedition sailing destination above 78°N',
  },

  // Antarctic (southern high-latitude)
  {
    name: 'Antarctica',
    aliases: ['antarctica', 'antarctic peninsula', 'south shetland islands', 'deception island', 'gerlache strait', 'weddell sea edge'],
    category: 'antarctic',
    bbox: { minLng: -65.0, minLat: -65.0, maxLng: -55.0, maxLat: -60.0 },
    description: 'Antarctic Peninsula and South Shetland Islands – the most accessible Antarctic cruising ground with icebergs, penguins, seals, and dramatic fjords; classic expedition yacht destination',
  },
  {
    name: 'Japan',
    aliases: ['seto inland sea', 'setouchi', 'seto naikai', 'inland sea japan', 'hiroshima', 'onomichi', 'kobe', 'naoshima', 'shikoku coast'],
    category: 'pacific',
    bbox: { minLng: 131.0, minLat: 33.5, maxLng: 135.0, maxLat: 35.0 },
    description: 'Japan’s calm, lake-like Seto Inland Sea – protected waters, 700+ islands, historic ports, art islands, temples, and hot springs; top yachting and cultural cruising area',
  },
  {
    name: 'Okinawa',
    aliases: ['okinawa', 'ryukyu islands', 'yaeyama', 'ishigaki', 'miyako', 'naha', 'iriomote', 'japan tropical islands'],
    category: 'pacific',
    bbox: { minLng: 122.0, minLat: 24.0, maxLng: 131.0, maxLat: 27.5 },
    description: 'Subtropical Okinawa and southern Ryukyu Islands – turquoise waters, coral reefs, beaches, jungle islands, and relaxed island-hopping; popular charter and entry point from Asia',
  },
];

/**
 * Normalize a location query for matching
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'") // Normalize quotes
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Calculate similarity score between two strings (simple contains + Levenshtein-inspired)
 */
function calculateSimilarity(query: string, target: string): number {
  const normalizedQuery = normalizeQuery(query);
  const normalizedTarget = normalizeQuery(target);

  // Exact match
  if (normalizedQuery === normalizedTarget) return 1.0;

  // Target contains query (e.g., "barcelona" in "barcelona area")
  if (normalizedTarget.includes(normalizedQuery)) return 0.9;

  // Query contains target (e.g., "barcelona area spain" contains "barcelona")
  if (normalizedQuery.includes(normalizedTarget)) return 0.85;

  // Word-level matching
  const queryWords = normalizedQuery.split(' ');
  const targetWords = normalizedTarget.split(' ');
  const matchingWords = queryWords.filter(w => targetWords.some(tw => tw.includes(w) || w.includes(tw)));
  if (matchingWords.length > 0) {
    return 0.5 + (matchingWords.length / Math.max(queryWords.length, targetWords.length)) * 0.3;
  }

  return 0;
}

export interface LocationSearchResult {
  region: LocationRegion;
  score: number;
  matchedOn: 'name' | 'alias';
}

/**
 * Search for a location by name or alias
 * Returns matching regions sorted by relevance
 */
export function searchLocation(query: string): LocationSearchResult[] {
  const results: LocationSearchResult[] = [];

  for (const region of LOCATION_REGISTRY) {
    // Check name
    const nameScore = calculateSimilarity(query, region.name);
    if (nameScore > 0.4) {
      results.push({ region, score: nameScore, matchedOn: 'name' });
      continue;
    }

    // Check aliases
    let bestAliasScore = 0;
    for (const alias of region.aliases) {
      const aliasScore = calculateSimilarity(query, alias);
      if (aliasScore > bestAliasScore) {
        bestAliasScore = aliasScore;
      }
    }
    if (bestAliasScore > 0.4) {
      results.push({ region, score: bestAliasScore, matchedOn: 'alias' });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Get a single best-matching location
 * Returns null if no good match found
 */
export function getLocationBbox(query: string): {
  bbox: BoundingBox;
  name: string;
  description?: string;
  aliases: string[];
  category: string;
} | null {
  const results = searchLocation(query);
  if (results.length === 0 || results[0].score < 0.5) {
    return null;
  }

  const best = results[0].region;
  return {
    bbox: best.bbox,
    name: best.name,
    description: best.description,
    aliases: best.aliases,
    category: best.category,
  };
}

/**
 * List all available regions, optionally filtered by category
 */
export function listRegions(category?: LocationRegion['category']): {
  name: string;
  category: string;
  aliases: string[];
}[] {
  let regions = LOCATION_REGISTRY;
  if (category) {
    regions = regions.filter(r => r.category === category);
  }
  return regions.map(r => ({
    name: r.name,
    category: r.category,
    aliases: r.aliases,
  }));
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  const categories = new Set(LOCATION_REGISTRY.map(r => r.category));
  return Array.from(categories);
}
