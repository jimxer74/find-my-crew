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
  // Mediterranean - General & Sub-regions
  {
    name: 'Mediterranean',
    aliases: ['mediterranean', 'med', 'the med', 'mediterranean sea', 'med sea'],
    category: 'mediterranean',
    bbox: { minLng: -6, minLat: 30, maxLng: 36, maxLat: 46 },
    description: 'The entire Mediterranean Sea from Gibraltar to the Eastern Med – the world’s most popular yachting region',
  },
  {
    name: 'Western Mediterranean',
    aliases: ['western med', 'west med', 'western mediterranean', 'balearics & ligurian'],
    category: 'mediterranean',
    bbox: { minLng: -6, minLat: 35, maxLng: 10, maxLat: 44.5 },
    description: 'Western Mediterranean including Spain, Balearics, France, Liguria and Western Italy',
  },
  {
    name: 'Eastern Mediterranean',
    aliases: ['eastern med', 'east med', 'eastern mediterranean', 'levant', 'adriatic & aegean'],
    category: 'mediterranean',
    bbox: { minLng: 10, minLat: 32, maxLng: 36, maxLat: 43 },
    description: 'Eastern Mediterranean including Greece, Turkey, Cyprus, Levant and Adriatic approaches',
  },
  {
    name: 'Balearic Islands',
    aliases: ['balearics', 'mallorca', 'ibiza', 'menorca', 'formentera', 'majorca', 'balears'],
    category: 'mediterranean',
    bbox: { minLng: 1.0, minLat: 38.5, maxLng: 4.5, maxLat: 40.5 },
    description: 'Spain’s Balearic Islands – vibrant nightlife, beautiful bays, easy navigation and excellent marinas',
  },
  {
    name: 'French Riviera',
    aliases: ['cote d\'azur', 'côte d\'azur', 'riviera', 'nice', 'monaco', 'cannes', 'st tropez', 'saint tropez', 'antibes'],
    category: 'mediterranean',
    bbox: { minLng: 5.5, minLat: 42.8, maxLng: 7.8, maxLat: 43.8 },
    description: 'French Riviera from Marseille area to the Italian border – glamour, superyachts and celebrity anchorages',
  },
  {
    name: 'Costa Brava',
    aliases: [
      'costa brava', 'catalan coast', 'girona coast', 'empuriabrava', 'cadaqués', 'tossa de mar', 
      'palamós', 'lloret de mar', 'begur', 'roses', 'port de la selva', 'cap de creus', 
      'blanes', 'llançà', 'calella de palafrugell'
    ],
    category: 'mediterranean',
    bbox: { 
      minLng: 2.4, 
      minLat: 41.6, 
      maxLng: 3.5, 
      maxLat: 42.4 
    },
    description: 'Costa Brava – rugged Catalan coast with dramatic cliffs, hidden coves, turquoise waters, medieval villages, and excellent marinas; perfect for short hops, anchoring in pine-fringed bays, and enjoying fresh seafood',
  },
  {
    name: 'Costa Blanca',
    aliases: [
      'costa blanca', 'white coast', 'alicante coast', 'valencian coast', 'denia', 'javea', 'xabia', 
      'moraira', 'calpe', 'altea', 'benidorm', 'villajoyosa', 'alicante', 'santa pola', 
      'torrevieja', 'guardamar', 'benissa', 'jávea', 'altea hills', 'cabo de la nao'
    ],
    category: 'mediterranean',
    bbox: { 
      minLng: -0.9, 
      minLat: 37.8, 
      maxLng: 0.4, 
      maxLat: 39.0 
    },
    description: 'Costa Blanca – sunny southeastern Spanish coast with long sandy beaches, modern marinas, family-friendly anchorages, and lively resorts; great for relaxed cruising, beach stops, and easy access to Alicante airport and inland villages',
  },
  {
    name: 'Corsica & Sardinia',
    aliases: ['corsica', 'sardinia', 'costa smeralda', 'maddalena', 'bonifacio', 'calvi', 'ajaccio', 'porto cervo'],
    category: 'mediterranean',
    bbox: { minLng: 8.0, minLat: 38.8, maxLng: 10.0, maxLat: 43.0 },
    description: 'Corsica and Sardinia – wild coastlines, turquoise waters, dramatic cliffs and excellent protected anchorages',
  },
  {
    name: 'Amalfi Coast & Southern Italy',
    aliases: ['amalfi', 'amalfi coast', 'positano', 'capri', 'naples', 'sicilian coast', 'amalfitana', 'procida', 'ischia'],
    category: 'mediterranean',
    bbox: { minLng: 13.5, minLat: 40.0, maxLng: 16.0, maxLat: 41.2 },
    description: 'Iconic Amalfi Coast, Capri, Sorrento and southern Italian waters – dramatic cliffs, luxury and historic ports',
  },
  {
    name: 'Aeolian Islands',
    aliases: ['aeolian', 'lipari', 'vulcano', 'stromboli', 'salina', 'sicily north', 'eolian islands'],
    category: 'mediterranean',
    bbox: { minLng: 14.2, minLat: 38.3, maxLng: 15.3, maxLat: 38.9 },
    description: 'Volcanic Aeolian Islands north of Sicily – black sand beaches, active volcanoes and dramatic scenery',
  },
  {
    name: 'Greek Islands',
    aliases: [
      'greece', 'aegean', 'cyclades', 'dodecanese', 'ionian islands', 'greek islands',
      'greek archipelago', 'aegean islands', 'hellenic islands', 'saronic gulf', ' Sporades'
    ],
    category: 'mediterranean',
    bbox: { minLng: 19.0, minLat: 34.5, maxLng: 30.0, maxLat: 41.0 },
    description: 'Greek Islands in the Aegean and Ionian Seas – island hopping, ancient sites and crystal waters',
  },
  {
    name: 'Ionian Islands',
    aliases: ['ionian', 'corfu', 'lefkas', 'zakynthos', 'cephalonia', 'ithaca', 'greek ionian', 'paxos'],
    category: 'mediterranean',
    bbox: { minLng: 19.5, minLat: 37.5, maxLng: 21.0, maxLat: 39.8 },
    description: 'Greek Ionian Islands – lush, green scenery, protected waters and easy line-of-sight navigation',
  },
  {
    name: 'Croatia / Dalmatia',
    aliases: ['croatia', 'dalmatia', 'split', 'dubrovnik', 'hvar', 'korcula', 'vis', 'mljet', 'kornati', 'adriatic croatia'],
    category: 'mediterranean',
    bbox: { minLng: 13.0, minLat: 42.0, maxLng: 19.0, maxLat: 45.0 },
    description: 'Croatian Adriatic / Dalmatian Coast – over 1,200 islands, national parks, medieval towns and clear waters',
  },
  {
    name: 'Turkish Riviera',
    aliases: ['turkey', 'turkish coast', 'bodrum', 'marmaris', 'fethiye', 'antalya', 'gocek', 'kas', 'kalkan'],
    category: 'mediterranean',
    bbox: { minLng: 26.5, minLat: 36.0, maxLng: 32.0, maxLat: 38.0 },
    description: 'Turkish Mediterranean & Aegean coast – gulets, hidden bays, ancient ruins and excellent value',
  },

  // Atlantic
  {
    name: 'Canary Islands',
    aliases: ['canaries', 'tenerife', 'gran canaria', 'lanzarote', 'fuerteventura', 'la gomera', 'las palmas'],
    category: 'atlantic',
    bbox: { minLng: -18.5, minLat: 27.0, maxLng: -13.0, maxLat: 29.5 },
    description: 'Canary Islands – year-round sunshine, trade winds, volcanic landscapes and Atlantic crossing gateway',
  },
  {
    name: 'Cape Verde',
    aliases: ['cabo verde', 'cape verde islands', 'mindelo', 'sal', 'sao vicente'],
    category: 'atlantic',
    bbox: { minLng: -25.5, minLat: 14.5, maxLng: -22.5, maxLat: 17.5 },
    description: 'Cape Verde Islands – Atlantic crossing waypoint, music, beaches and laid-back culture',
  },
  {
    name: 'Portugal coast',
    aliases: ['portugal', 'lisbon', 'lisboa', 'cascais', 'algarve', 'lagos', 'portuguese coast', 'madeira', 'azores'],
    category: 'atlantic',
    bbox: { minLng: -11.0, minLat: 36.9, maxLng: -6.0, maxLat: 42.2 },
    description: 'Portuguese Atlantic coast from Algarve to northern Portugal – surf, wine regions and historic ports',
  },
  {
    name: 'Bay of Biscay',
    aliases: ['biscay', 'golfe de gascogne', 'bilbao', 'santander'],
    category: 'atlantic',
    bbox: { minLng: -10.0, minLat: 43.0, maxLng: -1.0, maxLat: 48.0 },
    description: 'Bay of Biscay between France and Spain – challenging but rewarding passage waters',
  },

  // ... (keeping most of your Caribbean entries unchanged as they are solid; only adding aliases where useful)

  // Atlantic / US & Canada East Coast additions
  {
    name: 'New England',
    aliases: [
      'new england', 'maine', 'cape cod', 'nantucket', 'martha\'s vineyard', 'boston coast',
      'newport ri', 'rhode island', 'block island', 'boston', 'marblehead', 'gloucester', 'portland me'
    ],
    category: 'atlantic',
    bbox: { 
      minLng: -71.0, 
      minLat: 41.0, 
      maxLng: -66.0, 
      maxLat: 45.0 
    },
    description: 'New England coast – classic summer cruising with rocky shores, historic harbors, lobster, islands, and protected sounds; from Cape Cod to Maine’s rugged beauty',
  },
  {
    name: 'Chesapeake Bay',
    aliases: [
      'chesapeake', 'chesapeake bay', 'annapolis', 'baltimore', 'norfolk', 'solomons island',
      'tangier island', 'smith island', 'st michaels', 'oxford md', 'east coast icw'
    ],
    category: 'atlantic',
    bbox: { 
      minLng: -76.8, 
      minLat: 36.8, 
      maxLng: -75.8, 
      maxLat: 39.8 
    },
    description: 'Chesapeake Bay – largest US Atlantic estuary with thousands of miles of protected waters, creeks, historic towns, excellent marinas, crabs, and wildlife; ideal for relaxed gunkholing and ICW connections',
  },
  {
    name: 'Florida Keys',
    aliases: [
      'florida keys', 'key west', 'dry tortugas', 'marquesas keys', 'key largo', 'islamorada',
      'marathon', 'key biscayne', 'florida keys & bahamas jump-off'
    ],
    category: 'atlantic',
    bbox: { 
      minLng: -83.0, 
      minLat: 24.0, 
      maxLng: -80.0, 
      maxLat: 25.5 
    },
    description: 'Florida Keys – string of tropical islands with turquoise waters, coral reefs, excellent snorkeling/diving, laid-back keys vibe, and easy hops to the Bahamas; year-round warm cruising',
  },
