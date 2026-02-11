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

  // First, handle truncated strings by finding unclosed quotes
  // Track quote positions and determine which ones are opening vs closing
  const quotePositions: number[] = [];
  let i = 0;
  while (i < fixed.length) {
    if (fixed[i] === '"') {
      // Check if it's escaped
      if (i === 0 || fixed[i - 1] !== '\\') {
        quotePositions.push(i);
      }
    }
    i++;
  }

  // If we have an odd number of quotes, the last one opened a string that wasn't closed
  if (quotePositions.length % 2 !== 0) {
    const lastQuoteIndex = quotePositions[quotePositions.length - 1];
    const afterLastQuote = fixed.substring(lastQuoteIndex + 1);
    
    // Check if there's any content after the last quote that suggests truncation
    // If the string doesn't end with a quote and there's content, it's likely truncated
    if (!fixed.endsWith('"') && afterLastQuote.length > 0) {
      // Find where the truncated string should end
      // Look for the next structural character (comma, closing brace/bracket) or end of string
      const nextStructural = afterLastQuote.search(/[,\]\}]/);
      if (nextStructural === -1) {
        // No structural character found - the string goes to the end, close it
        fixed = fixed + '"';
      } else {
        // There's content after - close the string before the structural character
        // But first, check if we should preserve the content after
        const truncatedPart = afterLastQuote.substring(0, nextStructural);
        const afterTruncated = afterLastQuote.substring(nextStructural);
        
        // If the truncated part looks like it's part of the string value, close it
        // Otherwise, it might be a new field starting
        if (truncatedPart.trim().length > 0 && !truncatedPart.match(/^\s*:/)) {
          // Close the string and keep the structural content
          fixed = fixed.substring(0, lastQuoteIndex + 1 + nextStructural) + '"' + afterTruncated;
        }
      }
    } else if (!fixed.endsWith('"')) {
      // Ends without quote but no content after - just add closing quote
      fixed = fixed + '"';
    }
  }

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
    const errorPosition = parseError.message.match(/position (\d+)/)?.[1];
    const position = errorPosition ? parseInt(errorPosition, 10) : null;
    
    log('JSON parse failed', { 
      error: parseError.message, 
      position,
      jsonText: position 
        ? jsonText.substring(Math.max(0, position - 100), Math.min(jsonText.length, position + 100))
        : jsonText.substring(0, 200)
    });
    
    // If fixErrors was enabled and still failed, try one more aggressive fix
    if (fixErrors) {
      try {
        // Try a more aggressive fix: if we can identify the truncated field, close it properly
        let aggressiveFix = fixJsonErrors(jsonText);
        
        // Additional fix: if error mentions "Unterminated string", try to close all open strings
        if (parseError.message.includes('Unterminated string')) {
          // Find all quote positions
          const quotePositions: number[] = [];
          for (let i = 0; i < aggressiveFix.length; i++) {
            if (aggressiveFix[i] === '"' && (i === 0 || aggressiveFix[i - 1] !== '\\')) {
              quotePositions.push(i);
            }
          }
          
          // If odd number of quotes, the last one opened an unclosed string
          if (quotePositions.length % 2 !== 0) {
            const lastQuotePos = quotePositions[quotePositions.length - 1];
            const afterQuote = aggressiveFix.substring(lastQuotePos + 1);
            
            // If the response ends without a closing quote, close it
            if (!aggressiveFix.endsWith('"')) {
              // Find where to close - look for structural characters or just close at end
              const nextComma = afterQuote.indexOf(',');
              const nextBrace = afterQuote.indexOf('}');
              const nextBracket = afterQuote.indexOf(']');
              
              const nextStructural = Math.min(
                nextComma === -1 ? Infinity : nextComma,
                nextBrace === -1 ? Infinity : nextBrace,
                nextBracket === -1 ? Infinity : nextBracket
              );
              
              if (nextStructural === Infinity) {
                // No structural character found - close at the end
                aggressiveFix = aggressiveFix + '"';
              } else {
                // Close before the structural character
                const beforeStructural = aggressiveFix.substring(0, lastQuotePos + 1 + nextStructural);
                const afterStructural = aggressiveFix.substring(lastQuotePos + 1 + nextStructural);
                aggressiveFix = beforeStructural.trim() + '"' + afterStructural;
              }
            }
          }
        }
        
        const parsed = JSON.parse(aggressiveFix);
        log('Successfully parsed after aggressive fix');
        return parsed;
      } catch (retryError: any) {
        log('Aggressive fix also failed', { error: retryError.message });
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
