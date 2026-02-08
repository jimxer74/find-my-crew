/**
 * Prospect AI Chat Service
 *
 * Simplified AI service for unauthenticated prospect users.
 * - No database writes (conversation stored in localStorage on client)
 * - Focused on discovering sailing preferences
 * - Returns matching legs based on gathered preferences
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { callAI } from '../service';
import {
  ProspectMessage,
  ProspectChatRequest,
  ProspectChatResponse,
  ProspectPreferences,
  ProspectLegReference,
  ProspectToolCall,
} from './types';

const MAX_HISTORY_MESSAGES = 15;
const MAX_LEG_REFERENCES = 8;
const MAX_TOOL_ITERATIONS = 3;

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

  return `You are SailSmart's friendly AI assistant helping potential crew members discover sailing opportunities.

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
- If the user shares details about themselves, acknowledge and use that information`;
}

/**
 * Get prospect-specific tools (subset of full tools)
 */
function getProspectTools() {
  return [
    {
      name: 'search_legs_by_location',
      description: 'Search for sailing legs by location, dates, and preferences. Use bounding boxes for locations.',
      parameters: {
        type: 'object' as const,
        properties: {
          departureBbox: {
            type: 'object',
            description: 'Bounding box for departure area {minLng, minLat, maxLng, maxLat}',
            properties: {
              minLng: { type: 'number', description: 'Minimum longitude' },
              minLat: { type: 'number', description: 'Minimum latitude' },
              maxLng: { type: 'number', description: 'Maximum longitude' },
              maxLat: { type: 'number', description: 'Maximum latitude' },
            },
          },
          departureDescription: {
            type: 'string',
            description: 'Human-readable description of departure area (e.g., "Mediterranean", "Caribbean")',
          },
          startDate: {
            type: 'string',
            description: 'Start date filter (ISO format)',
          },
          endDate: {
            type: 'string',
            description: 'End date filter (ISO format)',
          },
          riskLevel: {
            type: 'string',
            description: 'Risk level filter',
            enum: ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'],
          },
          minExperienceLevel: {
            type: 'number',
            description: 'Minimum experience level (1-4)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default 5)',
          },
        },
      },
    },
    {
      name: 'search_legs',
      description: 'General search for sailing legs with various filters',
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query text',
          },
          startDate: {
            type: 'string',
            description: 'Start date filter (ISO format)',
          },
          endDate: {
            type: 'string',
            description: 'End date filter (ISO format)',
          },
          riskLevel: {
            type: 'string',
            description: 'Risk level filter',
            enum: ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'],
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default 5)',
          },
        },
      },
    },
  ];
}

/**
 * Execute prospect tool calls
 */
async function executeProspectTools(
  supabase: SupabaseClient,
  toolCalls: ProspectToolCall[]
): Promise<Array<{ name: string; result: unknown; error?: string }>> {
  const results: Array<{ name: string; result: unknown; error?: string }> = [];

  for (const toolCall of toolCalls) {
    log('Executing tool:', toolCall.name);

    try {
      if (toolCall.name === 'search_legs_by_location' || toolCall.name === 'search_legs') {
        const args = toolCall.arguments as any;

        // Build query for published legs only
        let query = supabase
          .from('legs')
          .select(`
            id,
            name,
            description,
            start_date,
            end_date,
            crew_needed,
            risk_level,
            min_experience_level,
            journeys!inner (
              id,
              name,
              state,
              boats (
                id,
                name,
                type,
                make_model
              )
            ),
            waypoints (
              id,
              index,
              name,
              location
            )
          `)
          .eq('journeys.state', 'Published')
          .gt('crew_needed', 0);

        // Apply date filters
        if (args.startDate) {
          query = query.gte('start_date', args.startDate);
        }
        if (args.endDate) {
          query = query.lte('end_date', args.endDate);
        }

        // Apply risk level filter
        if (args.riskLevel) {
          query = query.eq('risk_level', args.riskLevel);
        }

        // Apply experience level filter
        if (args.minExperienceLevel) {
          query = query.lte('min_experience_level', args.minExperienceLevel);
        }

        // Order and limit
        const limit = args.limit || 5;
        query = query.order('start_date', { ascending: true }).limit(limit);

        const { data: legs, error } = await query;

        if (error) {
          log('Search error:', error);
          results.push({ name: toolCall.name, result: null, error: error.message });
          continue;
        }

        // Format results
        const formattedLegs = (legs || []).map((leg: any) => ({
          id: leg.id,
          name: leg.name,
          journeyName: leg.journeys?.name,
          boatName: leg.journeys?.boats?.name,
          boatType: leg.journeys?.boats?.type,
          startDate: leg.start_date,
          endDate: leg.end_date,
          crewNeeded: leg.crew_needed,
          riskLevel: leg.risk_level,
          departureLocation: leg.waypoints?.find((w: any) => w.index === 0)?.name,
          arrivalLocation: leg.waypoints?.reduce((last: any, w: any) =>
            w.index > (last?.index || -1) ? w : last, null)?.name,
        }));

        log('Found legs:', formattedLegs.length);
        results.push({ name: toolCall.name, result: { legs: formattedLegs } });
      } else {
        results.push({ name: toolCall.name, result: null, error: 'Unknown tool' });
      }
    } catch (error: any) {
      log('Tool execution error:', error);
      results.push({ name: toolCall.name, result: null, error: error.message });
    }
  }

  return results;
}