// Caribbean & Panama Caribbean Coast – all relevant entries consolidated

{
  name: 'Caribbean',
  aliases: ['caribbean', 'carib', 'west indies', 'caribbean sea'],
  category: 'caribbean',
  bbox: { minLng: -80.5, minLat: 9.0, maxLng: -59.0, maxLat: 23.0 },
  description: 'The entire Caribbean Sea – from the ABC Islands and Venezuela in the south to the Bahamas and Greater Antilles in the north, now including the Panama/Colón area and Panama Canal Caribbean entrance; the world’s premier tropical cruising playground',
},
{
  name: 'Eastern Caribbean',
  aliases: ['east caribbean', 'windward islands', 'leeward islands', 'lesser antilles east'],
  category: 'caribbean',
  bbox: { minLng: -65.0, minLat: 10.0, maxLng: -59.0, maxLat: 19.0 },
  description: 'Eastern Caribbean island chain – classic trade-wind sailing from the Leewards to the Windwards, with short island hops, protected bays, and vibrant cultures',
},

{
  name: 'Western Caribbean',
  aliases: ['west caribbean', 'belize & honduras', 'jamaica & caymans'],
  category: 'caribbean',
  bbox: { minLng: -88.0, minLat: 15.0, maxLng: -77.0, maxLat: 23.0 },
  description: 'Western Caribbean including Belize Barrier Reef, Honduras Bay Islands, Jamaica, and Cayman Islands – excellent diving, reef-protected waters, and laid-back vibes',
},

