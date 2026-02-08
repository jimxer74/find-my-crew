/**
 * Prospect AI Chat Service
 *
 * Simplified AI service for unauthenticated prospect users.
 * - No database writes (conversation stored in localStorage on client)
 * - Focused on discovering sailing preferences
 * - Returns matching legs based on gathered preferences
 *
 * Uses shared AI utilities from @/app/lib/ai/shared for tool parsing,
 * bounding box handling, and leg search.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { callAI } from '../service';
import {
  parseToolCalls,
  normalizeDateArgs,
  normalizeLocationArgs,
  normalizeBboxArgs,
  formatToolResultsForAI,
  searchPublishedLegs,
  searchLegsByBbox,
  ToolCall,
  LegSearchOptions,
  // Tool registry
  getToolsForProspect,
  toolsToPromptFormat,
} from '../shared';
import {
  ProspectMessage,
  ProspectChatRequest,
  ProspectChatResponse,
  ProspectPreferences,
  ProspectLegReference,
} from './types';

const MAX_HISTORY_MESSAGES = 15;
const MAX_LEG_REFERENCES = 8;
const MAX_TOOL_ITERATIONS = 5;

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Prospect Chat Service] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Build system prompt for prospect onboarding chat
 */
function buildProspectSystemPrompt(preferences: ProspectPreferences): string {
  const hasPreferences = Object.keys(preferences).some(
    key => preferences[key as keyof ProspectPreferences] !== undefined
  );

  // Get current date for context
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentYear = now.getFullYear();

  return `You are SailSmart's friendly AI assistant helping potential crew members discover sailing opportunities.

CURRENT DATE: ${currentDate}
IMPORTANT: Today's date is ${currentDate}. When users ask about sailing trips, use ${currentYear} or later for date searches. Do NOT use past years like 2024 or 2025 - always search for upcoming trips.

YOUR GOAL: Help users find sailing trips that match their interests and preferences. Show value quickly by finding relevant legs early in the conversation.

CONVERSATION STYLE:
- Be warm, enthusiastic, and conversational
- Ask one or two questions at a time, not long lists
- Show matching sailing legs as soon as you have enough information
- Keep responses concise and focused

WHAT TO DISCOVER (in natural conversation order):
1. What kind of sailing experience they're looking for (adventure, learning, relaxation, etc.)
2. Their experience level (beginner to experienced)
3. When they're available to sail
4. Where they'd like to sail (departure/arrival areas)
5. Any specific skills or certifications they have

${hasPreferences ? `
GATHERED PREFERENCES SO FAR:
${preferences.sailingGoals ? `- Sailing goals: ${preferences.sailingGoals}` : ''}
${preferences.experienceLevel ? `- Experience level: ${preferences.experienceLevel}/4` : ''}
${preferences.preferredDates?.start ? `- Available: ${preferences.preferredDates.start} to ${preferences.preferredDates.end}` : ''}
${preferences.preferredLocations?.length ? `- Preferred locations: ${preferences.preferredLocations.join(', ')}` : ''}
${preferences.skills?.length ? `- Skills: ${preferences.skills.join(', ')}` : ''}
${preferences.riskLevels?.length ? `- Comfort level: ${preferences.riskLevels.join(', ')}` : ''}
` : ''}

RESPONSE FORMAT:
When showing sailing opportunities, use this format for leg references:
[[leg:LEG_UUID:Leg Name]]

Example: "I found some great options for you! Check out [[leg:abc-123:Mediterranean Crossing]] - a 10-day adventure from Spain to Greece."

IMPORTANT:
- Always format leg references exactly as [[leg:UUID:Name]] so they appear as clickable badges
- After showing interesting legs, gently encourage users to sign up to register and get more details
- Keep the conversation flowing naturally - don't overwhelm with too many legs at once
- If the user shares details about themselves, acknowledge and use that information

## LOCATION-BASED SEARCH (CRITICAL)

When users mention locations, you MUST resolve them to geographic bounding boxes and use the \`search_legs_by_location\` tool.

**How to resolve locations to bounding boxes:**
You have geographic knowledge of sailing regions. Convert location names to bounding box coordinates:
- Format: {"minLng": number, "minLat": number, "maxLng": number, "maxLat": number}
- Add padding to cover the entire region (smaller regions need more relative padding)

**Common sailing region bounding boxes:**
- Mediterranean: {"minLng": -6, "minLat": 30, "maxLng": 36, "maxLat": 46}
- Western Mediterranean: {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}
- Eastern Mediterranean: {"minLng": 10, "minLat": 30, "maxLng": 36, "maxLat": 42}
- Caribbean: {"minLng": -85, "minLat": 10, "maxLng": -59, "maxLat": 27}
- Greek Islands: {"minLng": 19, "minLat": 34, "maxLng": 30, "maxLat": 42}
- Croatia/Adriatic: {"minLng": 13, "minLat": 42, "maxLng": 20, "maxLat": 46}
- Canary Islands: {"minLng": -18.5, "minLat": 27.5, "maxLng": -13.3, "maxLat": 29.5}
- Balearic Islands: {"minLng": 1.0, "minLat": 38.5, "maxLng": 4.5, "maxLat": 40.5}
- Barcelona area: {"minLng": 1.5, "minLat": 41.0, "maxLng": 2.5, "maxLat": 41.8}
- French Riviera: {"minLng": 5.5, "minLat": 43.0, "maxLng": 7.5, "maxLat": 43.8}
- Italy/Sardinia: {"minLng": 8.0, "minLat": 38.8, "maxLng": 10.0, "maxLat": 41.3}
- Thailand: {"minLng": 97, "minLat": 5, "maxLng": 106, "maxLat": 21}
- Australia East Coast: {"minLng": 150, "minLat": -38, "maxLng": 154, "maxLat": -23}

**Tool call format:**
\`\`\`tool_call
{"name": "search_legs_by_location", "arguments": {"departureBbox": {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}, "departureDescription": "Western Mediterranean", "startDate": "2026-01-01", "endDate": "2026-12-31"}}
\`\`\`

**Location intent detection:**
- Departure: "from", "departing", "starting from", "leaving", "sailing out of", "in the [region]"
- Arrival: "to", "arriving", "going to", "ending in", "heading to"
- If only one location without direction words, assume it's the departure area

**ALWAYS prefer search_legs_by_location over search_legs** when the user mentions a specific geographic location, as it provides more accurate results using spatial coordinates.`;
}

