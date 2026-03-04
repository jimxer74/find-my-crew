import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@shared/ai/service';
import { logger } from '@shared/logging';
import skillsConfig from '@/app/config/skills-config.json';
import experienceLevelsConfig from '@/app/config/experience-levels-config.json';


const VALID_SKILLS = skillsConfig.general.map((s) => s.name);
const SKILL_LIST = VALID_SKILLS.map((n) => `"${n}"`).join(', ');

const EXPERIENCE_LEVELS = experienceLevelsConfig.levels
  .map((l) => `${l.value}=${l.displayName}`)
  .join(', ');

const EXTRACT_PROMPT = `You are a data extraction assistant. Given a conversation transcript from a crew member onboarding, extract structured profile data.

Return ONLY a valid JSON object (no markdown, no backticks) with this exact structure:
{
  "profile": {
    "displayName": "string or null",
    "experienceLevel": 1-4 or null,
    "bio": "string or null",
    "motivation": "string or null"
  },
  "skills": [{"skill_name": "exact_identifier", "description": "what the user said about this skill"}] or null,
  "sailingPreferences": "string or null",
  "riskLevels": ["Coastal sailing" | "Offshore sailing" | "Extreme sailing"] or null,
  "locationPreferences": null or {
    "preferredDepartureLocation": "string",
    "preferredArrivalLocation": "string or null"
  },
  "availability": null or {
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null"
  }
}

Rules:
- displayName: use first name if only first name given, otherwise full name
- experienceLevel: integer 1–4. Valid values: ${EXPERIENCE_LEVELS}
- bio: 2–4 sentences summarising background — how they got into sailing, experience level context, and anything personal they shared. Write as first person ("I have been sailing...")
- motivation: 1–2 sentences about what kind of sailing excites them most
- skills: array of objects. skill_name MUST be one of: ${SKILL_LIST}. Use the closest matching identifier — do NOT invent new skill names. description MUST be a 1–2 sentence summary of exactly what the user said or described about that specific skill during the conversation (their own words, experience level, context). Do not use generic definitions — extract from the actual conversation. If the user gave no detail for a skill, write a single sentence based on what can be inferred from their overall background.
- sailingPreferences: any general sailing preference text that doesn't fit bio or motivation (e.g. "prefers long passages to coastal day sails")
- riskLevels: MUST use exactly these strings: "Coastal sailing", "Offshore sailing", "Extreme sailing". Array of whichever apply.
- locationPreferences: only include if at least one location preference was discussed; use null if nothing was mentioned
- availability: only include if availability dates or months were discussed; convert "summer 2026" → approximate YYYY-MM-DD
- Use null for any missing values (never empty strings or empty arrays)`;

export async function POST(request: NextRequest) {
  try {
    const { transcript } = (await request.json()) as { transcript: string };

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    const prompt = `${EXTRACT_PROMPT}\n\nConversation transcript:\n${transcript}\n\nExtract structured data:`;

    const result = await callAI({ useCase: 'crew-chat', prompt, maxTokens: 1000 });

    let parsed: Record<string, unknown>;
    try {
      const cleaned = result.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error('[Onboarding v2 crew/extract] Failed to parse AI response', {
        text: result.text.slice(0, 200),
      });
      return NextResponse.json({ error: 'Failed to parse extracted data' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    logger.error('[Onboarding v2 crew/extract] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to extract data' }, { status: 500 });
  }
}