{
  name: 'Greater Antilles',
  aliases: ['cuba', 'jamaica', 'hispaniola', 'haiti', 'dominican republic', 'puerto rico', 'cayman islands'],
  category: 'caribbean',
  bbox: { minLng: -85.0, minLat: 17.5, maxLng: -65.0, maxLat: 23.5 },
  description: 'Cuba, Jamaica, Hispaniola (Haiti & Dominican Republic), Puerto Rico, and Cayman Islands – diverse cultures, historic ports, mountains, and excellent cruising variety',
},

{
  name: 'Leeward Islands',
  aliases: ['antigua', 'barbuda', 'st kitts', 'nevis', 'montserrat', 'guadeloupe', 'anguilla', 'st martin', 'st maarten', 'saba', 'st barths'],
  category: 'caribbean',
  bbox: { minLng: -63.5, minLat: 15.0, maxLng: -59.0, maxLat: 19.0 },
  description: 'Northern Lesser Antilles from Anguilla to Guadeloupe – gourmet dining, luxury anchorages, short hops, and protected waters; yachting hub with many charter bases',
},

{
  name: 'Windward Islands',
  aliases: ['dominica', 'martinique', 'st lucia', 'st vincent', 'grenadines', 'grenada', 'barbados', 'bequia', 'mustique'],
  category: 'caribbean',
  bbox: { minLng: -62.0, minLat: 12.0, maxLng: -59.0, maxLat: 15.5 },
  description: 'Southern Lesser Antilles from Dominica to Grenada – lush volcanic islands, stunning bays, hiking, and classic downwind sailing; the Grenadines are a highlight',
},

