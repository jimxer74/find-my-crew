/**
 * Shared logic for generating sailing journey routes via AI.
 * Used by both the API route (/api/ai/generate-journey) and the owner chat service.
 * Avoids HTTP self-calls that fail in serverless environments.
 */

import { logger } from '@/app/lib/logger';
import { callAI, AIServiceError } from '@/app/lib/ai/service';
import {
  validateLocation,
  validateWaypointArray,
  validateDateString,
  validatePositiveNumber,
} from '@/app/lib/ai/validation';
import { parseJsonObjectFromAIResponse } from '@/app/lib/ai/shared';

export interface GenerateJourneyInput {
  startLocation: { name: string; lat: number; lng: number };
  endLocation: { name: string; lat: number; lng: number };
  intermediateWaypoints?: Array<{ name: string; lat: number; lng: number }>;
  boatId: string;
  startDate?: string;
  endDate?: string;
  useSpeedPlanning?: boolean;
  boatSpeed?: number;
  waypointDensity?: 'minimal' | 'moderate' | 'detailed';
}

export const JOURNEY_RISK_LEVELS = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'] as const;
export type JourneyRiskLevel = (typeof JOURNEY_RISK_LEVELS)[number];

export interface GenerateJourneyResult {
  success: true;
  data: {
    journeyName: string;
    description?: string;
    /** AI-assessed overall journey risk: Coastal sailing, Offshore sailing, or Extreme sailing */
    riskLevel?: JourneyRiskLevel;
    legs: Array<{
      name: string;
      start_date?: string;
      end_date?: string;
      waypoints: Array<{
        index: number;
        name: string;
        geocode: { type: string; coordinates: [number, number] };
      }>;
    }>;
  };
}

export interface GenerateJourneyError {
  success: false;
  error: string;
}

/**
 * Generate a sailing journey route with legs using AI.
 * Can be called directly from owner service (no HTTP) or from API route.
 */
