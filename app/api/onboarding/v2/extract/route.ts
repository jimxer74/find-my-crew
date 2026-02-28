import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@shared/ai/service';
import { logger } from '@shared/logging';

export const maxDuration = 30;

const EXTRACT_PROMPT = `You are a data extraction assistant. Given a conversation transcript, extract structured owner onboarding data.

Return ONLY a valid JSON object (no markdown, no backticks) with this exact structure:
{
  "profile": {
    "displayName": "string (first name or full name)",
    "experienceLevel": 1-4 or null,
    "aboutMe": "string or null"
  },
  "boat": {
    "makeModel": "string or null",
    "homePort": "string or null",
    "yearBuilt": number or null,
    "loa_m": number or null,
    "type": null
  },
  "journey": null or {
    "fromLocation": "string with city and country, e.g. Helsinki, Finland",
    "toLocation": "string with city and country, e.g. Tallinn, Estonia",
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null",
    "intermediateWaypoints": ["array of intermediate stop strings with city and country"] or null
  }
}

Rules:
- experienceLevel: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper
- yearBuilt: extract from context (e.g. "2003", "built in the 90s" → null)
- loa_m: convert feet to meters if needed (1 foot = 0.3048 m), null if unknown
- journey: null if no journey was mentioned
- intermediateWaypoints: array of intermediate stop location strings if mentioned (e.g. ["Mariehamn, Finland", "Stockholm, Sweden"]), or null if no stops mentioned
- type: always null (will be set later via boat registry)
- Use null for unknown values, not empty strings`;

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json() as { transcript: string };

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    const prompt = `${EXTRACT_PROMPT}\n\nConversation transcript:\n${transcript}\n\nExtract structured data:`;

    const result = await callAI({ useCase: 'owner-chat', prompt, maxTokens: 500 });

    let parsed: Record<string, unknown>;
    try {
      const cleaned = result.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error('[Onboarding v2 extract] Failed to parse AI response', { text: result.text.slice(0, 200) });
      return NextResponse.json({ error: 'Failed to parse extracted data' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    logger.error('[Onboarding v2 extract] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to extract data' }, { status: 500 });
  }
}
