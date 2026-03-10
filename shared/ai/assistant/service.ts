/**
 * AI Assistant Service
 *
 * Conversational AI chat service. Uses shared tool parsing utilities (same
 * pattern as owner-v2). No intent classification — the AI decides what to
 * do based on the system prompt and available tools.
 */

import { logger } from '@shared/logging';
import { SupabaseClient } from '@supabase/supabase-js';
import { callAI } from '../service';
import {
  parseToolCalls,
  formatToolResultsForAI,
  sanitizeContent,
  getToolsForUser,
  type ToolDefinition,
} from '../shared';
import {
  AIConversation,
  AIMessage,
  ChatRequest,
  ChatResponse,
  AssistantOptions,
  ToolCall,
  ToolResult,
  LegReference,
} from './types';
import { getUserContext, buildSystemPrompt } from './context';
import { executeTools } from './toolExecutor';

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 6;
const MAX_LEG_REFERENCES = 6;

/**
 * Format tools for the system prompt — shows each tool with description,
 * required params, and a concrete call example so the AI learns the format.
 */
function formatToolsForPrompt(tools: ToolDefinition[]): string {
  return tools.map((t) => {
    const required = t.parameters.required || [];
    const props = t.parameters.properties as Record<string, { type: string; description: string; enum?: string[] }>;

    // Build an example arguments object using required fields + first optional
    const exampleArgs: Record<string, string> = {};
    for (const key of required) {
      const prop = props[key];
      if (prop?.type === 'string') exampleArgs[key] = `"<${key}>"`;
      else if (prop?.type === 'number') exampleArgs[key] = `0`;
      else if (prop?.type === 'boolean') exampleArgs[key] = `true`;
      else exampleArgs[key] = `"<${key}>"`;
    }

    const paramLines = Object.entries(props)
      .map(([k, v]) => {
        const req = required.includes(k) ? ' (required)' : ' (optional)';
        const enumNote = v.enum ? ` — one of: ${v.enum.join(', ')}` : '';
        return `  - ${k} [${v.type}]${req}: ${v.description}${enumNote}`;
      })
      .join('\n');

    const exampleArgsStr = Object.entries(exampleArgs)
      .map(([k, v]) => `"${k}": ${v}`)
      .join(', ');

    return `**${t.name}**: ${t.description}
Parameters:
${paramLines}
Example call:
\`\`\`tool_call
{"name": "${t.name}", "arguments": {${exampleArgsStr}}}
\`\`\``;
  }).join('\n\n');
}

const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[AI Assistant Service] ${message}`, data !== undefined ? (data as Record<string, any>) : undefined);
  }
};

const TOOL_CALL_FORMAT = `
## TOOL CALL FORMAT (CRITICAL)

To call a tool, use a \`\`\`tool_call code block containing a JSON object with exactly two keys:
- \`"name"\` — the tool name (string)
- \`"arguments"\` — an object containing the tool parameters

**CORRECT format:**
\`\`\`tool_call
{"name": "get_boat_management_summary", "arguments": {"boatId": "ae779227-75d3-4af2-a4d8-75aa460e61de"}}
\`\`\`

**WRONG — missing "name" and "arguments" wrapper:**
\`\`\`tool_call
{"boatId": "ae779227-75d3-4af2-a4d8-75aa460e61de"}
\`\`\`

**WRONG — parameters at top level without wrapper:**
\`\`\`tool_call
{"name": "get_boat_management_summary", "boatId": "ae779227-75d3-4af2-a4d8-75aa460e61de"}
\`\`\`

Rules:
- ALWAYS include both \`"name"\` and \`"arguments"\` keys
- Put ALL parameters inside the \`"arguments"\` object, never at the top level
- One tool call per code block
- Use complete valid JSON — no comments, no placeholders
`;

/**
 * Main chat function — processes a message and returns AI response
 */