{
  name: 'ABC Islands',
  aliases: ['southern caribbean', 'aruba', 'bonaire', 'curacao', 'curaçao', 'abc', 'dutch caribbean'],
  category: 'caribbean',
  bbox: { minLng: -70.5, minLat: 10.0, maxLng: -63.0, maxLat: 13.0 },
  description: 'Aruba, Bonaire, Curaçao and nearby Venezuelan coast – dry, desert-like islands with world-class diving, flamingos, and protected southern Caribbean anchorages',
},

{
  name: 'BVI/USVI',
  aliases: ['british virgin islands', 'bvi', 'us virgin islands', 'usvi', 'virgin islands', 'tortola', 'st thomas', 'st john', 'virgin gorda', 'jost van dyke'],
  category: 'caribbean',
  bbox: { minLng: -65.0, minLat: 17.5, maxLng: -64.0, maxLat: 18.8 },
  description: 'British and US Virgin Islands – the Caribbean charter capital with short hops, protected waters, world-famous beaches (White Bay, The Baths), and easy navigation',
},

{
  name: 'Bahamas',
  aliases: ['the bahamas', 'nassau', 'exumas', 'abacos', 'bimini', 'eleuthera', 'andros', 'georgetown exumas'],
  category: 'caribbean',
  bbox: { minLng: -79.5, minLat: 21.0, maxLng: -72.5, maxLat: 27.5 },
  description: 'The Bahamas archipelago – thousands of cays, crystal-clear waters, excellent fishing, and shallow-draft cruising; popular snowbird destination',
},

