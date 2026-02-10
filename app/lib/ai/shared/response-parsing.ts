/**
 * AI Response Parsing Utilities
 *
 * Shared utilities for parsing JSON and structured content from AI responses.
 * Handles markdown code blocks, JSON extraction, error fixing, and validation.
 */

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Response Parsing] ${message}`, data !== undefined ? data : '');
  }
};

export interface ParseJsonOptions {
  /** Expected JSON type: 'object' or 'array'. If not specified, auto-detects. */
  type?: 'object' | 'array';
  /** Whether to attempt fixing common JSON errors (trailing commas, unbalanced braces, etc.) */
  fixErrors?: boolean;
  /** Whether to extract JSON from surrounding text if wrapped */
  extractFromText?: boolean;
}

/**
 * Remove markdown code blocks from text
 * Handles various formats: ```json, ```JSON, ```, ```js, etc.
 */
export function removeMarkdownCodeBlocks(text: string): string {
  let cleaned = text.trim();

  // Handle various markdown code block formats:
  // ```json, ```JSON, ```javascript, ```python, ``` (no language), ``` js, etc.
  // Remove opening code block (case-insensitive, with optional language identifier)
  cleaned = cleaned.replace(/^```(?:json|js|javascript|python|tsx|ts|\s*)?\s*\n?/i, '');

  // Remove closing code block
  cleaned = cleaned.replace(/\n?\s*```$/i, '');

  // Handle edge cases where response starts/ends with backticks but doesn't match above pattern
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3).trim();
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3).trim();
  }

  // Remove any remaining leading/trailing whitespace and newlines
  cleaned = cleaned.trim();

  // Additional cleanup for common LLM artifacts
  // Remove any remaining "json" text that might be left over
  cleaned = cleaned.replace(/^\s*json\s*/i, '');

  return cleaned.trim();
}

/**
 * Extract JSON object or array from text
 * Finds the first { to last } for objects, or first [ to last ] for arrays
 */
export function extractJsonFromText(
  text: string,
  type: 'object' | 'array' = 'object'
): string | null {
  if (type === 'object') {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
    }
  } else {
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return text.substring(firstBracket, lastBracket + 1);
    }
  }
  return null;
}

/**
 * Fix common JSON errors: trailing commas, unbalanced braces/brackets, truncated strings
 */
export function fixJsonErrors(jsonText: string): string {
  let fixed = jsonText.trim();

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

  // Fix trailing commas in arrays/objects
  fixed = fixed.replace(/,\s*}/g, '}');
  fixed = fixed.replace(/,\s*]/g, ']');

  // Handle truncated strings (ends with unclosed quote)
  // This is a basic fix - more sophisticated handling may be needed
  if (fixed.match(/"[^"]*$/)) {
    // If ends with unclosed quote, try to close it
    const lastQuoteIndex = fixed.lastIndexOf('"');
    if (lastQuoteIndex > 0 && !fixed.substring(lastQuoteIndex + 1).match(/[,\]\}]/)) {
      // Only fix if it's clearly truncated
      fixed = fixed.substring(0, lastQuoteIndex + 1);
    }
  }

  return fixed;
}

/**
 * Parse JSON from AI response text
 * Handles markdown code blocks, extraction, and error fixing
 */
export function parseJsonFromAIResponse(
  text: string,
  options: ParseJsonOptions = {}
): any {
  const {
    type,
    fixErrors = true,
    extractFromText = true,
  } = options;

  log('Parsing JSON from AI response', { textLength: text.length, type, fixErrors, extractFromText });

  // Step 1: Remove markdown code blocks
  let jsonText = removeMarkdownCodeBlocks(text);
  log('After markdown removal', { length: jsonText.length });

  // Step 2: Extract JSON from text if needed
  if (extractFromText) {
    const extracted = extractJsonFromText(jsonText, type);
    if (extracted) {
      jsonText = extracted;
      log('Extracted JSON from text', { length: jsonText.length });
    }
  }

  // Step 3: Fix common JSON errors if enabled
  if (fixErrors) {
    jsonText = fixJsonErrors(jsonText);
    log('After error fixing', { length: jsonText.length });
  }

  // Step 4: Parse JSON
  try {
    const parsed = JSON.parse(jsonText);
    log('Successfully parsed JSON', { type: Array.isArray(parsed) ? 'array' : 'object' });
    return parsed;
  } catch (parseError: any) {
    log('JSON parse failed', { error: parseError.message, jsonText: jsonText.substring(0, 200) });
    
    // If fixErrors was enabled and still failed, try one more aggressive fix
    if (fixErrors) {
      try {
        const aggressiveFix = fixJsonErrors(jsonText);
        const parsed = JSON.parse(aggressiveFix);
        log('Successfully parsed after aggressive fix');
        return parsed;
      } catch (retryError) {
        log('Aggressive fix also failed', { error: retryError });
      }
    }
    
    throw new Error(`Failed to parse JSON from AI response: ${parseError.message}`);
  }
}

/**
 * Parse JSON array from AI response (convenience wrapper)
 */
export function parseJsonArrayFromAIResponse(text: string): string[] {
  try {
    const parsed = parseJsonFromAIResponse(text, { type: 'array', fixErrors: true });
    if (!Array.isArray(parsed)) {
      throw new Error('Expected JSON array but got object');
    }
    return parsed;
  } catch (error: any) {
    log('Failed to parse JSON array', { error: error.message });
    throw error;
  }
}

/**
 * Parse JSON object from AI response (convenience wrapper)
 */
export function parseJsonObjectFromAIResponse(text: string): Record<string, any> {
  try {
    const parsed = parseJsonFromAIResponse(text, { type: 'object', fixErrors: true });
    if (Array.isArray(parsed)) {
      throw new Error('Expected JSON object but got array');
    }
    return parsed as Record<string, any>;
  } catch (error: any) {
    log('Failed to parse JSON object', { error: error.message });
    throw error;
  }
}
