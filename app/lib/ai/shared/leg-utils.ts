/**
 * Shared Leg Utilities
 *
 * Common utilities for transforming and formatting leg data.
 * Used by both assistant and prospect chat services.
 */

/**
 * Raw leg data from database query
 * Uses 'any' for nested objects to handle Supabase's return type variations
 */
export interface RawLeg {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  crew_needed?: number;
  skills?: string[];
  risk_level?: string;
  min_experience_level?: number;
  // Supabase can return this as object or array depending on query
  journeys?: any;
  waypoints?: any[];
}

/**
 * Transformed leg with computed fields
 */
export interface TransformedLeg extends RawLeg {
  combined_skills: string[];
  effective_risk_level: string | null;
  effective_min_experience_level: number | null;
  start_location?: string;
  end_location?: string;
}

/**
 * Get journey object from leg (handles both object and array responses from Supabase)
 */
function getJourney(leg: RawLeg): any {
  if (!leg.journeys) return null;
  // Supabase returns array when using !inner join, but we need the first item
  if (Array.isArray(leg.journeys)) {
    return leg.journeys[0];
  }
  return leg.journeys;
}

/**
 * Transform a raw leg to include computed fields
 * Matches the get_legs_per_viewport database function logic:
 * - combined_skills: union of journey.skills + leg.skills (deduplicated)
 * - effective_risk_level: leg.risk_level if set, otherwise journey.risk_level
 * - effective_min_experience_level: leg.min_experience_level if set, otherwise journey.min_experience_level
 */
export function transformLeg(leg: RawLeg): TransformedLeg {
  const journey = getJourney(leg);
  const journeySkills = journey?.skills || [];
  const legSkills = leg.skills || [];

  // Combine skills (union, deduplicated, filter empty)
  const combinedSkills = [...new Set([...journeySkills, ...legSkills])].filter(
    (s: string) => s && s.trim() !== ''
  );

  // Effective risk_level: leg's if set, otherwise journey's
  const effectiveRiskLevel = leg.risk_level ?? journey?.risk_level ?? null;

  // Effective min_experience_level: leg's if set, otherwise journey's
  const effectiveMinExperienceLevel = leg.min_experience_level ?? journey?.min_experience_level ?? null;

  // Get start and end waypoint names
  const sortedWaypoints = (leg.waypoints || []).sort((a, b) => a.index - b.index);
  const startWaypoint = sortedWaypoints.find((w) => w.index === 0);
  const endWaypoint = sortedWaypoints.length > 0 ? sortedWaypoints[sortedWaypoints.length - 1] : null;

  return {
    ...leg,
    combined_skills: combinedSkills,
    effective_risk_level: effectiveRiskLevel,
    effective_min_experience_level: effectiveMinExperienceLevel,
    start_location: startWaypoint?.name || undefined,
    end_location: endWaypoint?.name || undefined,
  };
}

/**
 * Transform multiple legs
 */
export function transformLegs(legs: RawLeg[]): TransformedLeg[] {
  return legs.map(transformLeg);
}

/**
 * Format a leg for AI response (simplified format for prospect chat)
 */
export interface FormattedLegForAI {
  id: string;
  name: string;
  journeyName?: string;
  journeyId?: string;
  boatName?: string;
  boatType?: string;
  startDate?: string;
  endDate?: string;
  crewNeeded?: number;
  riskLevel?: string;
  departureLocation?: string;
  arrivalLocation?: string;
  // Image fields for carousel display
  journeyImages?: string[];
  boatImages?: string[];
}

/**
 * Get boat object from journey (handles both object and array responses from Supabase)
 */
function getBoat(journey: any): any {
  if (!journey?.boats) return null;
  if (Array.isArray(journey.boats)) {
    return journey.boats[0];
  }
  return journey.boats;
}

/**
 * Format a leg for AI response
 */
export function formatLegForAI(leg: RawLeg): FormattedLegForAI {
  const sortedWaypoints = (leg.waypoints || []).sort((a: any, b: any) => a.index - b.index);
  const startWaypoint = sortedWaypoints.find((w: any) => w.index === 0);
  const endWaypoint = sortedWaypoints.length > 0 ? sortedWaypoints[sortedWaypoints.length - 1] : null;

  const journey = getJourney(leg);
  const boat = getBoat(journey);

  // Get images - journey images first, then boat images as fallback
  const journeyImages = Array.isArray(journey?.images) ? journey.images : [];
  const boatImages = Array.isArray(boat?.images) ? boat.images : [];

  return {
    id: leg.id,
    name: leg.name,
    journeyName: journey?.name,
    journeyId: journey?.id,
    boatName: boat?.name,
    boatType: boat?.type,
    startDate: leg.start_date,
    endDate: leg.end_date,
    crewNeeded: leg.crew_needed,
    riskLevel: leg.risk_level ?? journey?.risk_level,
    departureLocation: startWaypoint?.name,
    arrivalLocation: endWaypoint?.name,
    journeyImages: journeyImages.length > 0 ? journeyImages : undefined,
    boatImages: boatImages.length > 0 ? boatImages : undefined,
  };
}

/**
 * Format multiple legs for AI response
 */
export function formatLegsForAI(legs: RawLeg[]): FormattedLegForAI[] {
  return legs.map(formatLegForAI);
}

/**
 * Filter legs by text query matching on location names
 */
export function filterLegsByLocationText(
  legs: FormattedLegForAI[],
  locationQuery: string
): FormattedLegForAI[] {
  const locationLower = locationQuery.toLowerCase();
  return legs.filter((leg) => {
    const departure = (leg.departureLocation || '').toLowerCase();
    const arrival = (leg.arrivalLocation || '').toLowerCase();
    const journeyName = (leg.journeyName || '').toLowerCase();
    const legName = (leg.name || '').toLowerCase();
    return (
      departure.includes(locationLower) ||
      arrival.includes(locationLower) ||
      journeyName.includes(locationLower) ||
      legName.includes(locationLower)
    );
  });
}