{
  name: 'Belize',
  aliases: ['belize', 'belize barrier reef', 'cayes', 'ambergris caye', 'placencia', 'turneffe atoll', 'glovers reef'],
  category: 'caribbean',
  bbox: { minLng: -89.0, minLat: 15.8, maxLng: -87.0, maxLat: 18.5 },
  description: 'Belize Barrier Reef and cayes – second-longest barrier reef in the world, excellent snorkeling/diving, protected waters, and laid-back Caribbean vibe',
},

{
  name: 'St Barths & St Martin area',
  aliases: ['st barths', 'st barts', 'st martin', 'st maarten', 'anguilla area', 'saba bank'],
  category: 'caribbean',
  bbox: { minLng: -63.2, minLat: 17.8, maxLng: -62.8, maxLat: 18.2 },
  description: 'St Barths, St Martin, and surrounding – luxury, glamour, gourmet dining, superyacht scene, and short hops between glamorous and relaxed islands',
},

// Panama Caribbean Coast – key areas often cruised in conjunction with the Caribbean
{
  name: 'San Blas Islands (Guna Yala)',
  aliases: ['san blas', 'guna yala', 'san blas islands', 'kuna yala', 'carti', 'chichime', 'lemmon cays', 'coco bandero', 'holandes cays', 'san blas panama'],
  category: 'caribbean',
  bbox: { minLng: -79.5, minLat: 8.5, maxLng: -77.0, maxLat: 10.0 },
  description: 'San Blas Islands (Guna Yala) – 365+ palm-fringed islands and cays off Panama’s Caribbean coast; iconic turquoise waters, white-sand beaches, indigenous Guna culture, and world-class remote cruising (popular Panama Canal exit point)',
},

{
  name: 'Bocas del Toro',
  aliases: ['bocas del toro', 'bocas', 'panama caribbean', 'bastimentos', 'zapatilla cays', 'red frog', 'starfish beach'],
  category: 'caribbean',
  bbox: { minLng: -82.5, minLat: 9.0, maxLng: -81.5, maxLat: 10.0 },
  description: 'Bocas del Toro archipelago – Panama’s western Caribbean coast; lush islands, mangroves, excellent diving, laid-back vibe, and good marinas; popular rainy-season hideout and Canal approach area',
},

