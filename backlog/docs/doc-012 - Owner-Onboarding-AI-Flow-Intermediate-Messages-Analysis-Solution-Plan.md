---
id: doc-012
title: Owner Onboarding AI Flow - Intermediate Messages Analysis & Solution Plan
type: other
created_date: '2026-02-22 11:42'
---
# Owner Onboarding AI Flow - Intermediate Messages Not Displayed

## Problem Statement

The owner onboarding AI assistant follows a multi-step flow where intermediate AI messages (those containing tool calls) are not being displayed to users or stored in conversation history.

### Current Flow

```
1. User sends input
   ↓
2. AI assesses info → RETURNS MESSAGE + TOOL CALLS ❌ NOT SHOWN TO USER
   ↓
3. Tool calls are executed, results collected
   ↓
4. Tool results passed back to AI for assessment
   ↓
5. AI returns final result → DISPLAYED TO USER ✅
   ↓
6. Final result displayed to user
```

**Issue**: The message from step 2 (which often contains explanation/reasoning before tool calls) is completely discarded and never reaches the user or conversation history.

---

## Root Cause Analysis

### Code Location: `app/lib/ai/owner/service.ts` (Lines 2190-2374)

The tool loop works as follows:

**Iteration Loop** (lines 2190+):
```typescript
while (iterations < MAX_TOOL_ITERATIONS) {
  // Call AI
  const result = await callAI({ useCase: 'owner-chat', prompt: promptText });
  
  // Parse response (line 2212)
  const parsed = parseToolCalls(result.text);
  const { content } = parsed;
  let toolCalls = parsed.toolCalls;
  
  // If tool calls exist (line 2284+)
  if (toolCalls.length > 0) {
    // Execute tools (line 2312)
    const toolResults = await executeOwnerTools(...);
    
    // Add results to messages for next iteration (lines 2370-2373)
    currentMessages.push(
      { role: 'assistant', content: result.text },  // ← AI message added to internal loop
      { role: 'user', content: contextMessage }
    );
    
    // Continue loop - NO BREAK, goes back to AI
  }
}
```

**Key Observation**: 
- Line 2371: `{ role: 'assistant', content: result.text }` - The intermediate AI message **IS ADDED to currentMessages**
- But this is ONLY for the internal loop context, not returned to user
- Line 2380: Final response only contains `finalContent` (the last AI message without tool calls)

### What Gets Returned to User

**File**: `app/api/ai/owner/chat/route.ts` (Lines 203-204)
```typescript
return NextResponse.json(response);  // response is OwnerChatResponse
```

**Response Structure** (`app/lib/ai/owner/types.ts` lines 131-141):
```typescript
export interface OwnerChatResponse {
  sessionId: string;
  message: OwnerMessage;        // ← SINGLE message object
  extractedPreferences?: Partial<OwnerPreferences>;
  profileCreated?: boolean;
  boatCreated?: boolean;
  journeyCreated?: boolean;
}
```

**The Constraint**: The response structure only supports a **single message** (`message: OwnerMessage`), not an array of messages.

---

## Current Message Flow

### What's Stored in Conversation History

In `owner_sessions` table, the `conversation` JSONB stores `OwnerMessage[]`, but the API response only returns one message.

**Client-side** likely appends this single message to local history:
```
[
  { role: 'user', content: 'User message' },
  { role: 'assistant', content: 'Final response only' }  // ← Missing intermediate messages
]
```

### The Intermediate Messages

When AI returns a message with tool calls:
```
AI Response Example:
"I'll help you create your boat profile. Let me search for your boat details first.

I found the boat details for a Bavaria 46. Here's what I found:
- LOA: 14.2m
- Beam: 4.5m
- Capacity: 8 crew

[Tool call JSON for create_boat]"
```

This entire message is:
1. ✅ **Parsed** into `content` (without tool calls) and `toolCalls` (extracted)
2. ✅ **Added to currentMessages** for next iteration (line 2371)
3. ✅ **Used for tool execution** context (line 2312)
4. ❌ **NOT returned to client** (only `finalContent` is)
5. ❌ **NOT stored in conversation history** (only final message is saved)

---

## Feasibility Analysis

### ✅ Possibility 1: Return Multiple Messages (RECOMMENDED)

**Change**: Modify `OwnerChatResponse` to support multiple messages

