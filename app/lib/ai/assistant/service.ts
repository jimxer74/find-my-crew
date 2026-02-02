/**
 * AI Assistant Service
 *
 * Main service that orchestrates AI conversations, tool calling, and responses.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { callAI } from '../service';
import {
  AIConversation,
  AIMessage,
  ChatRequest,
  ChatResponse,
  AssistantOptions,
  ToolCall,
  ToolResult,
  UserContext,
  LegReference,
} from './types';
import { getUserContext, buildSystemPrompt } from './context';
import { getToolsForUser, toolsToOpenAIFormat } from './tools';
import { executeTools } from './toolExecutor';

const MAX_HISTORY_MESSAGES = 20;
const MAX_LEG_REFERENCES = 6; // Limit displayed leg links to avoid clutter
/**
 * Maximum number of tool iterations
 * This is the maximum number of times the AI will try to use tools to complete the user's request
 * Set to 5 to allow recovery from format mistakes on first attempts
 */
const MAX_TOOL_ITERATIONS = 5;

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[AI Assistant Service] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Main chat function - processes a message and returns AI response
 */
export async function chat(
  supabase: SupabaseClient,
  request: ChatRequest,
  options: AssistantOptions
): Promise<ChatResponse> {
  log('=== Starting chat ===');
  log('Request message:', request.message?.substring(0, 100) + (request.message?.length > 100 ? '...' : ''));
  log('Options:', { userId: options.userId, conversationId: options.conversationId });

  const { userId, maxHistoryMessages = MAX_HISTORY_MESSAGES } = options;
  let { conversationId } = options;

  // Check AI consent
  log('Checking AI consent...');
  const { data: consents } = await supabase
    .from('user_consents')
    .select('ai_processing_consent')
    .eq('user_id', userId)
    .single();

  if (!consents?.ai_processing_consent) {
    log('AI consent not granted!');
    throw new Error('AI processing consent not granted. Please enable AI features in your settings.');
  }
  log('AI consent verified');

  // Get or create conversation
  if (!conversationId && !request.conversationId) {
    log('Creating new conversation...');
    const conversation = await createConversation(supabase, userId);
    conversationId = conversation.id;
    log('New conversation created:', conversationId);
  } else {
    conversationId = conversationId || request.conversationId!;
    log('Using existing conversation:', conversationId);
  }

  // Save user message
  log('Saving user message...');
  const userMessage = await saveMessage(supabase, conversationId, {
    role: 'user',
    content: request.message,
    metadata: {},
  });
  log('User message saved:', userMessage.id);

  // Get user context
  log('Building user context...');
  const userContext = await getUserContext(supabase, userId);
  log('User context built:', {
    hasProfile: !!userContext.profile,
    roles: userContext.profile?.roles,
    boatCount: userContext.boats?.length,
    registrationCount: userContext.recentRegistrations?.length,
  });

  // Get conversation history
  log('Loading conversation history...');
  const history = await getConversationHistory(supabase, conversationId, maxHistoryMessages);
  log('History loaded:', { messageCount: history.length });

  // Get available tools based on user roles
  const userRoles = userContext.profile?.roles || [];
  const tools = getToolsForUser(userRoles);
  log('Available tools:', tools.map(t => t.name));

  // Build messages for AI
  const systemPrompt = buildSystemPrompt(userContext);
  const messages = buildAIMessages(systemPrompt, history);
  log('Built AI messages:', { totalMessages: messages.length });

  // Call AI with tool support
  log('Processing AI with tools...');
  const aiResponse = await processAIWithTools(
    supabase,
    messages,
    tools,
    {
      userId,
      userRoles,
      conversationId,
    }
  );
  log('AI response received:', {
    contentLength: aiResponse.content.length,
    toolCallCount: aiResponse.toolCalls?.length || 0,
    toolResultCount: aiResponse.toolResults?.length || 0,
  });

  // Extract leg references from tool results
  const legReferences = extractLegReferences(aiResponse.toolResults || []);
  log('Extracted leg references:', legReferences.length);

  // Save assistant message
  log('Saving assistant message...');
  const assistantMessage = await saveMessage(supabase, conversationId, {
    role: 'assistant',
    content: aiResponse.content,
    metadata: {
      toolCalls: aiResponse.toolCalls,
      toolResults: aiResponse.toolResults,
      legReferences: legReferences.length > 0 ? legReferences : undefined,
    },
  });
  log('Assistant message saved:', assistantMessage.id);

  // Update conversation title if it's the first exchange
  if (history.length <= 1) {
    log('Updating conversation title...');
    await updateConversationTitle(supabase, conversationId, request.message);
  }

  // Get any pending actions created during this chat
  log('Checking for pending actions...');
  const { data: pendingActions } = await supabase
    .from('ai_pending_actions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  log('Pending actions:', pendingActions?.length || 0);

  log('=== Chat complete ===');
  return {
    conversationId,
    message: assistantMessage,
    pendingActions: pendingActions || undefined,
  };
}

/**
 * Process AI call with tool support
 */
async function processAIWithTools(
  supabase: SupabaseClient,
  messages: Array<{ role: string; content: string }>,
  tools: ReturnType<typeof getToolsForUser>,
  context: {
    userId: string;
    userRoles: string[];
    conversationId: string;
  }
): Promise<{
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}> {
  log('--- processAIWithTools started ---');
  const allToolCalls: ToolCall[] = [];
  const allToolResults: ToolResult[] = [];
  let currentMessages = [...messages];
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    log(`Tool iteration ${iterations}/${MAX_TOOL_ITERATIONS}`);


    // Build prompt with tool instructions
    const toolsDescription = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    const toolPrompt = `
Available tools:
${toolsDescription}

To use a tool, respond with a JSON block like this:
\`\`\`tool_call
{"name": "tool_name", "arguments": {"arg1": "value1"}}
\`\`\`

CRITICAL RULES FOR TOOL CALLS:
1. Action tools (suggest_register_for_leg, suggest_profile_update, etc.) ALWAYS require BOTH the action parameter AND a "reason" parameter
2. The "reason" parameter must be a non-empty string explaining why you're making this suggestion
3. Never omit required parameters - missing parameters will cause the tool to fail

You can make multiple tool calls, but try limit it to one or two if possible. After receiving tool results, provide your final response to the user.
`;

    // Add tool instructions to system message
    const messagesWithTools = [
      { role: 'system', content: currentMessages[0].content + '\n\n' + toolPrompt },
      ...currentMessages.slice(1),
    ];

    // Call AI
    log('Calling AI service...', { prompt: toolPrompt });
    log('Messages with tools:', {message: messagesWithTools});

    const result = await callAI({
      useCase: 'assistant-chat',
      prompt: messagesWithTools.map(m => `${m.role}: ${m.content}`).join('\n\n'),
    });
    log('AI response received, length:', result.text.length);
    log('AI raw response preview:', result.text.substring(0, 500) + (result.text.length > 500 ? '...' : ''));

    // Parse response for tool calls
    const { content, toolCalls } = parseToolCalls(result.text);
    log('Parsed response:', { contentLength: content.length, toolCallCount: toolCalls.length });

    if (toolCalls.length === 0) {
      log('No tool calls found, returning final response');
      // No tool calls, return final response
      return {
        content,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      };
    }

    // Execute tool calls
    log('Tool calls found:', toolCalls.map(tc => tc.name));
    allToolCalls.push(...toolCalls);
    log('Executing tools...');
    const toolResults = await executeTools(toolCalls, {
      supabase,
      userId: context.userId,
      userRoles: context.userRoles,
      conversationId: context.conversationId,
    });
    allToolResults.push(...toolResults);
    log('Tool execution complete:', toolResults.map(r => ({ name: r.name, hasError: !!r.error })));

    // Add tool results to messages for next iteration
    const toolResultsText = toolResults.map(r => {
      if (r.error) {
        return `Tool ${r.name} error: ${r.error}`;
      }
      return `Tool ${r.name} result:\n${JSON.stringify(r.result, null, 2)}`;
    }).join('\n\n');

    currentMessages.push(
      { role: 'assistant', content: result.text },
      { role: 'user', content: `Tool results:\n${toolResultsText}\n\nPlease provide your response to the user based on these results.` }
    );
    log('Added tool results to messages, continuing iteration...');
  }

  // Max iterations reached
  log('Max iterations reached! Returning fallback response.');
  return {
    content: "I apologize, but I wasn't able to complete your request. Please try again or rephrase your question.",
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    toolResults: allToolResults.length > 0 ? allToolResults : undefined,
  };
}

