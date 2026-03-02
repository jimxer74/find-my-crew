import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@shared/logging';
import skillsConfig from '@/app/config/skills-config.json';
import experienceLevelsConfig from '@/app/config/experience-levels-config.json';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';

export const maxDuration = 45;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedData {
  name?: string | null;
  experienceLevel?: number | null;
  skills?: string[] | null;
  bio?: string | null;
  motivation?: string | null;
  sailingPreferences?: string | null;
  riskLevels?: string[] | null;
  preferredDepartureLocation?: string | null;
  preferredArrivalLocation?: string | null;
  availabilityStartDate?: string | null;
  availabilityEndDate?: string | null;
}

// Build config-driven values for the prompt
const SKILL_LIST = skillsConfig.general
  .map((s) => `  - "${s.name}" (${s.startingSentence.replace(/ $/, '')})`)
  .join('\n');

const EXPERIENCE_LEVELS = experienceLevelsConfig.levels
  .map((l) => `  - ${l.value} = "${l.displayName}" — ${l.description}`)
  .join('\n');

const RISK_LEVELS = Object.values(riskLevelsConfig)
  .map((r) => `  - "${r.title}"`)
  .join('\n');

const SYSTEM_PROMPT = `You are a friendly onboarding assistant helping a sailor join Find My Crew — a platform connecting crew members with boat owners seeking crew for their journeys.

Your goal is to build a RICH, HIGH-QUALITY crew profile through natural conversation (8–12 exchanges). A complete profile dramatically increases the crew member's chances of getting sailing positions and enables automated registration approval.

CRITICAL — CONVERSATION AWARENESS:
Before composing EVERY reply, carefully review the ENTIRE conversation history above. If the user has already provided any piece of information — even mentioned briefly or in passing — do NOT ask for it again. Track what you already know and only inquire about information that is genuinely still missing. Never repeat a question the user has already answered.

Gather the following information in order, through natural conversation:
1. Name
2. Sailing experience level — choose the closest match from these EXACT values:
${EXPERIENCE_LEVELS}
3. Sailing skills — encourage them to share 3–5 specific skills. Map what they describe to these EXACT skill identifiers (you MUST use these exact strings in the skills array):
${SKILL_LIST}
   Ask follow-up questions to draw out more skills if they give only 1–2.
4. Bio — a brief background: how they got into sailing, how long they've been sailing, most memorable voyage
5. Motivation — what kind of sailing excites them most (e.g. blue-water offshore passages, coastal cruising, racing, delivery trips, exploring remote anchorages)
6. Risk level preferences — ask which they're comfortable with. Use ONLY these EXACT strings (they can choose multiple):
${RISK_LEVELS}
7. Preferred sailing regions — departure area (where they'd ideally join a boat) and destination or arrival area if they have preferences
8. Availability — when they're free to go sailing (approximate months or date range)

Guidelines:
- Be warm and conversational, not form-like
- Ask 1–2 questions per message
- Emphasize that every detail helps them get better positions — owners read profiles carefully
- Acknowledge what you've learned and build on it
- For locations, ask for city AND country or named sailing region (e.g. "Mediterranean", "Finnish archipelago")
- Set isComplete: true ONLY when you have: name + experienceLevel + at least 3 skills + bio

You MUST return a valid JSON object (no markdown, no backticks) in this exact format:
{
  "message": "Your conversational reply to the user",
  "extractedData": {
    "name": null,
    "experienceLevel": null,
    "skills": null,
    "bio": null,
    "motivation": null,
    "sailingPreferences": null,
    "riskLevels": null,
    "preferredDepartureLocation": null,
    "preferredArrivalLocation": null,
    "availabilityStartDate": null,
    "availabilityEndDate": null
  },
  "isComplete": false
}

Include ALL fields in extractedData, using null for unknown values. Fill in everything learned so far.
experienceLevel: integer 1–4 matching the exact values listed above
skills: array using ONLY the exact skill identifier strings listed above (e.g. ["navigation", "cooking", "first_aid"])
riskLevels: array using ONLY these exact strings: ["Coastal sailing", "Offshore sailing", "Extreme sailing"]
availabilityStartDate/availabilityEndDate: YYYY-MM-DD format, or null if not mentioned
preferredDepartureLocation/preferredArrivalLocation: full location string, e.g. "Mediterranean" or "Helsinki, Finland"`;

// ---------------------------------------------------------------------------
// Model config
// ---------------------------------------------------------------------------

// gpt-4o is used instead of gpt-4o-mini for this flow.
// Reason: conversation tracking (not re-asking already-answered questions) requires
// stronger instruction-following. This is a one-time onboarding session per user
// so the cost delta is acceptable.
const CHAT_MODEL = 'openai/gpt-4o';
const CHAT_TEMPERATURE = 0.4;
const CHAT_MAX_TOKENS = 1500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResponse(text: string): {
  message: string;
  extractedData: ExtractedData;
  isComplete: boolean;
} {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    message: String(parsed.message || ''),
    extractedData: parsed.extractedData ?? {},
    isComplete: Boolean(parsed.isComplete),
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, userMessage } = body as {
      messages: ChatMessage[];
      userMessage: string;
    };

    if (!userMessage?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      logger.error('[Onboarding v2 crew/chat] OPENROUTER_API_KEY not configured');
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    // Build a native system/user/assistant message array.
    //
    // The shared callAI() service collapses everything into a single user-role
    // text block, which means the model receives its own previous replies as
    // undifferentiated text and cannot properly track what it has already asked.
    // Calling OpenRouter directly preserves the role separation the model was
    // trained on, which is what makes conversation-state tracking reliable.
    const nativeMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      // Previous turns (the client maintains the full history including the
      // initial assistant greeting, so we pass them all through as-is).
      ...(messages ?? []).map((m: ChatMessage) => ({ role: m.role, content: m.content })),
      // The new user turn
      { role: 'user', content: userMessage },
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: nativeMessages,
        temperature: CHAT_TEMPERATURE,
        max_tokens: CHAT_MAX_TOKENS,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      logger.error('[Onboarding v2 crew/chat] OpenRouter error', {
        status: response.status,
        error: errBody,
      });
      return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
    }

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';

    let parsed: ReturnType<typeof parseResponse>;
    try {
      parsed = parseResponse(text);
    } catch {
      logger.error('[Onboarding v2 crew/chat] Failed to parse AI JSON', {
        text: text.slice(0, 200),
      });
      parsed = {
        message:
          "I'm sorry, I had trouble understanding that. Could you tell me your name and your sailing experience?",
        extractedData: {},
        isComplete: false,
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    logger.error('[Onboarding v2 crew/chat] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}