```typescript
export interface OwnerChatResponse {
  sessionId: string;
  messages: OwnerMessage[];        // ← Change to array
  // OR keep single message for backward compat
  message?: OwnerMessage;
  extractedPreferences?: Partial<OwnerPreferences>;
  profileCreated?: boolean;
  boatCreated?: boolean;
  journeyCreated?: boolean;
}
```

**Implementation**:
1. Collect all intermediate messages from `currentMessages` during loop
2. Return all of them (both intermediate + final) in `messages` array
3. Client appends all to conversation history
4. Display intermediate messages to user in sequence

**Pros**:
- ✅ Shows user the AI's reasoning before tool execution
- ✅ More transparent/intelligent-feeling conversation
- ✅ Better conversation history (complete context)
- ✅ Can filter: show intermediate but without tool JSON
- ✅ Backward compatible if we keep both `message` and `messages`

**Cons**:
- ⚠️ Changes API response structure (breaking if not careful)
- ⚠️ Client must handle array of messages
- ⚠️ May need to filter out internal prompt/nudges

**Effort**: 2-3 hours
**Risk**: Medium (affects API contract)

---

### ✅ Possibility 2: Return Content with Separators

**Change**: Combine intermediate messages into single response with visual separators

```typescript
// Instead of returning just final message:
finalContent = `
[Step 1 - Analysis]
I'll help you create your boat profile...

[Tool Execution]
Searching for boat details... Found Bavaria 46 with:
- LOA: 14.2m
- Beam: 4.5m

[Final Response]
Great! Your boat has been created...
`;
```

**Implementation**:
1. Track intermediate messages during loop
2. Concatenate them with markdown/visual separators
3. Return as single message with format markers
4. Client parses separators and displays progressively

**Pros**:
- ✅ No API change required
- ✅ Single message object (backward compatible)
- ✅ Easy to implement
- ✅ Can format nicely in UI

**Cons**:
- ❌ Not true separate messages (harder to structure)
- ❌ Client must parse markers
- ❌ Loses message metadata per step
- ❌ Harder to handle message removal/retry

**Effort**: 1-2 hours
**Risk**: Low

---

### ✅ Possibility 3: Store in Session, Return Summary

**Change**: Store full message history in `owner_sessions.conversation`, return summary to user

```typescript
// In owner_sessions table:
owner_sessions.conversation = [
  { role: 'user', content: 'Create my profile' },
  { role: 'assistant', content: 'I\'ll help you...' },  // Intermediate
  { role: 'user', content: 'Tool results:...' },
  { role: 'assistant', content: 'Final response' }
];

// Return to client:
OwnerChatResponse.message = 'Final response only'
OwnerChatResponse.hasIntermediateMessages = true
```

**Implementation**:
1. Save all currentMessages to `owner_sessions.conversation` (already happens for session persistence)
2. Return only final message to client
3. On next request, include full conversation history
4. Client can reconstruct from session data

**Pros**:
- ✅ No API changes
- ✅ Data preserved in database
- ✅ Can reconstruct full conversation later
- ✅ Already partially implemented

