# Proposal: Handle Malformed Tool Call Syntax

## Problem Statement

The AI sometimes responds with example tool call syntax (showing the format) rather than actual tool calls. When the parser fails to parse these malformed tool calls, the raw syntax remains in the content and is displayed to users, creating a poor user experience.

**Example:**
```
**TOOL CALL:**
```tool_call
{"name": "create_boat", "arguments": {...}}
```
```

This gets shown to users even though it's just an example format, not a real tool call.

## Proposed Solutions

### Solution 1: Content Sanitization (Primary Fix)

**Goal:** Remove all malformed/unparsed tool call syntax patterns from user-facing content.

**Implementation:**

1. **Add a `sanitizeContent()` function** in `app/lib/ai/shared/tool-utils.ts` that removes common tool call syntax patterns that weren't successfully parsed:
   - Code blocks with tool call language tags: ` ```tool_call ... ``` `
   - Inline tool call markers: `**TOOL CALL:**`, `TOOL CALL:`, etc.
   - XML-style tool call tags: `<tool_call>...</tool_call>`
   - Delimiter formats: `<|tool_call_start|>...<|tool_call_end|>`
   - Standalone JSON objects that look like tool calls but weren't parsed

2. **Call `sanitizeContent()`** after `parseToolCalls()` in both `ownerChat()` and `prospectChat()`:
   ```typescript
   const { content, toolCalls } = parseToolCalls(result.text);
   const sanitizedContent = sanitizeContent(content, toolCalls.length > 0);
   ```

3. **Smart removal logic:**
   - Only remove patterns that weren't successfully parsed (track which patterns were matched)
   - Preserve legitimate code examples that aren't tool calls
   - Remove common prefixes like "**TOOL CALL:**" that indicate example syntax

**Benefits:**
- Clean user-facing content
- No breaking changes to existing functionality
- Handles edge cases where AI shows examples

**Considerations:**
- Need to be careful not to remove legitimate code examples
- Should preserve actual tool call results/descriptions

---

### Solution 2: Enhanced Parsing with Fallback Cleanup

**Goal:** Improve parsing to handle edge cases and clean up failures.

**Implementation:**

1. **Enhance `parseToolCalls()`** to track which patterns it attempted to parse:
   - Return metadata about attempted patterns: `{ content, toolCalls, attemptedPatterns }`
   - Mark patterns that matched but failed to parse

2. **Add cleanup pass** that removes failed patterns:
   ```typescript
   function cleanupFailedPatterns(content: string, attemptedPatterns: string[]): string {
     // Remove patterns that matched but failed to parse
     // This is more targeted than Solution 1
   }
   ```

**Benefits:**
- More targeted cleanup (only removes what was attempted)
- Better logging/debugging of parsing failures

**Considerations:**
- More complex implementation
- Requires refactoring `parseToolCalls()` return type

---

### Solution 3: AI Prompt Enhancement (Prevention)

**Goal:** Prevent AI from outputting example tool call syntax in the first place.

**Implementation:**

1. **Add explicit instructions** to system prompts:
   ```
   CRITICAL: When explaining tool usage to users, DO NOT include example tool call syntax.
   - DO NOT show code blocks with tool_call format
   - DO NOT include "TOOL CALL:" markers
   - Simply describe what will happen in natural language
   ```

2. **Add examples** of what NOT to do in the prompt

**Benefits:**
- Prevents the issue at the source
- Reduces need for cleanup

**Considerations:**
- May not be 100% effective (AI can still make mistakes)
- Should be combined with Solution 1 for defense in depth

---

### Solution 4: Retry Mechanism for Malformed Tool Calls

**Goal:** When AI uses wrong syntax, attempt to fix and retry.

**Implementation:**

1. **Detect malformed tool calls** in the response (patterns that look like tool calls but failed to parse)

2. **Attempt to fix common issues:**
   - Incomplete JSON (add missing closing braces)
   - Wrong format (convert between formats)
   - Missing required fields (infer from context)

3. **If fixable, retry parsing** instead of showing error to user

**Benefits:**
- Recovers from common mistakes
- Better user experience

