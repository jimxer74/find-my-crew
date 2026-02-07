/**
 * Enhanced AI Assistant Service
 *
 * Implements the new iterative approach with hybrid intent classification,
 * data sanitization, modular prompts, and dynamic tool selection.
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
  LegReference
} from './types';
import { getUserContext as getOriginalUserContext } from './context';
import { HybridUseCaseClassifier, UseCaseIntent, SanitizedUserContext } from './use-case-classification';
import { CrewDataSanitizer } from './data-sanitization';
import { ModularPromptBuilder } from './modular-prompts';
import { UseCaseToolRegistry, ToolPrioritizer } from './tool-registry';
import { getToolsForUser, toolsToOpenAIFormat } from './tools';
import { executeTools } from './toolExecutor';

const MAX_HISTORY_MESSAGES = 20;
const MAX_LEG_REFERENCES = 6;
const MAX_TOOL_ITERATIONS = 5;

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Enhanced AI Assistant Service] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Enhanced chat function with iterative approach
 */
export async function enhancedChat(
  supabase: SupabaseClient,
  request: ChatRequest,
  options: AssistantOptions
): Promise<ChatResponse> {
  log('=== Starting enhanced chat ===');

  const { userId, maxHistoryMessages = MAX_HISTORY_MESSAGES } = options;
  let { conversationId } = options;

  // Phase 0: Data Sanitization (Before Processing)
  const sanitizedUserMessage = sanitizeUserMessage(request.message);
  log('Sanitized user message:', sanitizedUserMessage.substring(0, 100) + (sanitizedUserMessage.length > 100 ? '...' : ''));

  // Phase 1: Intent Classification (Hybrid Approach)
  log('Starting intent classification...');
  const intent = await classifyUserIntent(sanitizedUserMessage);
  log('Classified intent:', intent);

  // Phase 2: Context Building (Focused and Sanitized)
  log('Building user context...');
  const context = await getOriginalUserContext(supabase, userId);
  const focusedContext = filterContextForUseCase(context, intent);
  const sanitizedContext = sanitizeUserContext(focusedContext, intent);
  log('Context built and sanitized:', {
    intent,
    hasProfile: !!sanitizedContext.profile,
    roles: sanitizedContext.profile?.roles,
    focusedFields: Object.keys(sanitizedContext).filter(k => (sanitizedContext as any)[k])
  });

  // Phase 3: Prompt Building (Modular)
  log('Building modular prompt...');
  const systemPrompt = buildModularPrompt(intent, sanitizedContext);
  log('Modular prompt built:', systemPrompt.substring(0, 200) + '...');

  // Phase 4: Tool Selection (Dynamic)
  log('Selecting tools dynamically...');
  const userRoles = sanitizedContext.profile?.roles || [];
  const allTools = getToolsForUseCase(intent, userRoles);
  const prioritizedTools = prioritizeTools(allTools, {
    userMessage: sanitizedUserMessage,
    intent,
    userContext: sanitizedContext
  });
  log('Tools selected and prioritized:', prioritizedTools.map(t => t.name));

  // Phase 5: AI Processing (Focused)
  log('Processing AI with focused tools...');
  const history = await getConversationHistory(supabase, conversationId || request.conversationId || '', maxHistoryMessages);
  const messages = buildAIMessages(systemPrompt, history);

  const aiResponse = await processAIWithTools(supabase, messages, prioritizedTools, {
    userId,
    userRoles,
    conversationId: conversationId || request.conversationId || ''
  });
  log('AI response received:', {
    contentLength: aiResponse.content.length,
    toolCallCount: aiResponse.toolCalls?.length || 0,
    toolResultCount: aiResponse.toolResults?.length || 0,
  });

  // Phase 6: Response Generation (Use-Case Specific Formatting)
  log('Formatting response for use case...');
  const formattedResponse = formatResponseForUseCase(aiResponse, intent);
  log('Response formatted, length:', formattedResponse.length);

  // Phase 7: Response Sanitization (Before Returning)
  log('Sanitizing final response...');
  const sanitizedResponse = sanitizeAiResponse(formattedResponse);
  log('Final response sanitized:', sanitizedResponse.substring(0, 200) + (sanitizedResponse.length > 200 ? '...' : ''));

  // Phase 8: Save and Return
  log('Saving response and returning...');
  return saveAndReturnResponse(supabase, sanitizedResponse, options, sanitizedUserMessage);
}

/**
 * Sanitize user message content
 */
