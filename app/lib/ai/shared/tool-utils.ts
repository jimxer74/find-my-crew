/**
 * Shared AI Tool Utilities
 *
 * Common utilities for parsing and handling AI tool calls across different
 * AI chat implementations (assistant, prospect, etc.)
 */

import { logger } from '../../logger';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[AI Tool Utils] ${message}`, data !== undefined ? (data as Record<string, any>) : undefined);
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
 * Parse Python-style function call from text
 * Handles formats like: default_api.search_legs_by_location(departure_bbox={...}, ...)
 * or: print(default_api.search_legs_by_location(...))
 */
function parsePythonFunctionCall(text: string): { name: string; arguments: Record<string, unknown> } | null {
  // Match Python function calls: (optional print() wrapper) (optional prefix.)function_name(...)
  // Examples:
  // - default_api.search_legs_by_location(...)
  // - print(default_api.search_legs_by_location(...))
  // - search_legs_by_location(...)
  // 
  // IMPORTANT: Only match if it looks like a function call, not random text
  // The pattern must start at the beginning of the text or after whitespace/newline
  // and must have proper function call structure (name followed by parentheses with content)
  const pythonCallRegex = /^(?:print\s*\(\s*)?(?:\w+\.)?(\w+)\s*\(([\s\S]*?)\)\s*(?:\))?$/;
  const match = text.trim().match(pythonCallRegex);
  
  if (!match) return null;
  
  const functionName = match[1]; // The function name (first capture group)
  const argsString = match[2]?.trim() || '';
  
  // Validate function name - must be a valid tool name (snake_case or camelCase, not just any word)
  // Reject single words that are likely place names or common words
  const invalidNames = ['ireland', 'iceland', 'greenland', 'norway', 'brittany', 'svalbard', 'lofoten'];
  if (invalidNames.includes(functionName.toLowerCase())) {
    return null;
  }
  
  // Function name should contain underscore or be camelCase (not just a single capitalized word)
  if (!functionName.includes('_') && functionName === functionName.charAt(0).toUpperCase() + functionName.slice(1).toLowerCase()) {
    // Likely a proper noun (place name), not a function
    return null;
  }
  
  if (!argsString) {
    return { name: functionName, arguments: {} };
  }
  
  try {
    // Parse Python dict syntax to JSON
    const parsedArgs = parsePythonDict(argsString);
    return { name: functionName, arguments: parsedArgs };
  } catch (e) {
    log('Failed to parse Python function arguments:', e);
    return null;
  }
}

/**
 * Parse Python dict syntax to JavaScript object
 * Handles: {"key": "value", "nested": {"inner": 123}}
 * Also handles: {key: "value", nested: {inner: 123}} (without quotes on keys)
 */
function parsePythonDict(pythonStr: string): Record<string, unknown> {
  // Convert Python dict to JSON-like format
  let jsonStr = pythonStr.trim();
  
  // Remove outer braces if present
  if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
    jsonStr = jsonStr.slice(1, -1).trim();
  }
  
  // Handle empty dict
  if (!jsonStr) {
    return {};
  }
  
  // Convert Python None to null
  jsonStr = jsonStr.replace(/\bNone\b/g, 'null');
  
  // Convert Python True/False to true/false
  jsonStr = jsonStr.replace(/\bTrue\b/g, 'true');
  jsonStr = jsonStr.replace(/\bFalse\b/g, 'false');
  
  // Add quotes to unquoted keys (snake_case keys)
  // Match: key: or key= followed by value
  jsonStr = jsonStr.replace(/([{,]\s*)([a-z_][a-z0-9_]*)\s*[:=]/gi, '$1"$2":');
  
  // Handle nested dicts - ensure keys are quoted
  // This is a simplified approach - for complex nested structures, we might need recursion
  let depth = 0;
  let result = '';
  let i = 0;
  
  while (i < jsonStr.length) {
    const char = jsonStr[i];
    
    if (char === '{') {
      depth++;
      result += char;
    } else if (char === '}') {
      depth--;
      result += char;
    } else if (char === '[') {
      depth++;
      result += char;
    } else if (char === ']') {
      depth--;
      result += char;
    } else if (char === '"' || char === "'") {
      // Skip string content
      const quote = char;
      result += char;
      i++;
      while (i < jsonStr.length && jsonStr[i] !== quote) {
        if (jsonStr[i] === '\\') {
          result += jsonStr[i];
          i++;
          if (i < jsonStr.length) {
            result += jsonStr[i];
            i++;
          }
        } else {
          result += jsonStr[i];
          i++;
        }
      }
      if (i < jsonStr.length) {
        result += jsonStr[i];
      }
    } else {
      result += char;
    }
    i++;
  }
  
  jsonStr = result;
  
  // Wrap in braces to make it valid JSON
  if (!jsonStr.trim().startsWith('{')) {
    jsonStr = '{' + jsonStr + '}';
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // If JSON parsing fails, try a more aggressive approach
    // Extract key-value pairs manually
    return parsePythonDictManual(pythonStr);
  }
}

/**
 * Manual parsing of Python dict as fallback
 */
function parsePythonDictManual(pythonStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  // Remove outer braces
  let content = pythonStr.trim();
  if (content.startsWith('{') && content.endsWith('}')) {
    content = content.slice(1, -1).trim();
  }
  
  if (!content) return result;
  
  // Split by commas, but respect nested structures
  const pairs: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar && (i === 0 || content[i - 1] !== '\\')) {
      inString = false;
      stringChar = '';
      current += char;
    } else if (!inString && char === '{') {
      depth++;
      current += char;
    } else if (!inString && char === '}') {
      depth--;
      current += char;
    } else if (!inString && char === '[') {
      depth++;
      current += char;
    } else if (!inString && char === ']') {
      depth--;
      current += char;
    } else if (!inString && depth === 0 && char === ',') {
      pairs.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    pairs.push(current.trim());
  }
  
  // Parse each key-value pair
  for (const pair of pairs) {
    const colonMatch = pair.match(/^([a-z_][a-z0-9_]*)\s*[:=]\s*(.+)$/i);
    if (colonMatch) {
      const key = colonMatch[1];
      let valueStr = colonMatch[2].trim();
      
      // Parse value
      let value: unknown = valueStr;
      
      // Handle strings
      if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || 
          (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
        value = valueStr.slice(1, -1);
      }
      // Handle numbers
      else if (/^-?\d+$/.test(valueStr)) {
        value = parseInt(valueStr, 10);
      }
      else if (/^-?\d+\.\d+$/.test(valueStr)) {
        value = parseFloat(valueStr);
      }
      // Handle booleans
      else if (valueStr === 'True' || valueStr === 'true') {
        value = true;
      }
      else if (valueStr === 'False' || valueStr === 'false') {
        value = false;
      }
      // Handle None/null
      else if (valueStr === 'None' || valueStr === 'null') {
        value = null;
      }
      // Handle nested dicts
      else if (valueStr.startsWith('{') && valueStr.endsWith('}')) {
        try {
          value = parsePythonDict(valueStr);
        } catch {
          value = valueStr; // Fallback to string
        }
      }
      // Handle arrays
      else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
        try {
          // Simple array parsing
          const arrayContent = valueStr.slice(1, -1).trim();
          if (!arrayContent) {
            value = [];
          } else {
            const items = arrayContent.split(',').map(s => {
              const trimmed = s.trim();
              if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || 
                  (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                return trimmed.slice(1, -1);
              }
              return trimmed;
            });
            value = items;
          }
        } catch {
          value = valueStr;
        }
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Parse tool calls from AI response
 *
 * Handles multiple formats:
 * 1. JSON in code blocks: ```tool_call {"name": "...", "arguments": {...}} ```
 * 2. Python-style function calls: ```tool_code default_api.search_legs_by_location(...) ```
 * 3. XML-like format: <tool_call><function=name>...</function></tool_call>
 * 4. Delimiter format: <|tool_calls_start|>...<|tool_calls_end|>
 * 5. Single delimiter format: <|tool_call_start|>...[tool_name(...)]...<|tool_call_end|>
 * 6. Simple function format: <function=name>...</function>
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

      // First, try to parse Python-style function calls (e.g., default_api.search_legs_by_location(...))
      const pythonCall = parsePythonFunctionCall(jsonStr);
      if (pythonCall) {
        toolCalls.push({
          id: `tc_${Date.now()}_${toolCallIndex++}`,
          name: pythonCall.name,
          arguments: pythonCall.arguments,
        });
        content = content.replace(match[0], '').trim();
        log('Parsed Python-style tool call:', pythonCall.name);
        continue;
      }

      // Try to parse as JSON
      let toolCallJson: any;
      try {
        toolCallJson = JSON.parse(jsonStr);
      } catch {
        // Try to fix truncated JSON
        toolCallJson = tryFixAndParseJson(jsonStr);
      }

      // Check if this is a proper tool call with name and arguments
      if (toolCallJson && toolCallJson.name && typeof toolCallJson.name === 'string') {
        toolCalls.push({
          id: `tc_${Date.now()}_${toolCallIndex++}`,
          name: toolCallJson.name,
          arguments: toolCallJson.arguments || {},
        });
        content = content.replace(match[0], '').trim();
        log('Parsed JSON tool call:', toolCallJson.name);
      } 
      // Check if this looks like profile data (implicit update_user_profile call)
      else if (toolCallJson && typeof toolCallJson === 'object' && !toolCallJson.name) {
        // Check if it has profile-like fields
        const profileFields = ['full_name', 'bio', 'user_description', 'experience_level', 'sailing_experience', 
                               'skills', 'risk_level', 'comfort_zones', 'sailing_preferences', 'certifications'];
        const hasProfileFields = profileFields.some(field => field in toolCallJson);
        
        if (hasProfileFields) {
          log('Detected implicit update_user_profile call from profile JSON');
          toolCalls.push({
            id: `tc_${Date.now()}_${toolCallIndex++}`,
            name: 'update_user_profile',
            arguments: toolCallJson,
          });
          content = content.replace(match[0], '').trim();
          log('Converted profile JSON to update_user_profile tool call');
        }
      }
    } catch (e) {
      log('Failed to parse tool call block');
    }
  }

  // Method 2: <tool_call>...</tool_call> — inner content can be JSON or XML-style
  const toolCallBlockRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;

  while ((match = toolCallBlockRegex.exec(text)) !== null) {
    const inner = match[1].trim();
    // Try JSON first (many models output {"name": "...", "arguments": {...}} inside <tool_call>)
    let parsed: { name: string; arguments: Record<string, unknown> } | null = null;
    const jsonObj = extractJsonFromText(inner);
    if (jsonObj) {
      try {
        const toolCallJson = JSON.parse(jsonObj);
        if (toolCallJson && toolCallJson.name && typeof toolCallJson.name === 'string') {
          parsed = {
            name: toolCallJson.name,
            arguments: toolCallJson.arguments || {},
          };
          log('Parsed <tool_call> JSON:', parsed.name);
        }
      } catch {
        // not valid JSON, try XML below
      }
    }
    if (!parsed) {
      parsed = parseXmlFunctionCall(inner);
      if (parsed) log('Parsed XML tool_call:', parsed.name);
    }
    if (parsed) {
      toolCalls.push({
        id: `tc_${Date.now()}_${toolCallIndex++}`,
        ...parsed,
      });
      content = content.replace(match[0], '').trim();
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

  // Method 4: Single delimiter format <|tool_call_start|> ... <|tool_call_end|>
  // Supports common outputs such as:
  // - <|tool_call_start|>[generate_journey_route(...)]<|tool_call_end|>
  // - <|tool_call_start|>{"name":"...","arguments":{...}}<|tool_call_end|>
  const singleDelimiterRegex = /<\|tool_call_start\|>([\s\S]*?)<\|tool_call_end\|>/g;

  while ((match = singleDelimiterRegex.exec(text)) !== null) {
    try {
      const rawInner = match[1].trim();
      const unwrappedInner = rawInner.startsWith('[') && rawInner.endsWith(']')
        ? rawInner.slice(1, -1).trim()
        : rawInner;

      let parsedAny = false;

      // 4a) Python-style function call, e.g. generate_journey_route(...)
      const pythonCall = parsePythonFunctionCall(unwrappedInner);
      if (pythonCall) {
        toolCalls.push({
          id: `tc_${Date.now()}_${toolCallIndex++}`,
          name: pythonCall.name,
          arguments: pythonCall.arguments,
        });
        parsedAny = true;
        log('Parsed single-delimiter Python tool call:', pythonCall.name);
      }

      // 4b) JSON object/array payload
      if (!parsedAny) {
        const candidates = [rawInner, unwrappedInner, extractJsonFromText(rawInner), extractJsonFromText(unwrappedInner)]
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

        for (const candidate of candidates) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(candidate);
          } catch {
            try {
              parsed = tryFixAndParseJson(candidate);
            } catch {
              continue;
            }
          }

          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const toolItem = item as { name?: unknown; arguments?: unknown };
              if (typeof toolItem?.name === 'string') {
                toolCalls.push({
                  id: `tc_${Date.now()}_${toolCallIndex++}`,
                  name: toolItem.name,
                  arguments: (toolItem.arguments as Record<string, unknown>) || {},
                });
                parsedAny = true;
              }
            }
          } else {
            const toolObj = parsed as { name?: unknown; arguments?: unknown };
            if (typeof toolObj?.name === 'string') {
              toolCalls.push({
                id: `tc_${Date.now()}_${toolCallIndex++}`,
                name: toolObj.name,
                arguments: (toolObj.arguments as Record<string, unknown>) || {},
              });
              parsedAny = true;
            }
          }

          if (parsedAny) {
            log('Parsed single-delimiter JSON tool call');
            break;
          }
        }
      }

      if (parsedAny) {
        content = content.replace(match[0], '').trim();
      }
    } catch {
      log('Failed to parse single delimiter tool call');
    }
  }

  // Method 5: Simple function format <function=name>...</function> (without tool_call wrapper)
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

  // Method 6: Inline tool_call format without code fences (e.g., "tool_call {"name": "...", ...}")
  // Some models output this format without markdown code blocks
  const inlineToolCallRegex = /tool_call\s*(\{[\s\S]*?"name"\s*:\s*"[^"]+[\s\S]*?\})\s*(?:\n|$)/gi;

  while ((match = inlineToolCallRegex.exec(text)) !== null) {
    // Skip if already processed
    if (content.indexOf(match[0]) === -1) continue;

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
        log('Parsed inline tool_call:', toolCallJson.name);
      }
    } catch (e) {
      log('Failed to parse inline tool_call');
    }
  }

  // Method 7: Custom token format: <|start|>assistant<|channel|>...<|message|>{"name": "...", "arguments": {...}}<|call|>
  // Some models (like certain OpenRouter models) use this token-based format
  // Also handles variations like: <|message|>...JSON...<|call|> or just JSON between these tokens
  const tokenFormatRegex = /<\|message\|>([\s\S]*?)<\|call\|>/gi;
  
  while ((match = tokenFormatRegex.exec(text)) !== null) {
    // Skip if already processed
    if (content.indexOf(match[0]) === -1) continue;
    
    try {
      const inner = match[1].trim();
      
      // First try to parse the inner content directly as JSON
      let toolCallJson: any = null;
      try {
        toolCallJson = JSON.parse(inner);
      } catch {
        // If direct parse fails, try to extract JSON from the inner content
        const extractedJson = extractJsonFromText(inner);
        if (extractedJson) {
          try {
            toolCallJson = JSON.parse(extractedJson);
          } catch {
            log('Failed to parse extracted JSON from token format');
          }
        }
      }
      
      if (toolCallJson && toolCallJson.name && typeof toolCallJson.name === 'string') {
        toolCalls.push({
          id: `tc_${Date.now()}_${toolCallIndex++}`,
          name: toolCallJson.name,
          arguments: toolCallJson.arguments || {},
        });
        content = content.replace(match[0], '').trim();
        log('Parsed token format tool call:', toolCallJson.name);
      }
    } catch (e) {
      log('Failed to parse token format tool call', e);
    }
  }

  // Method 8: Plain JSON object format (no wrapper, just {"name": "...", "arguments": {...}})
  // Some models output tool calls as standalone JSON objects without any markers
  // Only check if no tool calls were found yet and the content looks like a tool call
  if (toolCalls.length === 0) {
    const trimmedContent = content.trim();
    
    // Check if content starts with a JSON object
    if (trimmedContent.startsWith('{')) {
      try {
        // First, try to parse the entire content as JSON
        let toolCallJson: any;
        let jsonStartIndex = 0;
        let jsonEndIndex = trimmedContent.length;
        
        try {
          toolCallJson = JSON.parse(trimmedContent);
          // Successfully parsed entire content as JSON
        } catch {
          // Try to extract JSON from text if there's extra content before/after
          const extractedJson = extractJsonFromText(content);
          if (extractedJson) {
            try {
              toolCallJson = JSON.parse(extractedJson);
              // Find the position of the extracted JSON in the original content
              jsonStartIndex = content.indexOf(extractedJson);
              jsonEndIndex = jsonStartIndex + extractedJson.length;
            } catch {
              // Extraction found something but it's not valid JSON
              toolCallJson = null;
            }
          }
        }

        // Check if this is a tool call format (has "name" and optionally "arguments")
        if (toolCallJson && toolCallJson.name && typeof toolCallJson.name === 'string') {
          toolCalls.push({
            id: `tc_${Date.now()}_${toolCallIndex++}`,
            name: toolCallJson.name,
            arguments: toolCallJson.arguments || {},
          });
          
          // Remove the JSON from content, preserving any text before/after
          const beforeJson = content.substring(0, jsonStartIndex).trim();
          const afterJson = content.substring(jsonEndIndex).trim();
          content = (beforeJson + ' ' + afterJson).trim();
          
          log('Parsed plain JSON tool call:', toolCallJson.name);
        }
      } catch (e) {
        // Not a tool call JSON, continue with normal content
        log('Content is not a plain JSON tool call');
      }
    }
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

/**
 * Sanitize content by removing malformed tool call syntax patterns
 * that weren't successfully parsed.
 * 
 * This removes example tool call syntax that the AI sometimes includes
 * when explaining tool usage, preventing it from being shown to users.
 * 
 * @param content - The content string to sanitize
 * @param hadSuccessfulToolCalls - Whether any tool calls were successfully parsed
 * @returns Sanitized content with malformed tool call syntax removed
 */
export function sanitizeContent(
  content: string, 
  hadSuccessfulToolCalls: boolean = false
): string {
  let sanitized = content;
  
  // Remove common tool call example markers and headers
  sanitized = sanitized.replace(/\*\*TOOL CALL:\*\*/gi, '');
  sanitized = sanitized.replace(/TOOL CALL:\s*/gi, '');
  sanitized = sanitized.replace(/^TOOL CALL\s*$/gim, '');
  
  // Remove unparsed code blocks with tool call language tags
  // Only remove if they contain tool call-like content (have "name" field)
  sanitized = sanitized.replace(
    /```(?:tool_calls?|tool_code)\s*\n?([\s\S]*?)```/g,
    (match, inner) => {
      // Check if this looks like a tool call (has "name" field)
      if (inner && inner.match(/"name"\s*:/i)) {
        log('Removing malformed tool call code block');
        return ''; // Remove it - it's a malformed tool call
      }
      return match; // Keep it - might be legitimate code example
    }
  );
  
  // Remove standalone JSON objects that look like tool calls but weren't parsed
  // Pattern: { "name": "...", "arguments": {...} } on its own line or preceded by markers
  sanitized = sanitized.replace(
    /^\s*\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[^}]*\}\s*\}\s*$/gm,
    ''
  );
  
  // Remove XML-style tool call tags that weren't parsed
  sanitized = sanitized.replace(/<tool_call>\s*[\s\S]*?<\/tool_call>/gi, (match) => {
    // Only remove if it looks like a tool call (has name attribute or name field)
    if (match.match(/name\s*=/i) || match.match(/"name"\s*:/i)) {
      log('Removing malformed XML tool call');
      return '';
    }
    return match;
  });
  
  // Remove delimiter formats that weren't parsed
  sanitized = sanitized.replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/gi, (match) => {
    // Only remove if it contains tool call-like content
    if (match.match(/"name"\s*:/i) || match.match(/name\s*=/i)) {
      log('Removing malformed delimiter tool call');
      return '';
    }
    return match;
  });
  
  // Clean up extra whitespace and empty lines
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  sanitized = sanitized.replace(/^\s+$/gm, ''); // Remove lines with only whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}
