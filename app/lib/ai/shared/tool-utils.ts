/**
 * Shared AI Tool Utilities
 *
 * Common utilities for parsing and handling AI tool calls across different
 * AI chat implementations (assistant, prospect, etc.)
 */

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[AI Tool Utils] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Common tool call structure
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

/**
 * Parse tool calls from AI response
 *
 * Handles multiple formats:
 * 1. JSON in code blocks: ```tool_call {"name": "...", "arguments": {...}} ```
 * 2. XML-like format: <tool_call><function=name>...</function></tool_call>
 * 3. Delimiter format: <|tool_calls_start|>...<|tool_calls_end|>
 * 4. Simple function format: <function=name>...</function>
 */
export function parseToolCalls(text: string): { content: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];
  let content = text;
  let toolCallIndex = 0;

  // Method 1: JSON in code blocks (```tool_call or ```json)
  const jsonBlockRegex = /```(?:tool_calls?|tool_code|json)\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      let jsonStr = match[1].trim();

      // Try to parse as-is first
      let toolCallJson: any;
      try {
        toolCallJson = JSON.parse(jsonStr);
      } catch {
        // Try to fix truncated JSON
        toolCallJson = tryFixAndParseJson(jsonStr);
      }

      if (toolCallJson && toolCallJson.name && typeof toolCallJson.name === 'string') {
        toolCalls.push({
          id: `tc_${Date.now()}_${toolCallIndex++}`,
          name: toolCallJson.name,
          arguments: toolCallJson.arguments || {},
        });
        content = content.replace(match[0], '').trim();
        log('Parsed JSON tool call:', toolCallJson.name);
      }
    } catch (e) {
      log('Failed to parse JSON tool call block');
    }
  }

  // Method 2: XML-like format <tool_call><function=name>...</function></tool_call>
  const xmlToolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;

  while ((match = xmlToolCallRegex.exec(text)) !== null) {
    const parsed = parseXmlFunctionCall(match[1]);
    if (parsed) {
      toolCalls.push({
        id: `tc_${Date.now()}_${toolCallIndex++}`,
        ...parsed,
      });
      content = content.replace(match[0], '').trim();
      log('Parsed XML tool_call:', parsed.name);
    }
  }

  // Method 3: Delimiter format <|tool_calls_start|>...<|tool_calls_end|>
  const delimiterRegex = /<\|tool_calls_start\|>([\s\S]*?)<\|tool_calls_end\|>/g;

  while ((match = delimiterRegex.exec(text)) !== null) {
    try {
      const jsonContent = extractJsonFromText(match[1]);
      if (jsonContent) {
        const toolCallJson = JSON.parse(jsonContent);
        if (toolCallJson.name && typeof toolCallJson.name === 'string') {
          toolCalls.push({
            id: `tc_${Date.now()}_${toolCallIndex++}`,
            name: toolCallJson.name,
            arguments: toolCallJson.arguments || {},
          });
          content = content.replace(match[0], '').trim();
          log('Parsed delimiter tool call:', toolCallJson.name);
        }
      }
    } catch (e) {
      log('Failed to parse delimiter tool call');
    }
  }

  // Method 4: Simple function format <function=name>...</function> (without tool_call wrapper)
  const simpleFunctionRegex = /<function=(\w+)>([\s\S]*?)<\/function>/gi;

  while ((match = simpleFunctionRegex.exec(text)) !== null) {
    // Skip if already removed from content
    if (content.indexOf(match[0]) === -1) continue;

    const functionName = match[1];
    const paramsBlock = match[2];
    const args = parseXmlParameters(paramsBlock);

    toolCalls.push({
      id: `tc_${Date.now()}_${toolCallIndex++}`,
      name: functionName,
      arguments: args,
    });
    content = content.replace(match[0], '').trim();
    log('Parsed simple function call:', functionName);
  }

  return { content, toolCalls };
}

/**
 * Parse XML-style function call: <function=name><parameter=key>value</parameter></function>
 */
function parseXmlFunctionCall(block: string): { name: string; arguments: Record<string, unknown> } | null {
  const functionMatch = block.match(/<function=(\w+)>([\s\S]*?)<\/function>/i);
  if (!functionMatch) return null;

  const functionName = functionMatch[1];
  const paramsBlock = functionMatch[2];
  const args = parseXmlParameters(paramsBlock);

  return { name: functionName, arguments: args };
}

/**
 * Parse XML parameters: <parameter=key>value</parameter>
 */
function parseXmlParameters(block: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const paramRegex = /<parameter=(\w+)>\s*([\s\S]*?)\s*<\/parameter>/gi;
  let paramMatch;

  while ((paramMatch = paramRegex.exec(block)) !== null) {
    const paramName = paramMatch[1];
    const paramValue = paramMatch[2].trim();
    args[paramName] = paramValue;
  }

  return args;
}

/**
 * Try to fix and parse truncated/malformed JSON
 */
function tryFixAndParseJson(jsonStr: string): any {
  let fixed = jsonStr.trim();

  // Count and balance braces/brackets
  let openBraces = (fixed.match(/\{/g) || []).length;
  let closeBraces = (fixed.match(/\}/g) || []).length;
  let openBrackets = (fixed.match(/\[/g) || []).length;
  let closeBrackets = (fixed.match(/\]/g) || []).length;

  // Add missing closing braces/brackets
  while (closeBraces < openBraces) {
    fixed += '}';
    closeBraces++;
  }
  while (closeBrackets < openBrackets) {
    fixed += ']';
    closeBrackets++;
  }

  // Remove trailing comma before closing brace/bracket
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(fixed);
}

/**
 * Extract JSON object from text (finds first { to last })
 */
function extractJsonFromText(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return null;
}

/**
 * Convert snake_case keys to camelCase
 */
export function normalizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    normalized[camelKey] = value;
  }
  return normalized;
}

/**
 * Normalize date arguments from various formats
 * Handles: "2026-06-01 to 2026-08-31", "June 2026", etc.
 */
export function normalizeDateArgs(args: Record<string, unknown>): { startDate?: string; endDate?: string } {
  const result: { startDate?: string; endDate?: string } = {};

  // Handle explicit startDate/endDate
  if (args.startDate && typeof args.startDate === 'string') {
    result.startDate = args.startDate;
  }
  if (args.endDate && typeof args.endDate === 'string') {
    result.endDate = args.endDate;
  }

  // Handle 'date' parameter with range (e.g., "2026-06-01 to 2026-08-31")
  if (args.date && typeof args.date === 'string') {
    const dateStr = args.date as string;
    const rangeMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})/i);
    if (rangeMatch) {
      result.startDate = result.startDate || rangeMatch[1];
      result.endDate = result.endDate || rangeMatch[2];
    } else {
      // Try to parse as single date
      const singleDateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
      if (singleDateMatch) {
        result.startDate = result.startDate || singleDateMatch[1];
      }
    }
  }

  return result;
}

/**
 * Normalize location arguments
 */
export function normalizeLocationArgs(args: Record<string, unknown>): { locationQuery?: string } {
  const result: { locationQuery?: string } = {};

  if (args.location && typeof args.location === 'string') {
    result.locationQuery = (args.location as string).trim();
  }
  if (args.query && typeof args.query === 'string' && !result.locationQuery) {
    result.locationQuery = (args.query as string).trim();
  }
  if (args.departureDescription && typeof args.departureDescription === 'string' && !result.locationQuery) {
    result.locationQuery = (args.departureDescription as string).trim();
  }

  return result;
}

/**
 * Format tool results for AI consumption
 */
export function formatToolResultsForAI(
  results: Array<{ name: string; result: unknown; error?: string }>
): string {
  return results.map(r => {
    if (r.error) {
      return `Tool ${r.name} error: ${r.error}`;
    }
    return `Tool ${r.name} result:\n${JSON.stringify(r.result, null, 2)}`;
  }).join('\n\n');
}
