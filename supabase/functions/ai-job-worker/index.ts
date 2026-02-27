/**
 * Supabase Edge Function: ai-job-worker
 *
 * Background AI job worker that bypasses Vercel's 60-second timeout.
 * Uses EdgeRuntime.waitUntil() to continue processing after the HTTP response
 * is sent — the AI loop runs to completion regardless of duration.
 *
 * Invocation: POST { jobId: string }
 * Response:   202 Accepted immediately; work continues in background.
 *
 * Environment variables required:
 *   SUPABASE_URL            — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 *   OPENROUTER_API_KEY      — set via: supabase secrets set OPENROUTER_API_KEY=sk-...
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS for worker operations)
// ---------------------------------------------------------------------------

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

async function emitProgress(
  jobId: string,
  stepLabel: string,
  percent?: number,
  aiMessage?: string,
  isFinal = false,
): Promise<void> {
  await supabase.from('async_job_progress').insert({
    job_id: jobId,
    step_label: stepLabel,
    percent: percent ?? null,
    ai_message: aiMessage ?? null,
    is_final: isFinal,
  });
}

async function markRunning(jobId: string): Promise<void> {
  await supabase
    .from('async_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId);
}

async function markCompleted(jobId: string, result: Record<string, unknown>): Promise<void> {
  await supabase
    .from('async_jobs')
    .update({ status: 'completed', result, completed_at: new Date().toISOString() })
    .eq('id', jobId);
}

async function markFailed(jobId: string, error: string): Promise<void> {
  await supabase
    .from('async_jobs')
    .update({ status: 'failed', error, completed_at: new Date().toISOString() })
    .eq('id', jobId);
  await emitProgress(jobId, 'Failed', 100, undefined, true);
}

// ---------------------------------------------------------------------------
// AI provider call (OpenRouter → openai/gpt-4o-mini)
// ---------------------------------------------------------------------------

async function callOpenRouter(prompt: string, maxTokens = 20000): Promise<string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ---------------------------------------------------------------------------
// Journey generation prompt builder
// Mirrors the logic in shared/ai/generateJourney.ts
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

function buildJourneyPrompt(payload: GenerateJourneyPayload): string {
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
// Journey result parser and validator
// Mirrors the logic in shared/ai/generateJourney.ts
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

function parseAndValidateJourney(text: string): Record<string, unknown> {
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
// Job handler: generate-journey
// ---------------------------------------------------------------------------

async function runGenerateJourney(jobId: string, payload: GenerateJourneyPayload): Promise<void> {
  await emitProgress(jobId, 'Building journey prompt', 10);

  const prompt = buildJourneyPrompt(payload);

  await emitProgress(jobId, 'Calling AI (this may take 30–60 seconds)', 25);

  const aiText = await callOpenRouter(prompt, 20000);

  await emitProgress(jobId, 'AI response received, processing route', 70, aiText.slice(0, 500));

  const journeyData = parseAndValidateJourney(aiText);

  await emitProgress(jobId, 'Journey plan ready', 100, undefined, true);

  await markCompleted(jobId, { journey: journeyData });
}

// ---------------------------------------------------------------------------
// Main job dispatcher
// ---------------------------------------------------------------------------

async function runJob(jobId: string): Promise<void> {
  // Fetch the job (service role — bypasses RLS)
  const { data: job, error } = await supabase
    .from('async_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    console.error(`[ai-job-worker] Job not found: ${jobId}`);
    return;
  }

  if (job.status !== 'pending') {
    console.warn(`[ai-job-worker] Job ${jobId} is already ${job.status}, skipping`);
    return;
  }

  await markRunning(jobId);

  try {
    switch (job.job_type) {
      case 'generate-journey':
        await runGenerateJourney(jobId, job.payload as GenerateJourneyPayload);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-job-worker] Job ${jobId} failed:`, message);
    await markFailed(jobId, message);
  }
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let jobId: string;
  try {
    const body = await req.json();
    jobId = body.jobId;
    if (!jobId) throw new Error('jobId is required');
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Respond 202 immediately — work continues in the background via waitUntil
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(runJob(jobId));

  return new Response(JSON.stringify({ accepted: true, jobId }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
});
