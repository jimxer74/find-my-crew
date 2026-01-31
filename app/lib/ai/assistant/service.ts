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
} from './types';
import { getUserContext, buildSystemPrompt } from './context';
import { getToolsForUser, toolsToOpenAIFormat } from './tools';
import { executeTools } from './toolExecutor';

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 5;

/**
 * Main chat function - processes a message and returns AI response
 */
export async function chat(
  supabase: SupabaseClient,
  request: ChatRequest,
  options: AssistantOptions
): Promise<ChatResponse> {
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
  const userMessage = await saveMessage(supabase, conversationId, {
    role: 'user',
    content: request.message,
    metadata: {},
  });

  // Get user context
  const userContext = await getUserContext(supabase, userId);

  // Get conversation history
  const history = await getConversationHistory(supabase, conversationId, maxHistoryMessages);

  // Get available tools based on user roles
  const userRoles = userContext.profile?.roles || [];
  const tools = getToolsForUser(userRoles);

  // Build messages for AI
  const systemPrompt = buildSystemPrompt(userContext);
  const messages = buildAIMessages(systemPrompt, history);

  // Call AI with tool support
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

  // Save assistant message
  const assistantMessage = await saveMessage(supabase, conversationId, {
    role: 'assistant',
    content: aiResponse.content,
    metadata: {
      toolCalls: aiResponse.toolCalls,
      toolResults: aiResponse.toolResults,
    },
  });

  // Update conversation title if it's the first exchange
  if (history.length <= 1) {
    await updateConversationTitle(supabase, conversationId, request.message);
  }

  // Get any pending actions created during this chat
  const { data: pendingActions } = await supabase
    .from('ai_pending_actions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

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
  const allToolCalls: ToolCall[] = [];
  const allToolResults: ToolResult[] = [];
  let currentMessages = [...messages];
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    // Build prompt with tool instructions
    const toolsDescription = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    const toolPrompt = `
Available tools:
${toolsDescription}

To use a tool, respond with a JSON block like this:
\`\`\`tool_call
{"name": "tool_name", "arguments": {"arg1": "value1"}}
\`\`\`

You can make multiple tool calls in one response. After receiving tool results, provide your final response to the user.
`;

    // Add tool instructions to system message
    const messagesWithTools = [
      { role: 'system', content: currentMessages[0].content + '\n\n' + toolPrompt },
      ...currentMessages.slice(1),
    ];

    // Call AI
    const result = await callAI({
      useCase: 'assistant-chat',
      prompt: messagesWithTools.map(m => `${m.role}: ${m.content}`).join('\n\n'),
    });

    // Parse response for tool calls
    const { content, toolCalls } = parseToolCalls(result.text);

    if (toolCalls.length === 0) {
      // No tool calls, return final response
      return {
        content,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      };
    }

    // Execute tool calls
    allToolCalls.push(...toolCalls);
    const toolResults = await executeTools(toolCalls, {
      supabase,
      userId: context.userId,
      userRoles: context.userRoles,
      conversationId: context.conversationId,
    });
    allToolResults.push(...toolResults);

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
  }

  // Max iterations reached
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
  const toolCalls: ToolCall[] = [];
  let content = text;

  // Find tool call blocks
  const toolCallRegex = /```tool_call\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = toolCallRegex.exec(text)) !== null) {
    try {
      const toolCallJson = JSON.parse(match[1].trim());
      toolCalls.push({
        id: `tc_${Date.now()}_${toolCalls.length}`,
        name: toolCallJson.name,
        arguments: toolCallJson.arguments || {},
      });
      // Remove tool call from content
      content = content.replace(match[0], '').trim();
    } catch {
      // Invalid JSON, skip
    }
  }

  return { content, toolCalls };
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