function sanitizeUserMessage(message: string): string {
  // Basic PII removal patterns
  let sanitized = message;
  const piiPatterns = [
    /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g,
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
  ];

  for (const pattern of piiPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Classify user intent using hybrid approach
 */
async function classifyUserIntent(message: string): Promise<UseCaseIntent> {
  // For now, use synchronous classification for performance
  // In a real implementation, this would use the HybridUseCaseClassifier
  const normalized = message.toLowerCase();

  // Fast pattern matching for crew use cases
  if (normalized.includes('find') || normalized.includes('search') || normalized.includes('look for')) {
    if (normalized.includes('trip') || normalized.includes('sail') || normalized.includes('leg')) {
      return UseCaseIntent.CREW_SEARCH_SAILING_TRIPS;
    }
  }

  if (normalized.includes('improve') || normalized.includes('update') || normalized.includes('enhance')) {
    if (normalized.includes('profile') || normalized.includes('skill') || normalized.includes('certification')) {
      return UseCaseIntent.CREW_IMPROVE_PROFILE;
    }
  }

  if (normalized.includes('register') || normalized.includes('join') || normalized.includes('apply')) {
    if (normalized.includes('leg') || normalized.includes('trip') || normalized.includes('crew')) {
      return UseCaseIntent.CREW_REGISTER;
    }
  }

  return UseCaseIntent.GENERAL_CONVERSATION;
}

/**
 * Filter context for specific use case
 */
function filterContextForUseCase(context: UserContext, intent: UseCaseIntent): UserContext {
  switch (intent) {
    case UseCaseIntent.CREW_SEARCH_SAILING_TRIPS:
      return {
        ...context,
        boats: [], // Not relevant for crew searching
        recentRegistrations: context.recentRegistrations?.slice(0, 3) || [] // Limit recent crew applications
      };
    case UseCaseIntent.CREW_IMPROVE_PROFILE:
      return {
        ...context,
        boats: [], // Not relevant for crew profile improvement
        recentRegistrations: [] // Not relevant for profile improvement
      };
    case UseCaseIntent.CREW_REGISTER:
      return {
        ...context,
        boats: [], // Not relevant for crew registration
        recentRegistrations: context.recentRegistrations?.slice(0, 5) || [] // Recent crew activity
      };
    default:
      return context;
  }
}

/**
 * Sanitize user context to remove PII
 */
function sanitizeUserContext(context: UserContext, intent: UseCaseIntent): SanitizedUserContext {
  const sanitized = JSON.parse(JSON.stringify(context));

  // Remove sensitive fields
  const sensitiveFields = ['username', 'fullName', 'email', 'phone', 'address'];
  for (const field of sensitiveFields) {
    if (sanitized.profile && sanitized.profile.hasOwnProperty(field)) {
      delete sanitized.profile[field];
    }
  }

  return sanitized;
}

/**
 * Build modular prompt for specific use case
 */
function buildModularPrompt(intent: UseCaseIntent, context: SanitizedUserContext): string {
  const promptBuilder = new ModularPromptBuilder();
  return promptBuilder.buildPrompt(intent, context);
}

/**
 * Get tools for specific use case
 */
function getToolsForUseCase(intent: UseCaseIntent, userRoles: string[]): any[] {
  const toolRegistry = new UseCaseToolRegistry();
  return toolRegistry.getToolsForUseCase(intent, userRoles);
}

/**
 * Prioritize tools based on relevance
 */
function prioritizeTools(tools: any[], context: any): any[] {
  const prioritizer = new ToolPrioritizer();
  return prioritizer.prioritizeTools(tools, context);
}

/**
 * Format response for specific use case
 */
function formatResponseForUseCase(response: any, intent: UseCaseIntent): string {
  // Use case-specific response formatting
  let content = response.content;

  // Add use case specific formatting
  switch (intent) {
    case UseCaseIntent.CREW_SEARCH_SAILING_TRIPS:
      // Ensure leg references are properly formatted
      content = content.replace(/leg:\s*([a-z0-9-]+)/gi, 'leg:$1');
      break;
    case UseCaseIntent.CREW_IMPROVE_PROFILE:
      // Ensure suggestion formatting is correct
      content = content.replace(/\[\[suggest:(.*?)\]\]/g, '[[suggest:$1]]');
      break;
    case UseCaseIntent.CREW_REGISTER:
      // Ensure registration links are properly formatted
      content = content.replace(/\[\[register:(.*?)\]\]/g, '[[register:$1]]');
      break;
  }

  return content;
}

/**
 * Sanitize AI response to prevent PII leakage
 */
function sanitizeAiResponse(response: string): string {
  // Remove any potential PII from AI responses
  let sanitized = response;
  const piiPatterns = [
    /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g,
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
  ];

  for (const pattern of piiPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED_EMAIL]');
  }

  return sanitized;
}

/**
 * Save and return response
 */
async function saveAndReturnResponse(
  supabase: SupabaseClient,
  responseContent: string,
  options: AssistantOptions,
  originalMessage: string
): Promise<ChatResponse> {
  // Get or create conversation
  let conversationId = options.conversationId;
  if (!conversationId) {
    const conversation = await createConversation(supabase, options.userId);
    conversationId = conversation.id;
  }

  // Save user message
  const userMessage = await saveMessage(supabase, conversationId, {
    role: 'user',
    content: originalMessage,
    metadata: {},
  });

  // Save assistant message
  const assistantMessage = await saveMessage(supabase, conversationId, {
    role: 'assistant',
    content: responseContent,
    metadata: {},
  });

  // Get any pending actions
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

/**
 * Process AI call with tool support
 */
async function processAIWithTools(
  supabase: SupabaseClient,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
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
  // Build prompt with tool instructions
  const toolsDescription = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
  const toolPrompt = `
Available tools:
${toolsDescription}

To use a tool, respond with a JSON block like this:
\`\`\`tool_call
{"name": "tool_name", "arguments": {"arg1": "value1"}}
\`\`\`
`;

  // Add tool instructions to system message
  const messagesWithTools = [
    { role: 'system', content: messages[0].content + '\n\n' + toolPrompt },
    ...messages.slice(1),
  ];

  // Call AI
  const result = await callAI({
    useCase: 'assistant-chat',
    prompt: messagesWithTools.map(m => `${m.role}: ${m.content}`).join('\n\n'),
  });

  // Parse response for tool calls
  const { content, toolCalls } = parseToolCalls(result.text);

  if (toolCalls.length === 0) {
    return { content };
  }

  // Execute tool calls
  const toolResults = await executeTools(toolCalls, {
    supabase,
    userId: context.userId,
    userRoles: context.userRoles,
    conversationId: context.conversationId,
  });

  return { content, toolCalls, toolResults };
}

/**
 * Parse tool calls from AI response
 */
function parseToolCalls(text: string): { content: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];
  let content = text;

  // Method 1: Find tool call blocks with code block format
  const codeBlockRegex = /```(?:tool_calls?|tool_code|json)\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    try {
      const toolCallJson = JSON.parse(match[1].trim());
      if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
        continue;
      }
      const toolCall = {
        id: `tc_${Date.now()}_${toolCalls.length}`,
        name: toolCallJson.name,
        arguments: toolCallJson.arguments || {},
      };
      toolCalls.push(toolCall);
      content = content.replace(match[0], '').trim();
    } catch (e) {
      // Skip invalid JSON
    }
  }

  // Method 2: Find tool call blocks with <|tool_calls_start|> and <|tool_calls_end|> delimiters
  const delimiterRegex = /<\|tool_calls_start\|>([\s\S]*?)<\|tool_calls_end\|>/g;
  let delimiterMatch;

  while ((delimiterMatch = delimiterRegex.exec(text)) !== null) {
    try {
      const toolCallJson = JSON.parse(delimiterMatch[1].trim());
      if (!toolCallJson.name || typeof toolCallJson.name !== 'string') {
        continue;
      }
      const toolCall = {
        id: `tc_${Date.now()}_${toolCalls.length}`,
        name: toolCallJson.name,
        arguments: toolCallJson.arguments || {},
      };
      toolCalls.push(toolCall);
      content = content.replace(delimiterMatch[0], '').trim();
    } catch (e) {
      // Skip invalid JSON
    }
  }

  return { content, toolCalls };
}

/**
 * Extract leg references from tool results
 */
function extractLegReferences(toolResults: ToolResult[]): LegReference[] {
  const refs: LegReference[] = [];
  const seenIds = new Set<string>();

  for (const result of toolResults) {
    if (result.name !== 'search_legs' && result.name !== 'search_legs_by_location') {
      continue;
    }

    if (result.error || !result.result) {
      continue;
    }

    const data = result.result as { legs?: any[] };
    if (!data?.legs || !Array.isArray(data.legs)) {
      continue;
    }

    for (const leg of data.legs) {
      if (!leg.id || seenIds.has(leg.id)) {
        continue;
      }
      seenIds.add(leg.id);

      const ref: LegReference = {
        id: leg.id,
        name: leg.name || 'Unnamed leg',
      };

      if (leg.journeys?.boats?.name) {
        ref.boatName = leg.journeys.boats.name;
      }

      refs.push(ref);

      if (refs.length >= MAX_LEG_REFERENCES) {
        return refs;
      }
    }
  }

  return refs;
}

// ============================================================================
// Database Operations (from original service)
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