/**
 * Build tool instructions for the AI using shared tool registry
 */
function buildToolInstructions(): string {
  const tools = getToolsForProspect();
  const toolsDescription = toolsToPromptFormat(tools);

  return `
AVAILABLE TOOLS:
${toolsDescription}

TO USE A TOOL, respond with a JSON code block like this:

For geographic location searches (PREFERRED when user mentions a place):
\`\`\`tool_call
{"name": "search_legs_by_location", "arguments": {"departureBbox": {"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}, "departureDescription": "Western Mediterranean", "startDate": "2026-01-01", "endDate": "2026-12-31"}}
\`\`\`

For simple text searches:
\`\`\`tool_call
{"name": "search_legs", "arguments": {"query": "adventure sailing", "startDate": "2026-06-01", "endDate": "2026-08-31"}}
\`\`\`

**TOOL SELECTION GUIDE:**
- User mentions a PLACE (Mediterranean, Greece, Caribbean, Barcelona, etc.) → Use \`search_legs_by_location\` with bounding box
- User mentions only dates or general terms (summer, adventure, learning) → Use \`search_legs\` with text query

After receiving tool results, provide a helpful response to the user using the [[leg:UUID:Name]] format for any legs you want to highlight.

IMPORTANT: Always use a tool when the user mentions wanting to sail somewhere or asks about available trips. Don't just respond conversationally - search for actual legs!`;
}

/**
 * Execute prospect tool calls
 */
