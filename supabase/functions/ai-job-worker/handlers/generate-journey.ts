/**
 * Handler: generate-journey
 *
 * Generates a multi-leg sailing journey plan using AI.
 * AI config, prompt building, and result parsing are all self-contained here.
 *
 * To adjust the AI model or settings for this use case, edit AI_OPTIONS below.
 */

import { callAI } from '../../_shared/ai-client.ts';
import type { JobHandler, HandlerContext } from '../../_shared/types.ts';

// ---------------------------------------------------------------------------
// AI configuration for this use case
// Change model, tokens, or temperature here without touching anything else
// ---------------------------------------------------------------------------

const AI_OPTIONS = {
  model: 'openai/gpt-4o-mini',
  maxTokens: 20000,
  temperature: 0.5,
  webSearch: false,
};

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

interface WaypointInput {
  name: string;
  lat: number;
  lng: number;
}

interface GenerateJourneyPayload {
  startLocation: WaypointInput;
  endLocation: WaypointInput;
  intermediateWaypoints?: WaypointInput[];
  boatId: string;
  startDate?: string;
  endDate?: string;
  useSpeedPlanning?: boolean;
  boatSpeed?: number;
  waypointDensity?: 'minimal' | 'moderate' | 'detailed';
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(payload: GenerateJourneyPayload): string {
  const {
    startLocation,
    endLocation,
    intermediateWaypoints = [],
    startDate,
    endDate,
    useSpeedPlanning,
    boatSpeed,
    waypointDensity = 'moderate',
  } = payload;

  const DEFAULT_SPEED = 6;
  const speed = boatSpeed ?? (startDate && endDate ? DEFAULT_SPEED : null);
  const allWaypoints = [startLocation, ...intermediateWaypoints, endLocation];

  const waypointsInfo = allWaypoints.length > 2
    ? `\n\nWaypoints (in order):\n${allWaypoints.map((wp, idx) =>
        `  ${idx === 0 ? 'START' : idx === allWaypoints.length - 1 ? 'END' : `WAYPOINT ${idx}`}: ${wp.name} (${wp.lat}, ${wp.lng})`
      ).join('\n')}`
    : '';

  const dateInfo = startDate || endDate
    ? `\nJourney Dates:${startDate ? ` Start: ${startDate}` : ''}${endDate ? ` End: ${endDate}` : ''}`
    : '';

  const speedInstructions = useSpeedPlanning && speed && startDate && endDate
    ? `\n\nSPEED-BASED PLANNING (CRITICAL):
- The boat's average cruising speed is ${speed} knots
- Journey must start on ${startDate} and end by ${endDate}
- Calculate realistic leg dates based on distance / speed (70-80% efficiency)
- Leg dates must be sequential and fit within the journey timeframe`
    : '';

  const densityInstructions = waypointDensity === 'minimal'
    ? `\n\nWAYPOINT DENSITY: MINIMAL — each leg has exactly 2 waypoints (start + end port only)`
    : waypointDensity === 'moderate'
    ? `\n\nWAYPOINT DENSITY: MODERATE — include up to 2 intermediate waypoints per leg only for major routing decisions or crew exchange points`
    : `\n\nWAYPOINT DENSITY: DETAILED — include navigation waypoints, max 8 per leg`;

  const withDates = useSpeedPlanning && speed && startDate && endDate;

  return `You are a sailing route planner. Generate a sailing journey with legs between locations.${waypointsInfo}

Start Location: ${startLocation.name} (approximately ${startLocation.lat}, ${startLocation.lng})
End Location: ${endLocation.name} (approximately ${endLocation.lat}, ${endLocation.lng})${dateInfo}${speedInstructions}${densityInstructions}

CRITICAL RULES:
1. Leg START and END waypoints MUST be at ports, marinas, towns, cities, or crew exchange points.
2. ${allWaypoints.length > 2
    ? `Visit ALL waypoints in order: ${allWaypoints.map(wp => wp.name).join(' → ')}`
    : 'Each leg should form a logical sailing route.'}
3. Use real, accurate coordinates for all locations (not the approximate hints above).
   Coordinates must be in [longitude, latitude] format.
4. Assess the overall journey risk level: "Coastal sailing", "Offshore sailing", or "Extreme sailing".

Return ONLY valid JSON:
{
  "journeyName": "Name",
  "description": "Brief description",
  "riskLevel": "Coastal sailing",
  "legs": [
    {
      "name": "Leg name",${withDates ? '\n      "start_date": "YYYY-MM-DD",\n      "end_date": "YYYY-MM-DD",' : ''}
      "waypoints": [
        { "index": 0, "name": "Port name", "geocode": { "type": "Point", "coordinates": [lng, lat] } }
      ]
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Result parser
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

const VALID_RISK_LEVELS = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];

function parseResult(text: string): Record<string, unknown> {
  const raw = JSON.parse(extractJson(text));

  if (!raw.journeyName || !Array.isArray(raw.legs) || raw.legs.length === 0) {
    throw new Error('Invalid journey structure from AI');
  }

  const riskLevel = VALID_RISK_LEVELS.includes(raw.riskLevel) ? raw.riskLevel : undefined;

  const legs = raw.legs.map((leg: Record<string, unknown>) => {
    const waypoints = (leg.waypoints as Record<string, unknown>[])
      ?.filter(wp => wp.name && wp.geocode)
      .sort((a, b) => ((a.index as number) ?? 0) - ((b.index as number) ?? 0));

    if (!waypoints || waypoints.length < 2) {
      throw new Error(`Leg "${leg.name}" must have at least 2 waypoints`);
    }

    return { ...leg, waypoints };
  });

  return { ...raw, riskLevel, legs };
}

// ---------------------------------------------------------------------------
// Handler export
// ---------------------------------------------------------------------------

export const handler: JobHandler = {
  async run(
    jobId: string,
    rawPayload: Record<string, unknown>,
    ctx: HandlerContext,
  ): Promise<Record<string, unknown>> {
    const payload = rawPayload as unknown as GenerateJourneyPayload;

    await ctx.emitProgress(jobId, 'Building journey prompt', 10);
    const prompt = buildPrompt(payload);

    await ctx.emitProgress(jobId, 'Calling AI (this may take 30–60 seconds)', 25);
    const aiText = await callAI(prompt, AI_OPTIONS);

    await ctx.emitProgress(jobId, 'AI response received, processing route', 70, aiText.slice(0, 500));
    const journeyData = parseResult(aiText);

    await ctx.emitProgress(jobId, 'Journey plan ready', 100, undefined, true);
    return { journey: journeyData };
  },
};
