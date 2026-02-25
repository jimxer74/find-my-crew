/**
 * Message Content Parsing Utilities
 *
 * Shared utilities for parsing structured content from AI chat messages.
 * Handles suggestion extraction, content cleaning, and reference parsing.
 */

import { logger } from '@shared/logging';

/**
 * Extract suggested prompts from AI message
 * Format: [SUGGESTIONS]...[/SUGGESTIONS]
 * Returns array of prompts and index of the most important one (if marked with [IMPORTANT])
 */
export function extractSuggestedPrompts(content: string): { prompts: string[]; importantIndex: number | null } {
  if (!content || typeof content !== 'string') {
    return { prompts: [], importantIndex: null };
  }

  // Case-insensitive regex to match [SUGGESTIONS]...[/SUGGESTIONS] blocks
  // Uses non-greedy match to capture content between tags
  // Handles whitespace around tags: [SUGGESTIONS] or [ SUGGESTIONS ] etc.
  // Also handles cases where closing tag is missing (captures until end of content or next tag)
  const suggestionsRegexWithClose = /\[\s*SUGGESTIONS\s*\]([\s\S]*?)\[\s*\/\s*SUGGESTIONS\s*\]/i;
  // Fallback: match without closing tag - capture until double newline, next [ tag, or end of content
  const suggestionsRegexWithoutClose = /\[\s*SUGGESTIONS\s*\]([\s\S]*?)(?=\n\s*\n|\n\s*\[|$)/i;
  
  let match = content.match(suggestionsRegexWithClose);
  let suggestionsText: string;
  
  if (match && match[1]) {
    // Found with closing tag
    suggestionsText = match[1].trim();
  } else {
    // Try without closing tag - capture until double newline, next tag, or end of content
    match = content.match(suggestionsRegexWithoutClose);
    if (match && match[1]) {
      suggestionsText = match[1].trim();
    } else {
      // Last resort: try to find [SUGGESTIONS] and capture everything after it
      const lastResortMatch = content.match(/\[\s*SUGGESTIONS\s*\]([\s\S]*)/i);
      if (lastResortMatch && lastResortMatch[1]) {
        suggestionsText = lastResortMatch[1].trim();
      } else {
        return { prompts: [], importantIndex: null };
      }
    }
  }
  
  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('[extractSuggestedPrompts] Found suggestions text:', { preview: suggestionsText.substring(0, 200) });
  }
  
  let importantIndex: number | null = null;
  
  // Split by newlines and process each line
  const prompts = suggestionsText
    .split(/\r?\n/) // Handle both \n and \r\n
    .map((line, index) => {
      let cleaned = line.trim();
      
      // Skip empty lines early
      if (!cleaned) return { text: '', isImportant: false };
      
      // Check for [IMPORTANT] tag (case-insensitive, can be before or after list marker)
      const hasImportantTag = /\[IMPORTANT\]/i.test(cleaned);
      if (hasImportantTag) {
        // Remove the [IMPORTANT] tag
        cleaned = cleaned.replace(/\[IMPORTANT\]/gi, '').trim();
      }
      
      // Remove markdown list markers: "- ", "1. ", "* ", "• ", etc.
      cleaned = cleaned.replace(/^[-*•]\s+/, '');
      cleaned = cleaned.replace(/^\d+\.\s+/, '');
      
      // Remove surrounding quotes (both single and double, including smart quotes)
      // Handle cases like: "text", 'text', "text', 'text", ""text"", "text", 'text', etc.
      // Also handle smart quotes: "text", 'text', "text", 'text'
      cleaned = cleaned.replace(/^["'""'']+/, ''); // Remove quotes at start (regular and smart quotes)
      cleaned = cleaned.replace(/["'""'']+$/, ''); // Remove quotes at end (regular and smart quotes)
      
      return { text: cleaned.trim(), isImportant: hasImportantTag };
    })
    .filter(item => {
      const line = item.text;
      // Filter out empty lines, metadata tags, and example text
      if (!line || line.length === 0) return false;
      
      const lowerLine = line.toLowerCase();
      
      return (
        line.length > 0 &&
        line.length < 200 && // Increased limit for longer questions
        !line.startsWith('[') &&
        !lowerLine.startsWith('example') &&
        !lowerLine.startsWith('format') &&
        !lowerLine.includes('[suggestions]') && // Filter out the tag itself if somehow included
        !lowerLine.includes('[/suggestions]')
      );
    });

  // Find the index of the important suggestion
  const filteredPrompts = prompts.map(item => item.text);
  const importantItem = prompts.find(item => item.isImportant);
  if (importantItem) {
    importantIndex = filteredPrompts.indexOf(importantItem.text);
  }

  return { 
    prompts: filteredPrompts.slice(0, 5), // Max 5 suggestions
    importantIndex: importantIndex !== null && importantIndex >= 0 ? importantIndex : null
  };
}

/**
 * Remove suggestions block from message content for display
 */
export function removeSuggestionsFromContent(content: string): string {
  // Remove all [SUGGESTIONS]...[/SUGGESTIONS] sections (case-insensitive, global)
  // Handles optional whitespace around tags: [SUGGESTIONS], [ SUGGESTIONS ], etc.
  return content
    .replace(/\[\s*SUGGESTIONS\s*\][\s\S]*?\[\s*\/\s*SUGGESTIONS\s*\]/gi, '') // Remove well-formed sections
    .replace(/\[\s*SUGGESTIONS\s*\]([\s\S]*?)(?:\n\s*\n|\n\s*\[|$)/gi, '') // Remove incomplete sections
    .trim();
}

/**
 * Extract leg references from message content
 * Format: [[leg:UUID:Name]] -> { legId: string, legName: string }
 */
export function extractLegReferences(content: string): Array<{ legId: string; legName: string }> {
  const refRegex = /\[\[leg:([a-f0-9-]+):([^\]]+)\]\]/gi;
  const references: Array<{ legId: string; legName: string }> = [];
  let match;

  while ((match = refRegex.exec(content)) !== null) {
    references.push({
      legId: match[1],
      legName: match[2],
    });
  }

  return references;
}

/**
 * Extract registration references from message content
 * Format: [[register:UUID:Name]] -> { legId: string, legName: string }
 */
export function extractRegistrationReferences(content: string): Array<{ legId: string; legName: string }> {
  const refRegex = /\[\[register:([a-f0-9-]+):([^\]]+)\]\]/gi;
  const references: Array<{ legId: string; legName: string }> = [];
  let match;

  while ((match = refRegex.exec(content)) !== null) {
    references.push({
      legId: match[1],
      legName: match[2],
    });
  }

  return references;
}

/**
 * Check if message content suggests signup or profile creation
 */
export function suggestsSignupOrProfileCreation(content: string): boolean {
  const lowerContent = content.toLowerCase();
  const signupKeywords = [
    'sign up',
    'signup',
    'create an account',
    'create account',
    'create your profile',
    'create a profile',
    'build your profile',
    'save your profile',
    'complete your profile',
    'register for legs',
    'join legs',
    'sign up button',
    'sign up above',
  ];
  return signupKeywords.some(keyword => lowerContent.includes(keyword));
}
