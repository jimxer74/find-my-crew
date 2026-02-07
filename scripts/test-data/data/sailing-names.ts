/**
 * Sailing-themed names, skills, and certifications for test data generation.
 */

// First names with nautical associations
export const FIRST_NAMES = [
  'Marina', 'Sailor', 'Morgan', 'Coral', 'Dylan', 'Finn', 'Wade', 'Brook',
  'Storm', 'Shelby', 'Harbor', 'Bay', 'Reed', 'Cliff', 'Sandy', 'River',
  // Common names
  'James', 'Emma', 'Oliver', 'Sofia', 'William', 'Isabella', 'Henry', 'Mia',
  'Alexander', 'Charlotte', 'Benjamin', 'Amelia', 'Lucas', 'Harper', 'Mason',
  'Evelyn', 'Ethan', 'Luna', 'Daniel', 'Camila', 'Matthew', 'Aria', 'Jack',
  'Scarlett', 'Sebastian', 'Victoria', 'Owen', 'Madison', 'Theodore', 'Layla',
  'Erik', 'Anna', 'Lars', 'Ingrid', 'Klaus', 'Greta', 'Pierre', 'Marie',
  'Giovanni', 'Lucia', 'Carlos', 'Elena', 'Miguel', 'Carmen', 'Hans', 'Freya',
];

export const LAST_NAMES = [
  // Nautical themed
  'Seaworth', 'Mariner', 'Bowman', 'Stern', 'Anchor', 'Keel', 'Mast', 'Helm',
  'Windward', 'Leeward', 'Portside', 'Starboard', 'Compass', 'Sextant', 'Rigger',
  // Common surnames
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson',
  'Martin', 'Thompson', 'White', 'Lopez', 'Lee', 'Harris', 'Clark', 'Lewis',
  'Eriksson', 'Lindberg', 'Nielsen', 'Johansson', 'Petersen', 'Muller', 'Weber',
  'Bernard', 'Rossi', 'Romano', 'Ferrari', 'Costa', 'Santos', 'Oliveira', 'Larsen',
];

// Nautical themed boat names
export const BOAT_NAMES = [
  // Classic nautical
  'Sea Breeze', 'Wind Dancer', 'Ocean Spirit', 'Starlight', 'Blue Horizon',
  'Northern Star', 'Southern Cross', 'Trade Wind', 'Sunset Chaser', 'Wave Runner',
  'Serenity', 'Wanderlust', 'Horizon', 'Aurora', 'Endeavor', 'Discovery',
  'Adventure', 'Freedom', 'Liberty', 'Harmony', 'Tranquility', 'Odyssey',
  // Modern/Creative
  'Aqua Dream', 'Blue Pearl', 'Sea Pearl', 'Silver Moon', 'Golden Wave',
  'Crystal Blue', 'Azure Sky', 'Coral Reef', 'Dolphin Dance', 'Whale Song',
  'Neptune\'s Gift', 'Poseidon\'s Pride', 'Triton\'s Call', 'Aegean Queen',
  // International
  'Stella Maris', 'Mare Nostrum', 'Vento di Mare', 'Vent du Large', 'Sirocco',
  'Mistral', 'Tramontane', 'Levante', 'Poniente', 'Nordlicht', 'Mondschein',
  // Playful
  'Knot Working', 'Seas the Day', 'Nauti Buoy', 'Ship Happens', 'Sail La Vie',
  'Vitamin Sea', 'Liquid Asset', 'Aquaholic', 'Dock Holiday', 'Bow Movement',
];

// Sailing certifications
export const CERTIFICATIONS = [
  // RYA (Royal Yachting Association)
  'RYA Competent Crew',
  'RYA Day Skipper',
  'RYA Coastal Skipper',
  'RYA Yachtmaster Coastal',
  'RYA Yachtmaster Offshore',
  'RYA Yachtmaster Ocean',
  'RYA Cruising Instructor',
  // ASA (American Sailing Association)
  'ASA 101 Basic Keelboat',
  'ASA 103 Basic Coastal Cruising',
  'ASA 104 Bareboat Cruising',
  'ASA 105 Coastal Navigation',
  'ASA 106 Advanced Coastal Cruising',
  'ASA 108 Offshore Passagemaking',
  // IYT (International Yacht Training)
  'IYT Bareboat Skipper',
  'IYT Coastal Skipper',
  'IYT Yachtmaster Offshore',
  // Other
  'VHF Radio License',
  'STCW Basic Safety',
  'First Aid at Sea',
  'Diesel Engine Maintenance',
  'Marine Weather Certification',
  'Celestial Navigation',
];