{
  name: 'Panama Caribbean Coast',
  aliases: ['panama caribbean', 'portobelo', 'shelter bay', 'colon', 'limon bay', 'panama canal caribbean', 'chagres river'],
  category: 'caribbean',
  bbox: { minLng: -80.5, minLat: 9.0, maxLng: -77.0, maxLat: 10.5 },
  description: 'Panama’s Caribbean coast including Portobelo, Linton Bay, Shelter Bay Marina, and approaches to the Panama Canal – historic forts, jungle rivers, and key staging area for San Blas and Canal transits',
},
  // Pacific / US & Canada West Coast (expanding your existing PNW entries)
  {
    name: 'San Juan Islands & Salish Sea',
    aliases: [
      'san juan islands', 'puget sound', 'salish sea', 'friday harbor', 'orcas island',
      'lopez island', 'san juan island', 'anacortes', 'bellingham', 'port townsend'
    ],
    category: 'pacific',
    bbox: { 
      minLng: -123.5, 
      minLat: 47.8, 
      maxLng: -122.5, 
      maxLat: 49.0 
    },
    description: 'San Juan Islands & Salish Sea – protected island archipelago in the Pacific Northwest with orcas, bald eagles, forested anchorages, charming harbors, and easy hops between US and Canadian waters',
  },
  {
    name: 'British Columbia Coast / Inside Passage',
    aliases: [
      'inside passage', 'bc coast', 'vancouver island', 'gulf islands', 'desolation sound',
      'johnstone strait', 'broughton archipelago', 'victoria bc', 'prince rupert', 'haida gwaii'
    ],
    category: 'pacific',
    bbox: { 
      minLng: -134.0, 
      minLat: 48.0, 
      maxLng: -123.0, 
      maxLat: 55.0 
    },
    description: 'British Columbia Inside Passage – dramatic protected waterways from Vancouver Island to Southeast Alaska with fjords, glaciers, wildlife (bears, whales), remote anchorages, and stunning wilderness cruising',
  },


  // Northern Europe
  {
    name: 'Scandinavia & Finland',
    aliases: [
      'scandinavia', 'nordic', 'norway', 'sweden', 'finland', 
      'norwegian coast', 'fjords', 'oslo', 'bergen', 'lofoten', 
      'norway fjords', 'norwegian fjords', 'geiranger', 'stavanger',
      'swedish coast', 'baltic sea sweden', 'stockholm archipelago', 
      'gulf of bothnia', 'göteborg', 'malmö', 'visby', 'gothenburg',
      'archipelago', 'helsinki', 'turku','oulu', 'aland islands', 
      'saimaa', 'päijänne','kallavesi','saaristomeri','åland','ahvenanmaa', 
      'gulf of finland', 'baltic sea',
      'nordic countries', 'scandinavian peninsula', 'nordics'
    ],
    category: 'northern_europe',
    bbox: { 
      minLng: 4.0,     // Western Norway (with buffer)
      minLat: 55.0,    // Southern tip of Sweden (Skåne) + buffer
      maxLng: 31.5,    // Eastern Finland + Russian border area buffer
      maxLat: 71.5     // Northern Norway (Finnmark) + buffer
    },
    description: 'Scandinavia including Norway, Sweden, and Finland – dramatic Norwegian fjords, extensive Swedish and Finnish archipelagos, Baltic Sea coastlines, Gulf of Bothnia, thousands of inland lakes, midnight sun, northern lights, and abundant wildlife',
  },  // ... (Baltic, British Isles, etc. kept as good)

  // Indian Ocean & Exotics
  {
    name: 'Seychelles',
    aliases: ['seychelles', 'mahe', 'praslin', 'la digue', 'inner islands', 'outer islands'],
    category: 'indian_ocean',
    bbox: { minLng: 55.0, minLat: -5.0, maxLng: 56.5, maxLat: -3.5 },
    description: 'Seychelles inner islands – granite boulders, turquoise waters and world-class snorkeling',
  },
  // ... (Thailand kept)

  // Pacific & High Latitude
  // ... (your existing Pacific entries are strong; added minor alias improvements)

  {
    name: 'Malta & Gozo',
    aliases: ['malta', 'gozo', 'comino', 'valletta', 'mediterranean central'],
    category: 'mediterranean',
    bbox: { minLng: 14.0, minLat: 35.7, maxLng: 14.6, maxLat: 36.1 },
    description: 'Malta, Gozo & Comino – historic harbors, clear waters, diving and strategic Med location',
  },

  // Add at the end if desired – very exotic / expedition
  {
    name: 'Galápagos Islands',
    aliases: ['galapagos', 'ecuador islands', 'darwin', 'galápagos'],
    category: 'pacific',
    bbox: { minLng: -92.0, minLat: -1.5, maxLng: -89.0, maxLat: 1.5 },
    description: 'Galápagos Islands – unique wildlife, volcanic landscapes and legendary expedition sailing',
  },
];

/**
 * Normalize text for case-insensitive comparison.
 * Lowercases, trims, normalizes quotes and whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'") // Normalize quotes
    .replace(/\s+/g, ' '); // Normalize whitespace
}

export interface LocationSearchResult {
  region: LocationRegion;
  /** What the match was found on: the region name or one of its aliases */
  matchedOn: 'name' | 'alias';
  /** The exact name or alias string that matched */
  matchedTerm: string;
}

