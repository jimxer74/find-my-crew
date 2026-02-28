import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@shared/ai/service';
import { logger } from '@shared/logging';

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

const SYSTEM_PROMPT = `You are a friendly onboarding assistant helping a sailor join Find My Crew — a platform connecting crew members with boat owners seeking crew for their journeys.

Your goal is to build a RICH, HIGH-QUALITY crew profile through natural conversation (8–12 exchanges). A complete profile dramatically increases the crew member's chances of getting sailing positions and enables automated registration approval.

Gather the following information in order, through natural conversation:
1. Name
2. Sailing experience level (Beginner / Competent Crew / Coastal Skipper / Offshore Skipper)
3. Sailing skills — encourage them to share 3–5 specific skills. Include BOTH technical sailing skills (navigation, sail trimming, anchoring, weather routing, engine maintenance, electrical repairs) AND non-technical skills (cooking, first aid, photography, languages spoken). Ask follow-up questions to draw out more skills if they give only 1–2.
4. Bio — a brief background: how they got into sailing, how long they've been sailing, most memorable voyage
5. Motivation — what kind of sailing excites them most (e.g. blue-water offshore passages, coastal cruising, racing, delivery trips, exploring remote anchorages)
6. Risk level preferences — ask which they're comfortable with: Coastal sailing, Offshore sailing, Extreme sailing (they can choose multiple)
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
experienceLevel: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper
skills: array of skill strings, e.g. ["navigation", "sail trimming", "cooking", "engine maintenance"]
riskLevels: array from exactly these values: ["Coastal sailing", "Offshore sailing", "Extreme sailing"]
availabilityStartDate/availabilityEndDate: YYYY-MM-DD format, or null if not mentioned
preferredDepartureLocation/preferredArrivalLocation: full location string, e.g. "Mediterranean" or "Helsinki, Finland"`;

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'Crew member' : 'Assistant'}: ${m.content}`)
    .join('\n');
}

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

    const history = [...(messages ?? []), { role: 'user' as const, content: userMessage }];
    const conversationText =
      history.length > 1
        ? `\n\nConversation so far:\n${formatConversation(history.slice(0, -1))}\n\nCrew member's latest message: ${userMessage}`
        : `\n\nCrew member's message: ${userMessage}`;

    const prompt = `${SYSTEM_PROMPT}${conversationText}\n\nRespond as the Assistant with a JSON object:`;

    const result = await callAI({ useCase: 'crew-chat', prompt, maxTokens: 700 });

    let parsed: ReturnType<typeof parseResponse>;
    try {
      parsed = parseResponse(result.text);
    } catch {
      logger.error('[Onboarding v2 crew/chat] Failed to parse AI JSON', {
        text: result.text.slice(0, 200),
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
