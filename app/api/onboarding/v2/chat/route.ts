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
  experienceLevel?: number | null; // 1-4
  boatMakeModel?: string | null;
  boatHomePort?: string | null;
  boatYearBuilt?: number | null;
  boatLoa?: number | null;
  journeyFrom?: string | null;
  journeyTo?: string | null;
  journeyWaypoints?: string[] | null;
  journeyStartDate?: string | null;
  journeyEndDate?: string | null;
}

const SYSTEM_PROMPT = `You are a friendly onboarding assistant helping a boat owner get started on Find My Crew — a platform connecting sailors with crew members.

Your goal is to gather the following information through natural conversation (5-7 exchanges):
1. Owner's name
2. Sailing experience level (Beginner / Competent Crew / Coastal Skipper / Offshore Skipper)
3. Boat make/model (e.g. "Beneteau Oceanis 46")
4. Boat's home port (city and country)
5. Year the boat was built (helpful for maintenance — optional but ask for it)
6. A planned sailing journey — ask for:
   - Departure location (specific city/port and country, e.g. "Helsinki, Finland")
   - Destination (specific city/port and country, e.g. "Tallinn, Estonia")
   - Any intermediate stops/waypoints (optional, e.g. "stopping in Mariehamn and Stockholm")
   - Approximate departure date (YYYY-MM-DD format)
   - Approximate arrival/return date (YYYY-MM-DD format)
   Journey info is optional but tell the user it enables automatic journey planning with AI-generated legs and waypoints.

Guidelines:
- Be warm and conversational, not form-like
- Ask 1-2 questions per message, not a big list
- For journey locations, always ask for city AND country to ensure accurate geocoding
- When you have enough info (name + experience + boat make/model + home port), set isComplete: true
- Do NOT ask about email or password — that's handled separately
- Keep responses concise (2-4 sentences)

You MUST return a valid JSON object (no markdown, no backticks) in this exact format:
{
  "message": "Your conversational reply to the user",
  "extractedData": {
    "name": null,
    "experienceLevel": null,
    "boatMakeModel": null,
    "boatHomePort": null,
    "boatYearBuilt": null,
    "boatLoa": null,
    "journeyFrom": null,
    "journeyTo": null,
    "journeyWaypoints": null,
    "journeyStartDate": null,
    "journeyEndDate": null
  },
  "isComplete": false
}

Include ALL fields in extractedData, using null for unknown values. Fill in whatever you've learned so far.
experienceLevel: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper
journeyFrom/journeyTo: full location string with city and country, e.g. "Helsinki, Finland"
journeyWaypoints: array of intermediate stop strings with city and country, e.g. ["Mariehamn, Finland", "Stockholm, Sweden"], or null if no stops mentioned
journeyStartDate/journeyEndDate: YYYY-MM-DD format, or null if not mentioned`;

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'Owner' : 'Assistant'}: ${m.content}`)
    .join('\n');
}

function parseResponse(text: string): {
  message: string;
  extractedData: ExtractedData;
  isComplete: boolean;
} {
  // Strip markdown code blocks if present
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
    const conversationText = history.length > 1
      ? `\n\nConversation so far:\n${formatConversation(history.slice(0, -1))}\n\nOwner's latest message: ${userMessage}`
      : `\n\nOwner's message: ${userMessage}`;

    const prompt = `${SYSTEM_PROMPT}${conversationText}\n\nRespond as the Assistant with a JSON object:`;

    const result = await callAI({ useCase: 'owner-chat', prompt, maxTokens: 600 });

    let parsed: ReturnType<typeof parseResponse>;
    try {
      parsed = parseResponse(result.text);
    } catch {
      logger.error('[Onboarding v2 chat] Failed to parse AI JSON', { text: result.text.slice(0, 200) });
      parsed = {
        message: "I'm sorry, I had trouble understanding that. Could you tell me your name and the boat you sail?",
        extractedData: {},
        isComplete: false,
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    logger.error('[Onboarding v2 chat] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}