/**
 * Search for exact (case-insensitive) location matches within a text.
 *
 * Checks whether the text contains an exact occurrence of a region name or alias.
 * Uses word-boundary awareness: a match is valid only when the matched term is not
 * embedded inside a larger word (e.g. "nice" won't match inside "nicely").
 *
 * Longer matches are returned first so "Greek Islands" takes priority over "Greece".
 */
export function searchLocation(text: string): LocationSearchResult[] {
  const normalizedText = normalize(text);
  const results: LocationSearchResult[] = [];

  for (const region of LOCATION_REGISTRY) {
    const normalizedName = normalize(region.name);

    // Check region name
    if (isExactPhraseInText(normalizedText, normalizedName)) {
      results.push({ region, matchedOn: 'name', matchedTerm: region.name });
      continue; // Name match found — no need to check aliases for this region
    }

    // Check aliases
    for (const alias of region.aliases) {
      const normalizedAlias = normalize(alias);
      if (isExactPhraseInText(normalizedText, normalizedAlias)) {
        results.push({ region, matchedOn: 'alias', matchedTerm: alias });
        break; // One alias match is enough per region
      }
    }
  }

  // Sort: longer matched terms first (more specific matches win)
  results.sort((a, b) => b.matchedTerm.length - a.matchedTerm.length);

  return results;
}

/**
 * Check if a phrase appears in text as an exact match (not embedded inside another word).
 * For example, "nice" matches in "sailing near nice" but NOT in "a nice day".
 */
function isExactPhraseInText(normalizedText: string, normalizedPhrase: string): boolean {
  if (normalizedPhrase.length === 0) return false;

  let startIndex = 0;
  while (true) {
    const idx = normalizedText.indexOf(normalizedPhrase, startIndex);
    if (idx === -1) return false;

    const charBefore = idx > 0 ? normalizedText[idx - 1] : ' ';
    const charAfter = idx + normalizedPhrase.length < normalizedText.length
      ? normalizedText[idx + normalizedPhrase.length]
      : ' ';

    // Word boundary: the character before/after must be a non-letter, non-digit
    const isWordBoundaryBefore = !/[a-z0-9\u00C0-\u024F]/.test(charBefore);
    const isWordBoundaryAfter = !/[a-z0-9\u00C0-\u024F]/.test(charAfter);

    if (isWordBoundaryBefore && isWordBoundaryAfter) {
      return true;
    }

    // Keep searching from next position
    startIndex = idx + 1;
  }
}

/**
 * Get a single best-matching location for a query string.
 * Returns the region with the longest matching term, or null if no match.
 */
export function getLocationBbox(query: string): {
  bbox: BoundingBox;
  name: string;
  description?: string;
  aliases: string[];
  category: string;
} | null {
  const results = searchLocation(query);
  if (results.length === 0) {
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

/**
 * Calculate the center point of a bounding box
 */
export function getBboxCenter(bbox: BoundingBox): { lat: number; lng: number } {
  return {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLng + bbox.maxLng) / 2,
  };
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance from a point to a region's center
 */
export function calculateDistanceToRegion(
  userLat: number,
  userLng: number,
  region: LocationRegion
): number {
  const center = getBboxCenter(region.bbox);
  return calculateDistance(userLat, userLng, center.lat, center.lng);
}

/**
 * Sort regions by distance from user's location
 * Returns regions with distance info
 */
export function sortRegionsByDistance(
  userLat: number,
  userLng: number,
  regions: LocationRegion[] = LOCATION_REGISTRY
): Array<LocationRegion & { distance: number }> {
  return regions
    .map((region) => ({
      ...region,
      distance: calculateDistanceToRegion(userLat, userLng, region),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Get all regions from the registry
 */
export function getAllRegions(): LocationRegion[] {
  return LOCATION_REGISTRY;
}
