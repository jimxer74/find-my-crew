# Tool Call Parsing Fix Summary

## Problem Identified

The AI assistant was failing to create pending actions because the tool call parsing was encountering truncated JSON responses. The logs showed:

```
[AI Assistant Service] Found tool call block: [
  {"name": "suggest_profile_update_user_description", "arguments": {"reason": "Your user description is currently empty, which may reduce your chances of being selected for sailing opportunities. A
[AI Assistant Service] Skipping JSON block - no valid "name" field
[AI Assistant Service] Parsing complete: 0 tool calls found
```

The issue was that the AI response was being truncated mid-JSON-object, causing the parser to fail.

## Root Cause

1. **AI Response Truncation**: The AI response hit token limits before completing the tool call JSON
2. **Inflexible Parser**: The parsing logic couldn't handle incomplete JSON objects
3. **Missing Error Recovery**: No fallback mechanism for fixing truncated JSON

## Solution Implemented

### Enhanced JSON Parsing with Truncation Recovery

**File**: `app/lib/ai/assistant/service.ts` - `parseToolCalls` function

#### 1. **Method 1: Code Block Format** (lines 303-354)
- Added JSON truncation recovery for ` ```tool_call` format
- Automatically adds missing closing braces/brackets
- Removes trailing commas before closing braces
- Handles common truncation patterns

#### 2. **Method 2: <|tool_call_start|> Format** (lines 355-430)
- Enhanced with the same JSON fixing logic
- Improved error handling and recovery
- Better validation for malformed JSON

#### 3. **Method 3: <|tool_call|> Tags** (lines 431-506)
- Added truncation recovery for tag-based format
- Comprehensive error handling with fallbacks

### JSON Truncation Recovery Logic

The fix includes intelligent JSON recovery that:

1. **Counts Braces**: Tracks opening and closing braces/brackets
2. **Adds Missing Closures**: Automatically adds missing `}` and `]` characters
3. **Fixes Trailing Commas**: Removes invalid trailing commas
4. **Graceful Fallback**: Falls back to other parsing methods if JSON fixing fails

```typescript
// Example of the recovery logic:
let openBraces = (fixedJson.match(/\{/g) || []).length;
let closeBraces = (fixedJson.match(/\}/g) || []).length;
let openBrackets = (fixedJson.match(/\[/g) || []).length;
let closeBrackets = (fixedJson.match(/\]/g) || []).length;

// Add missing closing braces
while (closeBraces < openBraces) {
  fixedJson += '}';
  closeBraces++;
}
while (closeBrackets < openBrackets) {
  fixedJson += ']';
  closeBrackets++;
}

// Remove trailing comma before closing brace/bracket
fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
```

## Expected Behavior After Fix

### Before Fix
1. AI generates tool call with truncated JSON
2. Parser fails to parse incomplete JSON
3. Tool call is skipped with "no valid 'name' field" error
4. No pending action is created
5. User sees only text response

### After Fix
1. AI generates tool call with truncated JSON
2. Parser detects truncation and attempts to fix JSON
3. Fixed JSON is successfully parsed
4. Pending action is created successfully
5. User sees response with actionable button

## Testing

Created comprehensive test suite in `test-tool-call-parsing.js` that verifies:

- ✅ Complete tool calls in code blocks
- ✅ Truncated tool calls with automatic JSON fixing
- ✅ Multiple tool calls in single response
- ✅ Invalid JSON handling without crashes
- ✅ No tool calls (normal text responses)

## Files Modified

1. **app/lib/ai/assistant/service.ts**
   - Enhanced `parseToolCalls` function with JSON truncation recovery
   - Added robust error handling for all parsing methods
   - Improved logging for debugging

2. **test-tool-call-parsing.js** (new)
   - Comprehensive test suite for parsing logic
   - Various edge cases and error scenarios

## Impact

This fix ensures that:
- **Tool calls are reliably parsed** even when AI responses are truncated
- **Pending actions are created** when intended
- **User experience is improved** with functional action buttons
- **System is more robust** against AI response variability

## Verification

To test the fix:

1. Trigger AI profile suggestions (e.g., "update user description")
2. Verify that pending actions are now created
3. Check that action buttons appear in the UI
4. Confirm that actions can be approved and processed

The tool call parsing system should now handle truncated responses gracefully and create pending actions as intended.