// Sailing skills (matches the app's skills enum)
export const SAILING_SKILLS = [
  'Navigation',
  'Sail trim',
  'Anchoring',
  'Docking',
  'Weather routing',
  'Diesel mechanics',
  'Electrical systems',
  'Sail repair',
  'Rigging',
  'Cooking',
  'First aid',
  'VHF radio',
  'Night sailing',
  'Heavy weather sailing',
  'Spinnaker handling',
  'Watch keeping',
  'Passage planning',
  'Chart work',
  'Celestial navigation',
  'Fishing',
];

// Skill combinations that make sense together
export const SKILL_COMBINATIONS = {
  beginner: ['Cooking', 'First aid', 'Watch keeping'],
  competentCrew: ['Sail trim', 'Docking', 'VHF radio', 'Watch keeping', 'Cooking'],
  daySkipper: ['Navigation', 'Sail trim', 'Anchoring', 'Docking', 'Weather routing', 'VHF radio', 'Chart work'],
  coastalSkipper: ['Navigation', 'Sail trim', 'Anchoring', 'Docking', 'Weather routing', 'Night sailing', 'VHF radio', 'Passage planning', 'Chart work'],
  offshoreSkipper: ['Navigation', 'Sail trim', 'Anchoring', 'Docking', 'Weather routing', 'Heavy weather sailing', 'Night sailing', 'VHF radio', 'Passage planning', 'Chart work', 'Celestial navigation'],
  mechanic: ['Diesel mechanics', 'Electrical systems'],
  sailmaker: ['Sail repair', 'Rigging', 'Spinnaker handling'],
};

// Sailing experience descriptions
export const SAILING_DESCRIPTIONS = [
  'Weekend sailor with 5 years of coastal cruising experience in the Mediterranean.',
  'Passionate about offshore sailing with multiple Atlantic crossings under my belt.',
  'Former racing crew member looking for cruising adventures.',
  'New to sailing but eager to learn and contribute to the crew.',
  'Experienced skipper with RYA Yachtmaster Offshore, sailed 30,000+ nautical miles.',
  'Retired captain with extensive blue water experience, now enjoying leisurely cruises.',
  'Engineering background with strong diesel and electrical troubleshooting skills.',
  'Marine biologist who loves combining research with sailing adventures.',
  'Professional chef offering gourmet meals aboard in exchange for sailing experience.',
  'Photographer documenting sailing journeys around the world.',
  'Keen navigator with celestial navigation skills, comfortable on long passages.',
  'Grew up sailing dinghies, now transitioning to cruising yachts.',
  'Solo circumnavigator looking for crew opportunities on interesting routes.',
  'First time sailor but physically fit and ready for any task.',
  'Experienced in both monohulls and catamarans, prefer performance cruisers.',
];

// Sailing preference descriptions
export const SAILING_PREFERENCES = [
  'Prefer coastal sailing with daily anchorages.',
  'Looking for offshore passages and ocean crossings.',
  'Interested in racing regattas and performance sailing.',
  'Enjoy relaxed cruising with time to explore ports.',
  'Seeking Mediterranean summer sailing opportunities.',
  'Prefer tropical destinations in the Caribbean or Pacific.',
  'Interested in high-latitude sailing and Arctic adventures.',
  'Looking for delivery trips to gain sea miles.',
  'Prefer shorter legs of 1-2 weeks maximum.',
  'Available for extended passages of any duration.',
  'Interested in learning and improving sailing skills.',
  'Prefer modern, well-equipped yachts.',
  'Comfortable on traditional vessels with minimal electronics.',
  'Looking for family-friendly sailing opportunities.',
];

// Journey descriptions
export const JOURNEY_DESCRIPTIONS = [
  'A relaxing coastal cruise exploring charming harbors and secluded anchorages.',
  'Offshore passage combining sailing challenge with stunning destinations.',
  'Island hopping adventure through crystal-clear waters and vibrant cultures.',
  'Delivery trip looking for experienced crew to help with the crossing.',
  'Summer cruise with flexible itinerary based on weather and crew preferences.',
  'Racing preparation cruise to get the boat and crew ready for the season.',
  'Shakedown cruise after winter refit, testing all systems.',
  'Family-friendly sailing with easy day sails and plenty of swimming stops.',
  'Photography expedition focusing on dramatic coastal scenery.',
  'Training cruise for crew to gain experience and certifications.',
];

// Leg descriptions
export const LEG_DESCRIPTIONS = [
  'Day sail along the coast with lunch stop at a scenic bay.',
  'Overnight passage to the next island, arriving early morning.',
  'Marina to marina leg with stops for fuel and provisions.',
  'Anchorage hopping through protected bays and coves.',
  'Challenging upwind leg requiring experienced crew.',
  'Downwind run with spinnaker, perfect for building skills.',
  'Harbor approach requiring careful navigation and teamwork.',
  'Extended passage crossing open water, watch system in effect.',
];