export async function generateJourneyRoute(input: GenerateJourneyInput): Promise<GenerateJourneyResult | GenerateJourneyError> {
  const { startLocation, endLocation, intermediateWaypoints = [], boatId, startDate, endDate, useSpeedPlanning, boatSpeed, waypointDensity = 'moderate' } = input;

  const startResult = validateLocation(startLocation, 'Start location');
  if (!startResult.valid) {
    return { success: false, error: startResult.error! };
  }

  const endResult = validateLocation(endLocation, 'End location');
  if (!endResult.valid) {
    return { success: false, error: endResult.error! };
  }

  const waypointsResult = validateWaypointArray(intermediateWaypoints, 20);
  if (!waypointsResult.valid) {
    return { success: false, error: waypointsResult.error! };
  }

  const startDateResult = validateDateString(startDate ?? '', 'Start date');
  if (!startDateResult.valid) {
    return { success: false, error: startDateResult.error! };
  }

  const endDateResult = validateDateString(endDate ?? '', 'End date');
  if (!endDateResult.valid) {
    return { success: false, error: endDateResult.error! };
  }

  const speedResult = validatePositiveNumber(boatSpeed, 'Boat speed', 50);
  if (!speedResult.valid) {
    return { success: false, error: speedResult.error! };
  }

  const validatedStart = startResult.location!;
  const validatedEnd = endResult.location!;
  const validatedWaypoints = waypointsResult.waypoints;
  const validatedStartDate = startDateResult.date;
  const validatedEndDate = endDateResult.date;
  // Use boat speed when provided; otherwise use default for date calculation when journey has dates (so leg dates are still computed)
  const DEFAULT_CRUISING_SPEED_KNOTS = 6;
  const validatedSpeed = speedResult.value ?? (validatedStartDate && validatedEndDate ? DEFAULT_CRUISING_SPEED_KNOTS : null);

  const allWaypoints = [validatedStart, ...validatedWaypoints, validatedEnd];

  const waypointsInfo = allWaypoints.length > 2
    ? `\n\nWaypoints (in order):\n${allWaypoints.map((wp, idx) =>
        `  ${idx === 0 ? 'START' : idx === allWaypoints.length - 1 ? 'END' : `WAYPOINT ${idx}`}: ${wp.name} (${wp.lat}, ${wp.lng})`
      ).join('\n')}`
    : '';

  const dateInfo = validatedStartDate || validatedEndDate
    ? `\nJourney Dates:${validatedStartDate ? ` Start: ${validatedStartDate}` : ''}${validatedEndDate ? ` End: ${validatedEndDate}` : ''}`
    : '';

  const speedPlanningInstructions = useSpeedPlanning && validatedSpeed && validatedStartDate && validatedEndDate
    ? `\n\nSPEED-BASED PLANNING (CRITICAL):
- The boat's average cruising speed is ${validatedSpeed} knots
- Journey must start on ${validatedStartDate} and end by ${validatedEndDate}
- You MUST calculate realistic dates for each leg based on:
  * Distance between waypoints (calculate using coordinates)
  * Boat speed (${validatedSpeed} knots)
  * Realistic sailing time (consider weather, rest periods, and safe navigation)
- For each leg, calculate:
  * Distance in nautical miles between start and end waypoints
  * Estimated sailing time = Distance / Speed (account for 70-80% efficiency due to conditions)
  * Start date: Use journey start date for first leg, or end date of previous leg
  * End date: Start date + calculated sailing time + buffer for rest/weather
- Ensure all leg dates fit within the journey timeframe (${validatedStartDate} to ${validatedEndDate})
- Leg dates should be sequential and realistic
- Include start_date and end_date for each leg in the response`
    : '';

  const waypointDensityInstructions = waypointDensity === 'minimal'
    ? `\n\nWAYPOINT DENSITY: MINIMAL (High-level planning only)
- Create ONLY crew exchange points (ports, marinas, towns, cities)
- NO intermediate waypoints between leg start and end
- Each leg should have exactly 2 waypoints: start port and end port
- Focus on major ports/cities where crew can join/leave
- This is for high-level journey planning, not detailed navigation
- Maximum waypoints per leg: 2 (start + end only)
- Do NOT add navigation waypoints, routing points, or intermediate stops`
    : waypointDensity === 'moderate'
    ? `\n\nWAYPOINT DENSITY: MODERATE (Balanced planning)
- Primary focus: Crew exchange points (ports, marinas, towns, cities)
- Include intermediate waypoints ONLY for:
  * Major routing decisions (e.g., passing through a strait, avoiding dangerous area)
  * Significant stops where crew might want to join/leave
  * Major landmarks or islands that define the route
- Do NOT add waypoints for minor navigation adjustments
- Maximum waypoints per leg: 4 (start + end + up to 2 intermediate)
- Prefer fewer waypoints - quality over quantity
- This is for crew exchange planning, not detailed navigation`
    : `\n\nWAYPOINT DENSITY: DETAILED (Comprehensive routing)
- Include crew exchange points AND navigation waypoints
- Add intermediate waypoints for:
  * Safe routing around hazards
  * Navigation waypoints for optimal passage
  * Interesting stops or landmarks
- Maximum waypoints per leg: 8
- Use when detailed navigation planning is needed`;

  const prompt = `You are a sailing route planner. Generate a sailing journey with legs between locations.${waypointsInfo}

Start Location: ${validatedStart.name} (approximately ${validatedStart.lat}, ${validatedStart.lng})
End Location: ${validatedEnd.name} (approximately ${validatedEnd.lat}, ${validatedEnd.lng})${dateInfo}${speedPlanningInstructions}${waypointDensityInstructions}

CRITICAL RULES:
1. Leg START and END waypoints MUST ALWAYS be at:
   - Ports
   - Marinas
   - Towns
   - Cities
   - Any location where crew can be exchanged (accessible by land/ferry)
   - NEVER in open ocean or remote sea locations

2. Intermediate waypoints (between start and end of a leg):
   ${waypointDensity === 'minimal' 
     ? '- MUST NOT be included - only start and end waypoints allowed'
     : waypointDensity === 'moderate'
     ? '- Can ONLY be included for major routing decisions or significant crew exchange points\n   - Do NOT add waypoints for minor navigation adjustments'
     : '- Can be anywhere relevant for navigation\n   - Open ocean waypoints for routing\n   - Navigation points, buoys, or landmarks\n   - Used when needed for safe routing or interesting stops'}

3. ${allWaypoints.length > 2
    ? `You MUST create legs that visit ALL waypoints in the specified order: ${allWaypoints.map(wp => wp.name).join(' → ')}. Each waypoint must be included as either a start or end point of a leg.`
    : 'Each leg should:'}
   - Have a descriptive name
   - Start at a port/town/city/marina (crew exchange point)
   - End at a port/town/city/marina (crew exchange point)
   - Include intermediate waypoints ONLY if they add value (routing, safety, or interesting stops)
   - Form a logical sailing route considering safe passages
   ${allWaypoints.length > 2 ? `- Visit all specified waypoints in order: ${allWaypoints.map(wp => wp.name).join(' → ')}` : ''}

4. Geocodes (coordinates):
   - You must determine the EXACT coordinates for each waypoint
   - Use real, accurate coordinates for ports, towns, cities, and marinas
   - For the start location (${validatedStart.name}), use the actual coordinates of that port/town/city
   - For the end location (${validatedEnd.name}), use the actual coordinates of that port/town/city
   - Do NOT use the approximate coordinates provided above - find the real coordinates
   - Coordinates must be in [longitude, latitude] format
   - All coordinates must be valid numbers

5. JOURNEY RISK LEVEL (required): Assess the overall journey and return exactly one risk level for the whole journey (not per leg):
   - "Coastal sailing": Near-shore, sheltered waters, short passages, easy access to ports.
   - "Offshore sailing": Open water, multi-day passages, out of sight of land, ocean crossings.
   - "Extreme sailing": High latitude, heavy weather, remote areas, demanding conditions.
   Include "riskLevel" at the top level of your JSON with exactly one of these three strings.

Return ONLY valid JSON in this exact format:${useSpeedPlanning && validatedSpeed && validatedStartDate && validatedEndDate ? `
{
  "journeyName": "Journey name here",
  "description": "Brief description of the journey",
  "riskLevel": "Coastal sailing",
  "legs": [
    {
      "name": "Leg name",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "waypoints": [
        {
          "index": 0,
          "name": "Starting port/town/city name",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        },
        {
          "index": 1,
          "name": "Intermediate waypoint name (optional, only if needed)",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        },
        {
          "index": 2,
          "name": "Ending port/town/city name",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        }
      ]
    }
  ]
}` : `
{
  "journeyName": "Journey name here",
  "description": "Brief description of the journey",
  "riskLevel": "Coastal sailing",
  "legs": [
    {
      "name": "Leg name",
      "waypoints": [
        {
          "index": 0,
          "name": "Starting port/town/city name",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        },
        {
          "index": 1,
          "name": "Intermediate waypoint name (optional, only if needed)",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        },
        {
          "index": 2,
          "name": "Ending port/town/city name",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        }
      ]
    }
  ]
}`}

IMPORTANT:
- First leg's starting waypoint (index 0) name should be "${validatedStart.name}" or a specific port/marina in that location
- Last leg's ending waypoint (highest index) name should be "${validatedEnd.name}" or a specific port/marina in that location
${allWaypoints.length > 2
  ? `- You MUST create legs that visit ALL ${allWaypoints.length} waypoints in order: ${allWaypoints.map(wp => wp.name).join(' → ')}\n- Each waypoint from the list must appear as either the start or end of a leg\n- Create multiple legs if needed to visit all waypoints`
  : ''}
- Waypoint indices must be sequential (0, 1, 2, 3, etc.)
- Start waypoint (index 0) and end waypoint (highest index) of each leg MUST be ports/towns/cities/marinas
- Intermediate waypoints (between start and end) are optional and can be anywhere
- You must provide accurate, real coordinates for all waypoints - do not use placeholder values
- For waypoints provided by the user, use their exact coordinates: ${allWaypoints.map((wp, idx) => `${wp.name}: [${wp.lng}, ${wp.lat}]`).join(', ')}
- Coordinates are [longitude, latitude] format
- riskLevel must be exactly one of: "Coastal sailing", "Offshore sailing", "Extreme sailing"
- Return ONLY the JSON, no markdown, no code blocks`;

  try {
    const result = await callAI({ useCase: 'generate-journey', prompt });
    const generatedData = parseJsonObjectFromAIResponse(result.text);

    if (!generatedData.journeyName || !generatedData.legs || !Array.isArray(generatedData.legs)) {
      return { success: false, error: 'Invalid response format from AI' };
    }

    // Validate and normalize AI-assessed journey risk level (optional; invalid/missing is not fatal)
    const rawRisk = generatedData.riskLevel;
    if (typeof rawRisk === 'string' && JOURNEY_RISK_LEVELS.includes(rawRisk as JourneyRiskLevel)) {
      generatedData.riskLevel = rawRisk as JourneyRiskLevel;
    } else {
      delete generatedData.riskLevel;
    }

    for (let i = 0; i < generatedData.legs.length; i++) {
      const leg = generatedData.legs[i];
      if (!leg.waypoints || !Array.isArray(leg.waypoints)) {
        return { success: false, error: `Leg ${i + 1} is missing waypoints array` };
      }
      if (leg.waypoints.length < 2) {
        return { success: false, error: `Leg ${i + 1} must have at least 2 waypoints (start and end)` };
      }

      leg.waypoints.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));
      leg.waypoints.forEach((wp: any, idx: number) => {
        wp.index = idx;
        if (!wp.geocode) wp.geocode = { type: 'Point', coordinates: [0, 0] };
        if (!wp.geocode.coordinates || !Array.isArray(wp.geocode.coordinates)) {
          wp.geocode.coordinates = [0, 0];
        }
        if (wp.geocode.coordinates.length !== 2) {
          wp.geocode.coordinates = [0, 0];
        }
        wp.geocode.coordinates[0] = typeof wp.geocode.coordinates[0] === 'number' ? wp.geocode.coordinates[0] : 0;
        wp.geocode.coordinates[1] = typeof wp.geocode.coordinates[1] === 'number' ? wp.geocode.coordinates[1] : 0;
        if (!wp.geocode.type) wp.geocode.type = 'Point';
      });

      if (i === 0 && leg.waypoints.length > 0) {
        const firstWp = leg.waypoints[0];
        if (!firstWp.name || firstWp.name.trim() === '') {
          firstWp.name = validatedStart.name;
        }
      }
      if (i === generatedData.legs.length - 1 && leg.waypoints.length > 0) {
        const lastWp = leg.waypoints[leg.waypoints.length - 1];
        if (!lastWp.name || lastWp.name.trim() === '') {
          lastWp.name = validatedEnd.name;
        }
      }
      if (i > 0) {
        const prevLeg = generatedData.legs[i - 1];
        const prevEndWp = prevLeg.waypoints[prevLeg.waypoints.length - 1];
        const currentStartWp = leg.waypoints[0];
        if (prevEndWp && currentStartWp) {
          currentStartWp.index = 0;
          if (!currentStartWp.name || currentStartWp.name.trim() === '') {
            currentStartWp.name = prevEndWp.name || 'Port';
          }
          if (!currentStartWp.geocode || !currentStartWp.geocode.coordinates ||
              (currentStartWp.geocode.coordinates[0] === 0 && currentStartWp.geocode.coordinates[1] === 0)) {
            if (prevEndWp.geocode?.coordinates) {
              currentStartWp.geocode = { type: 'Point', coordinates: [...prevEndWp.geocode.coordinates] };
            }
          }
        }
      }
    }

    return { success: true, data: generatedData as GenerateJourneyResult['data'] };
  } catch (error: any) {
    logger.error('[generateJourneyRoute] Error:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return {
      success: false,
      error: error instanceof AIServiceError ? error.message : (error.message || 'Failed to generate journey'),
    };
  }
}