async function executeProspectTools(
  supabase: SupabaseClient,
  toolCalls: ToolCall[]
): Promise<Array<{ name: string; result: unknown; error?: string }>> {
  const results: Array<{ name: string; result: unknown; error?: string }> = [];

  for (const toolCall of toolCalls) {
    log('Executing tool:', toolCall.name);
    log('Raw arguments:', JSON.stringify(toolCall.arguments));

    try {
      const args = toolCall.arguments as Record<string, unknown>;

      if (toolCall.name === 'search_legs') {
        // Text-based search using shared utilities
        const dateArgs = normalizeDateArgs(args);
        const locationArgs = normalizeLocationArgs(args);

        log('Normalized date args:', dateArgs);
        log('Normalized location args:', locationArgs);

        const searchOptions: LegSearchOptions = {
          startDate: dateArgs.startDate,
          endDate: dateArgs.endDate,
          locationQuery: locationArgs.locationQuery,
          riskLevel: args.riskLevel as string,
          limit: (args.limit as number) || 5,
          crewNeeded: true,
        };

        const searchResult = await searchPublishedLegs(supabase, searchOptions);
        log('Found legs:', searchResult.count);
        results.push({
          name: toolCall.name,
          result: { legs: searchResult.legs, total: searchResult.count },
        });

      } else if (toolCall.name === 'search_legs_by_location') {
        // Geographic bounding box search using shared utilities
        const dateArgs = normalizeDateArgs(args);
        const bboxArgs = normalizeBboxArgs(args);

        log('Normalized date args:', dateArgs);
        log('Normalized bbox args:', bboxArgs);

        // Validate that at least one bbox was successfully parsed
        if (!bboxArgs.departureBbox && !bboxArgs.arrivalBbox) {
          // Check if the AI tried to provide bbox but with missing coordinates
          const providedDeparture = args.departureBbox as Record<string, unknown> | undefined;
          const providedArrival = args.arrivalBbox as Record<string, unknown> | undefined;

          let errorDetails = 'No valid bounding box provided.';
          if (providedDeparture) {
            const missing = ['minLng', 'minLat', 'maxLng', 'maxLat'].filter(
              (k) => providedDeparture[k] === undefined
            );
            if (missing.length > 0) {
              errorDetails = `departureBbox is missing required coordinates: ${missing.join(', ')}. You provided: ${JSON.stringify(providedDeparture)}`;
            }
          }
          if (providedArrival) {
            const missing = ['minLng', 'minLat', 'maxLng', 'maxLat'].filter(
              (k) => providedArrival[k] === undefined
            );
            if (missing.length > 0) {
              errorDetails = `arrivalBbox is missing required coordinates: ${missing.join(', ')}. You provided: ${JSON.stringify(providedArrival)}`;
            }
          }

          results.push({
            name: toolCall.name,
            result: null,
            error: `${errorDetails} Each bounding box must have all 4 coordinates: minLng, minLat, maxLng, maxLat.`,
          });
          continue;
        }

        const searchOptions: LegSearchOptions = {
          startDate: dateArgs.startDate,
          endDate: dateArgs.endDate,
          departureBbox: bboxArgs.departureBbox,
          arrivalBbox: bboxArgs.arrivalBbox,
          departureDescription: bboxArgs.departureDescription,
          arrivalDescription: bboxArgs.arrivalDescription,
          limit: (args.limit as number) || 5,
          crewNeeded: true,
        };

        const searchResult = await searchLegsByBbox(supabase, searchOptions);
        log('Found legs:', searchResult.count);
        results.push({
          name: toolCall.name,
          result: {
            legs: searchResult.legs,
            total: searchResult.count,
            searchedDeparture: searchResult.searchedDeparture,
            searchedArrival: searchResult.searchedArrival,
            message: searchResult.message,
          },
        });

      } else {
        results.push({ name: toolCall.name, result: null, error: `Unknown tool: ${toolCall.name}` });
      }
    } catch (error: any) {
      log('Tool execution error:', error);
      results.push({ name: toolCall.name, result: null, error: error.message });
    }
  }

  return results;
}

/**
 * Extract leg references from tool results
 */
function extractLegReferences(
  toolResults: Array<{ name: string; result: unknown }>
): ProspectLegReference[] {
  const refs: ProspectLegReference[] = [];
  const seenIds = new Set<string>();

  for (const result of toolResults) {
    if (!result.result) continue;

    const data = result.result as { legs?: any[] };
    if (!data?.legs || !Array.isArray(data.legs)) continue;

    for (const leg of data.legs) {
      if (!leg.id || seenIds.has(leg.id)) continue;
      seenIds.add(leg.id);

      refs.push({
        id: leg.id,
        name: leg.name || 'Unnamed leg',
        journeyName: leg.journeyName,
        journeyId: leg.journeyId,
        boatName: leg.boatName,
        startDate: leg.startDate,
        endDate: leg.endDate,
        departureLocation: leg.departureLocation,
        arrivalLocation: leg.arrivalLocation,
        journeyImages: leg.journeyImages,
        boatImages: leg.boatImages,
      });

      if (refs.length >= MAX_LEG_REFERENCES) return refs;
    }
  }

  return refs;
}