/**
 * Parse tool calls from AI response
 */
function parseToolCalls(text: string): { content: string; toolCalls: ToolCall[] } {
  log('Parsing tool calls from response...');
  const toolCalls: ToolCall[] = [];
  let content = text;

  // Find tool call blocks (accept variations: tool_call, tool_calls, tool_code, json)
  const toolCallRegex = /```(?:tool_calls?|tool_code|json)\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = toolCallRegex.exec(text)) !== null) {
    log('Found tool call block:', match[1].trim().substring(0, 200));
    try {
      const toolCallJson = JSON.parse(match[1].trim());
      // Validate this is actually a tool call (must have name field)
      if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
        log('Skipping JSON block - no valid "name" field');
        continue;
      }
      const toolCall = {
        id: `tc_${Date.now()}_${toolCalls.length}`,
        name: toolCallJson.name,
        arguments: toolCallJson.arguments || {},
      };
      toolCalls.push(toolCall);
      log('Parsed tool call:', { name: toolCall.name, args: toolCall.arguments });
      // Remove tool call from content
      content = content.replace(match[0], '').trim();
    } catch (e) {
      log('Failed to parse tool call JSON:', e);
      // Invalid JSON, skip
    }
  }

  log(`Parsing complete: ${toolCalls.length} tool calls found`);
  return { content, toolCalls };
}

/**
 * Extract leg references from tool results
 * Looks for legs returned by search_legs and search_legs_by_location tools
 */
function extractLegReferences(toolResults: ToolResult[]): LegReference[] {
  const refs: LegReference[] = [];
  const seenIds = new Set<string>();

  for (const result of toolResults) {
    // Only process leg search tools
    if (result.name !== 'search_legs' && result.name !== 'search_legs_by_location') {
      continue;
    }

    // Skip if there was an error
    if (result.error || !result.result) {
      continue;
    }

    const data = result.result as { legs?: any[] };
    if (!data?.legs || !Array.isArray(data.legs)) {
      continue;
    }

    for (const leg of data.legs) {
      // Skip if we've already seen this leg
      if (!leg.id || seenIds.has(leg.id)) {
        continue;
      }
      seenIds.add(leg.id);

      const ref: LegReference = {
        id: leg.id,
        name: leg.name || 'Unnamed leg',
      };

      // Extract boat name from journeys relationship
      if (leg.journeys?.boats?.name) {
        ref.boatName = leg.journeys.boats.name;
      }

      refs.push(ref);

      // Limit the number of references to avoid clutter
      if (refs.length >= MAX_LEG_REFERENCES) {
        log(`Reached max leg references limit (${MAX_LEG_REFERENCES})`);
        return refs;
      }
    }
  }

  return refs;
}

/**
 * Build messages array for AI
 */
function buildAIMessages(
  systemPrompt: string,
  history: AIMessage[]
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of history) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return messages;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create a new conversation
 */
export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  title?: string
): Promise<AIConversation> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: userId,
      title: title || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get conversation by ID
 */
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

/**
 * List user's conversations
 */
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

/**
 * Delete a conversation
 */
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

/**
 * Get conversation history
 */
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

/**
 * Save a message to the database
 */
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

  // Update conversation updated_at
  await supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
}

/**
 * Update conversation title
 */
async function updateConversationTitle(
  supabase: SupabaseClient,
  conversationId: string,
  firstMessage: string
): Promise<void> {
  // Generate title from first message (truncate to 50 chars)
  let title = firstMessage.slice(0, 50);
  if (firstMessage.length > 50) {
    title += '...';
  }

  await supabase
    .from('ai_conversations')
    .update({ title })
    .eq('id', conversationId);
}