export async function chat(
  supabase: SupabaseClient,
  request: ChatRequest,
  options: AssistantOptions
): Promise<ChatResponse> {
  log('=== Starting chat ===');

  const { userId, maxHistoryMessages = MAX_HISTORY_MESSAGES } = options;
  let { conversationId } = options;

  // Check AI consent
  const { data: consents } = await supabase
    .from('user_consents')
    .select('ai_processing_consent')
    .eq('user_id', userId)
    .single();

  if (!consents?.ai_processing_consent) {
    throw new Error('AI processing consent not granted. Please enable AI features in your settings.');
  }

  // Get or create conversation
  if (!conversationId && !request.conversationId) {
    const conversation = await createConversation(supabase, userId);
    conversationId = conversation.id;
  } else {
    conversationId = conversationId || request.conversationId!;
  }

  // Save user message
  await saveMessage(supabase, conversationId, {
    role: 'user',
    content: request.message,
    metadata: {},
  });

  // Get user context and roles
  const userContext = await getUserContext(supabase, userId);
  const userRoles = userContext.profile?.roles || [];
  log('User roles:', userRoles);

  // Get conversation history
  const history = await getConversationHistory(supabase, conversationId, maxHistoryMessages);

  // Get tools available for this user's roles
  const tools = getToolsForUser(userRoles);
  log('Available tools:', tools.map((t) => t.name));

  // Build system prompt with user context + tool list
  const systemPrompt =
    buildSystemPrompt(userContext) +
    '\n\n## AVAILABLE TOOLS\n\n' +
    formatToolsForPrompt(tools) +
    TOOL_CALL_FORMAT;

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: request.message },
  ];

  // Run AI with tool loop
  const allToolCalls: ToolCall[] = [];
  const allToolResults: ToolResult[] = [];
  let finalContent = '';
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    log(`Tool iteration ${iterations}/${MAX_TOOL_ITERATIONS}`);

    const result = await callAI({
      useCase: 'assistant-chat',
      prompt: messages.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
    });

    const { content, toolCalls } = parseToolCalls(result.text);

    if (toolCalls.length === 0) {
      finalContent = sanitizeContent(content, false);
      log('No tool calls, final response length:', finalContent.length);
      break;
    }

    log('Tool calls:', toolCalls.map((tc) => tc.name));
    allToolCalls.push(...toolCalls);

    const toolResults = await executeTools(toolCalls, {
      supabase,
      userId,
      userRoles,
      conversationId,
    });
    allToolResults.push(...toolResults);

    const toolResultsText = formatToolResultsForAI(
      toolResults.map((r) => ({ name: r.name, result: r.result, error: r.error }))
    );

    const hasErrors = toolResults.some((r) => r.error || (r.result && typeof r.result === 'object' && 'error' in (r.result as object)));
    const followUp = hasErrors
      ? `Tool results:\n${toolResultsText}\n\nSome tools returned errors. If an error says to call get_maintenance_tasks first, do that now to get real task UUIDs, then retry the action with the correct UUIDs. Do NOT give up — complete the task.`
      : `Tool results:\n${toolResultsText}\n\nPlease provide your response to the user based on these results.`;

    messages.push(
      { role: 'assistant', content: result.text },
      { role: 'user', content: followUp }
    );
  }

  if (iterations >= MAX_TOOL_ITERATIONS && !finalContent) {
    finalContent = "I wasn't able to complete your request. Please try rephrasing your question.";
  }

  // Extract leg references from tool results for UI card display
  const legReferences = extractLegReferencesFromToolResults(allToolResults);

  // Save assistant message
  const assistantMessage = await saveMessage(supabase, conversationId, {
    role: 'assistant',
    content: finalContent,
    metadata: {
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      legReferences: legReferences.length > 0 ? legReferences : undefined,
    },
  });

  // Update conversation title on first exchange
  if (history.length <= 1) {
    await updateConversationTitle(supabase, conversationId, request.message);
  }

  // Return pending actions created during this chat
  const { data: pendingActions } = await supabase
    .from('ai_pending_actions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  log('=== Chat complete ===');
  return {
    conversationId,
    message: assistantMessage,
    pendingActions: pendingActions || undefined,
  };
}

/**
 * Extract leg references from search tool results for UI display
 */
function extractLegReferencesFromToolResults(toolResults: ToolResult[]): LegReference[] {
  const refs: LegReference[] = [];
  const seenIds = new Set<string>();

  for (const result of toolResults) {
    if (result.name !== 'search_legs' && result.name !== 'search_legs_by_location') continue;
    if (result.error || !result.result) continue;

    const data = result.result as { legs?: any[] };
    if (!Array.isArray(data?.legs)) continue;

    for (const leg of data.legs) {
      if (!leg.id || seenIds.has(leg.id)) continue;
      seenIds.add(leg.id);

      const journey = leg.journeys;
      refs.push({
        id: leg.id,
        name: leg.name || 'Unnamed leg',
        journeyId: journey?.id,
        journeyName: journey?.name,
        boatName: journey?.boats?.name,
        startDate: leg.start_date,
        endDate: leg.end_date,
        departureLocation: leg.start_location,
        arrivalLocation: leg.end_location,
        journeyImages: Array.isArray(journey?.images) ? journey.images : undefined,
        boatImages: Array.isArray(journey?.boats?.images) ? journey.boats.images : undefined,
      });

      if (refs.length >= MAX_LEG_REFERENCES) return refs;
    }
  }

  return refs;
}

// ============================================================================
// Database Operations
// ============================================================================

export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  title?: string
): Promise<AIConversation> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: userId, title: title || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<AIConversation | null> {
  const { data } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();
  return data;
}

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 20
): Promise<AIConversation[]> {
  const { data } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function deleteConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);
  return !error;
}

export async function getConversationHistory(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number = MAX_HISTORY_MESSAGES
): Promise<AIMessage[]> {
  const { data } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return data || [];
}

async function saveMessage(
  supabase: SupabaseClient,
  conversationId: string,
  message: Omit<AIMessage, 'id' | 'conversation_id' | 'created_at'>
): Promise<AIMessage> {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
}

async function updateConversationTitle(
  supabase: SupabaseClient,
  conversationId: string,
  firstMessage: string
): Promise<void> {
  const title = firstMessage.length > 50 ? firstMessage.slice(0, 50) + '...' : firstMessage;
  await supabase
    .from('ai_conversations')
    .update({ title })
    .eq('id', conversationId);
}