/**
 * Main prospect chat function
 */
export async function prospectChat(
  supabase: SupabaseClient,
  request: ProspectChatRequest
): Promise<ProspectChatResponse> {
  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║           PROSPECT CHAT - NEW REQUEST                        ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log('📥 USER MESSAGE:', request.message);
  log('📋 Session ID:', request.sessionId || '(new session)');
  log('📜 Conversation history length:', request.conversationHistory?.length || 0);

  const sessionId = request.sessionId || `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const preferences = request.gatheredPreferences || {};
  const history = request.conversationHistory || [];

  // Build prompts
  const systemPrompt = buildProspectSystemPrompt(preferences);
  const toolInstructions = buildToolInstructions();
  const fullSystemPrompt = systemPrompt + '\n\n' + toolInstructions;

  log('');
  log('📝 SYSTEM PROMPT LENGTH:', `${fullSystemPrompt.length} chars`);

  // Build messages for AI
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: fullSystemPrompt },
  ];

  // Add history (limited)
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current user message
  messages.push({ role: 'user', content: request.message });

  log('💬 Total messages for AI:', messages.length);

  // Process with tool loop
  let allToolCalls: ToolCall[] = [];
  let allLegRefs: ProspectLegReference[] = [];
  let currentMessages = [...messages];
  let iterations = 0;
  let finalContent = '';

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    log('');
    log(`🔄 ITERATION ${iterations}/${MAX_TOOL_ITERATIONS}`);

    // Build prompt for AI
    const promptText = currentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');

    // Call AI
    const result = await callAI({
      useCase: 'prospect-chat',
      prompt: promptText,
    });

    log('📥 AI RESPONSE:', `${result.text.length} chars from ${result.provider}/${result.model}`);
    log('');
    log('RESPONSE TEXT:');
    log('─'.repeat(60));
    log(result.text);
    log('─'.repeat(60));

    // Parse tool calls using shared utility
    const { content, toolCalls } = parseToolCalls(result.text);

    log('');
    log('🔧 PARSED TOOL CALLS:', toolCalls.length);
    if (toolCalls.length > 0) {
      toolCalls.forEach((tc, i) => {
        log(`  [${i}] ${tc.name}:`, JSON.stringify(tc.arguments));
      });
    }

    if (toolCalls.length === 0) {
      finalContent = content;
      log('✅ No tool calls, final content ready');
      break;
    }

    // Execute tools
    allToolCalls.push(...toolCalls);
    const toolResults = await executeProspectTools(supabase, toolCalls);

    log('');
    log('📊 TOOL RESULTS:');
    toolResults.forEach((r, i) => {
      if (r.error) {
        log(`  [${i}] ${r.name}: ❌ Error: ${r.error}`);
      } else {
        const resultStr = JSON.stringify(r.result);
        log(`  [${i}] ${r.name}: ✅ ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);
      }
    });

    // Extract leg references
    const newRefs = extractLegReferences(toolResults);
    allLegRefs.push(...newRefs);

    // Add tool results for next iteration using shared utility
    const toolResultsText = formatToolResultsForAI(toolResults);

    currentMessages.push(
      { role: 'assistant', content: result.text },
      { role: 'user', content: `Tool results:\n${toolResultsText}\n\nNow provide a helpful response to the user. Remember to format any legs as [[leg:UUID:Name]].` }
    );
  }

  // Create response message
  const responseMessage: ProspectMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    content: finalContent,
    timestamp: new Date().toISOString(),
    metadata: {
      toolCalls: allToolCalls.length > 0 ? allToolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments as Record<string, unknown>,
      })) : undefined,
      legReferences: allLegRefs.length > 0 ? allLegRefs : undefined,
    },
  };

  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║           PROSPECT CHAT - COMPLETE                           ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log('📤 FINAL RESPONSE:', `${finalContent.length} chars`);
  log('📊 Tool calls:', allToolCalls.length);
  log('🦵 Leg refs:', allLegRefs.length);
  log('');

  return {
    sessionId,
    message: responseMessage,
    extractedPreferences: undefined,
  };
}