**Cons**:
- ❌ Messages not initially shown to user
- ❌ Requires second request to see intermediate messages
- ❌ Not suitable for real-time UI (user can't see reasoning)

**Effort**: 1 hour
**Risk**: Low (mostly observation, not new code)

---

### ⚠️ Possibility 4: Streaming Responses

**Change**: Stream intermediate messages as they're processed

```typescript
// Instead of returning one message:
// Stream intermediate -> tool results -> final
```

**Implementation**:
1. Modify route to use `ReadableStream`
2. Yield intermediate messages as they happen
3. Client receives real-time updates

**Pros**:
- ✅ Most natural user experience
- ✅ Shows real-time progress

**Cons**:
- ❌ Complex implementation (tool loop must be async-friendly)
- ❌ Requires WebSocket or Server-Sent Events
- ❌ Error handling difficult mid-stream
- ❌ May conflict with current timeout fix work

**Effort**: 3-5 hours
**Risk**: High (architectural change)

---

## Detailed Implementation Plan

### Recommended Approach: Possibility 1 (Multiple Messages)

#### Phase 1: Update Type Definitions

**File**: `app/lib/ai/owner/types.ts` (lines 131-141)

```typescript
// ADD field for multiple messages
export interface OwnerChatResponse {
  sessionId: string;
  // Backward compat: keep single message
  message: OwnerMessage;
  // NEW: array of all messages from this request
  intermediateMessages?: OwnerMessage[];
  
  extractedPreferences?: Partial<OwnerPreferences>;
  profileCreated?: boolean;
  boatCreated?: boolean;
  journeyCreated?: boolean;
}
```

#### Phase 2: Collect Intermediate Messages in Service

**File**: `app/lib/ai/owner/service.ts`

Track all intermediate messages:
```typescript
let intermediateMessages: OwnerMessage[] = [];

// In the loop when toolCalls are found (line 2284+):
if (toolCalls.length > 0) {
  // Create message from intermediate response
  const intermediateMsg: OwnerMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    content: content,  // WITHOUT tool calls shown
    timestamp: new Date().toISOString(),
    metadata: {
      toolCalls: toolCalls.map(tc => ({ ... })),
      // Mark as intermediate (not final)
      isIntermediate: true,
    }
  };
  
  intermediateMessages.push(intermediateMsg);
}

// Return all intermediate messages
return {
  sessionId,
  message: responseMessage, // Final message
  intermediateMessages,     // ALL intermediate messages
  profileCreated,
  boatCreated,
  journeyCreated,
};
```

#### Phase 3: Client-Side Storage

**File**: Client component (e.g., chat hooks)

```typescript
// When receiving response:
const { message, intermediateMessages } = response;

// Add all messages to history
const allMessages = [...intermediateMessages, message];
conversationHistory.push(...allMessages);

// Display to user:
// - Show intermediate messages with reasoning
// - Note which ones had tool calls (optional)
// - Show final message at end
```

#### Phase 4: Save to Session

**File**: Already happening in route.ts (lines 153-165)

The session archival already saves the full `conversation` array, so no changes needed here. Just ensure it includes intermediate messages when we update the response.

---

## Data Flow Diagram

### Current (Broken)
```
AI Loop Iteration:
├─ AI Response: "I'll create boat..."
├─ Parse: { content, toolCalls }
├─ Execute Tools: fetch_boat_details
├─ Add to currentMessages: [assistant, user] ✅
├─ Continue Loop
│
Final:
├─ Return: { message: finalContent } ❌ Intermediate lost
├─ Session saves: only final message
└─ Client displays: only final message
```

### Proposed (Fixed)
```
AI Loop Iteration:
├─ AI Response: "I'll create boat..."
├─ Parse: { content, toolCalls }
├─ Store: intermediateMessages.push(msg) ✅
├─ Add to currentMessages: [assistant, user]
├─ Execute Tools
└─ Continue Loop

Final:
├─ Return: {
│   message: finalContent,
│   intermediateMessages: [msg1, msg2, ...] ✅
│ }
├─ Session saves: ALL messages
└─ Client displays: ALL messages in sequence
```

---

## Questions to Answer Before Implementation

1. **Should intermediate messages include tool call JSON?**
   - Option A: Strip JSON, show only explanation
   - Option B: Show JSON for transparency
   - Option C: Show collapsed/toggle-able JSON

2. **How to mark intermediate vs final messages?**
   - Flag in metadata: `isIntermediate?: boolean`
   - Different message role?
   - Separate fields?

3. **Client behavior for intermediate messages**:
   - Display inline as they arrive (streaming-like visual)?
   - Batch display after receiving all?
   - Group with tool results?

4. **Session persistence**:
   - Should intermediate messages be saved to `owner_sessions.conversation`?
   - Currently not, but should they be?

5. **Backward compatibility**:
   - Keep single `message` field for old clients?
   - Or require client update?
   - Use both `message` and `intermediateMessages` together?

---

## Summary

| Aspect | Details |
|--------|---------|
| **Current State** | Intermediate messages created in loop but discarded before returning to user |
| **Root Cause** | `OwnerChatResponse` only supports single message; intermediate messages only used internally |
| **Best Solution** | Return multiple messages in response via new `intermediateMessages` field |
| **Effort** | 2-3 hours (types + service + client integration) |
| **Risk Level** | Medium (API change, but backward compatible) |
| **User Impact** | High (shows AI reasoning, better UX, more transparent) |
| **Implementation** | Phase 1-4 in 1-2 days |

---

## Files to Modify

1. **`app/lib/ai/owner/types.ts`** - Add intermediateMessages to OwnerChatResponse
2. **`app/lib/ai/owner/service.ts`** - Collect intermediate messages during loop
3. **Client chat component** - Display and store all messages
4. **Optional**: `app/api/ai/owner/chat/route.ts` - No changes needed

---

## Success Criteria

✅ Intermediate messages shown to user  
✅ All messages stored in conversation history  
✅ User sees complete reasoning before/after tool execution  
✅ API backward compatible  
✅ Session persistence includes all messages