/**
 * Parse tool calls from AI response (simplified version)
 */
function parseToolCalls(text: string): { content: string; toolCalls: ProspectToolCall[] } {
  const toolCalls: ProspectToolCall[] = [];
  let content = text;

  // Find tool call blocks with code block format
  const toolCallRegex = /```(?:tool_call|json)\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = toolCallRegex.exec(text)) !== null) {
    try {
      const toolCallJson = JSON.parse(match[1].trim());
      if (toolCallJson.name && typeof toolCallJson.name === 'string') {
        toolCalls.push({
          id: `tc_${Date.now()}_${toolCalls.length}`,
          name: toolCallJson.name,
          arguments: toolCallJson.arguments || {},
        });
        content = content.replace(match[0], '').trim();
      }
    } catch (e) {
      log('Failed to parse tool call JSON:', e);
    }
  }

  return { content, toolCalls };
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
        boatName: leg.boatName,
        startDate: leg.startDate,
        endDate: leg.endDate,
        departureLocation: leg.departureLocation,
        arrivalLocation: leg.arrivalLocation,
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
  log('=== Starting prospect chat ===');
  log('Message:', request.message?.substring(0, 100));

  const sessionId = request.sessionId || `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const preferences = request.gatheredPreferences || {};
  const history = request.conversationHistory || [];

  // Build system prompt
  const systemPrompt = buildProspectSystemPrompt(preferences);

  // Get available tools
  const tools = getProspectTools();
  const toolsDescription = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

  // Build tool prompt
  const toolPrompt = `
Available tools:
${toolsDescription}

To use a tool, respond with a JSON block like this:
\`\`\`tool_call
{"name": "tool_name", "arguments": {"arg1": "value1"}}
\`\`\`

After receiving tool results, provide your response using the [[leg:UUID:Name]] format for any legs you want to highlight.`;

  // Build messages
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt + '\n\n' + toolPrompt },
  ];

  // Add history (limited)
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current user message
  messages.push({ role: 'user', content: request.message });

  // Process with tools
  let allToolCalls: ProspectToolCall[] = [];
  let allLegRefs: ProspectLegReference[] = [];
  let currentMessages = [...messages];
  let iterations = 0;
  let finalContent = '';

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    log(`Tool iteration ${iterations}/${MAX_TOOL_ITERATIONS}`);

    // Call AI
    const result = await callAI({
      useCase: 'prospect-chat',
      prompt: currentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n'),
    });

    log('AI response received, length:', result.text.length);

    // Parse for tool calls
    const { content, toolCalls } = parseToolCalls(result.text);

    if (toolCalls.length === 0) {
      finalContent = content;
      break;
    }

    // Execute tools
    allToolCalls.push(...toolCalls);
    const toolResults = await executeProspectTools(supabase, toolCalls);

    // Extract leg references
    const newRefs = extractLegReferences(toolResults);
    allLegRefs.push(...newRefs);

    // Add tool results for next iteration
    const toolResultsText = toolResults.map(r => {
      if (r.error) return `Tool ${r.name} error: ${r.error}`;
      return `Tool ${r.name} result:\n${JSON.stringify(r.result, null, 2)}`;
    }).join('\n\n');

    currentMessages.push(
      { role: 'assistant', content: result.text },
      { role: 'user', content: `Tool results:\n${toolResultsText}\n\nPlease provide your response to the user.` }
    );
  }

  // Create response message
  const responseMessage: ProspectMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    content: finalContent,
    timestamp: new Date().toISOString(),
    metadata: {
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      legReferences: allLegRefs.length > 0 ? allLegRefs : undefined,
    },
  };

  log('=== Prospect chat complete ===');

  return {
    sessionId,
    message: responseMessage,
    extractedPreferences: undefined, // TODO: Extract preferences from conversation
  };
}