**Considerations:**
- Complex to implement correctly
- Risk of misinterpreting user intent
- Should have limits (don't retry indefinitely)

---

## Recommended Approach

**Combination of Solutions 1 + 3:**

1. **Primary:** Implement Solution 1 (Content Sanitization) to immediately fix the issue
2. **Secondary:** Implement Solution 3 (Prompt Enhancement) to prevent future occurrences
3. **Optional:** Consider Solution 4 for specific edge cases if needed

This provides:
- ✅ Immediate fix for existing issues
- ✅ Prevention of future issues
- ✅ Minimal complexity
- ✅ No breaking changes

---

## Implementation Details for Solution 1

### Function Signature
```typescript
/**
 * Sanitize content by removing malformed tool call syntax patterns
 * that weren't successfully parsed.
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
  
  // Remove common tool call example markers
  sanitized = sanitized.replace(/\*\*TOOL CALL:\*\*/gi, '');
  sanitized = sanitized.replace(/TOOL CALL:\s*/gi, '');
  
  // Remove unparsed code blocks with tool call language tags
  // Only remove if they contain tool call-like content
  sanitized = sanitized.replace(
    /```(?:tool_calls?|tool_code)\s*\n?[^`]*?```/g,
    (match) => {
      // Check if this looks like a tool call (has "name" field)
      if (match.match(/"name"\s*:/i)) {
        return ''; // Remove it - it's a malformed tool call
      }
      return match; // Keep it - might be legitimate code example
    }
  );
  
  // Remove standalone JSON objects that look like tool calls but weren't parsed
  // Only if they're on their own line or preceded by tool call markers
  sanitized = sanitized.replace(
    /^\s*\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[^}]*\}\s*\}\s*$/gm,
    ''
  );
  
  // Clean up extra whitespace
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();
  
  return sanitized;
}
```

### Integration Points

**In `app/lib/ai/owner/service.ts`:**
```typescript
const { content, toolCalls } = parseToolCalls(result.text);
const sanitizedContent = sanitizeContent(content, toolCalls.length > 0);
finalContent = sanitizedContent;
```

**In `app/lib/ai/prospect/service.ts`:**
```typescript
const { content, toolCalls } = parseToolCalls(result.text);
const sanitizedContent = sanitizeContent(content, toolCalls.length > 0);
finalContent = sanitizedContent;
```

---

## Implementation Details for Solution 3

### Prompt Additions

**For Owner Chat (`buildOwnerSystemPrompt`):**
```
## TOOL CALL FORMATTING (CRITICAL):

When explaining tool usage to users, use natural language only. DO NOT include:
- Code blocks with tool_call format (```tool_call ... ```)
- "TOOL CALL:" markers or headers
- Example JSON syntax
- Any technical tool call syntax

INSTEAD, describe what will happen in plain language:
- ✅ "I'll create your boat profile now."
- ❌ "I'll call the create_boat tool: ```tool_call {"name": "create_boat"} ```"
```

**For Prospect Chat (`buildProspectSystemPrompt`):**
```
(Same instructions as above)
```

---

## Testing Strategy

1. **Unit Tests:**
   - Test `sanitizeContent()` with various malformed patterns
   - Verify legitimate code examples are preserved
   - Test edge cases (empty content, only tool calls, etc.)

2. **Integration Tests:**
   - Test with real AI responses containing malformed tool calls
   - Verify user-facing content is clean
   - Verify tool calls still work correctly

3. **Manual Testing:**
   - Test with the specific example from the log
   - Test with various AI models that might output different formats
   - Verify no regression in normal tool call functionality

---

## Rollout Plan

1. **Phase 1:** Implement Solution 1 (Content Sanitization)
   - Add `sanitizeContent()` function
   - Integrate into owner and prospect chat services
   - Test thoroughly
   - Deploy

2. **Phase 2:** Implement Solution 3 (Prompt Enhancement)
   - Update system prompts
   - Monitor for reduction in malformed tool calls
   - Adjust prompts if needed

3. **Phase 3 (Optional):** Consider Solution 4 if specific patterns emerge that need retry logic

---

## Success Metrics

- ✅ Zero instances of malformed tool call syntax shown to users
- ✅ No regression in tool call functionality
- ✅ Reduced log entries for "Failed to parse tool call"
- ✅ Improved user experience (cleaner responses)
