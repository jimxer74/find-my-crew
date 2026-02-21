---
id: doc-010
title: AI Response Timeout Analysis - 60 Second Limit Issue & Solutions
type: other
created_date: '2026-02-21 13:14'
---
# AI Response Timeout Analysis: 60-Second Limit Issue & Solutions

## Executive Summary

The AI onboarding chat endpoints (`/api/ai/owner/chat` and `/api/ai/prospect/chat`) are configured with a **60-second maximum duration** (`maxDuration = 60`). When AI responses take longer than 60 seconds, Vercel's serverless function timeout kills the request and returns a 504 Gateway Timeout error.

**Current Configuration**:
- Owner chat: `app/api/ai/owner/chat/route.ts` line 17: `export const maxDuration = 60;`
- Prospect chat: `app/api/ai/prospect/chat/route.ts` line 17: `export const maxDuration = 60;`

**Problem**: Complex AI reasoning (analyzing profiles, generating detailed boat suggestions, creating multi-leg journeys with analysis) can exceed 60 seconds, causing user experience to degrade with timeout errors.

---

## Root Cause Analysis

### 1. What Operations Take Long?

AI onboarding chat involves multiple time-consuming operations:

**Owner Onboarding**:
- Initial greeting & needs assessment
- Profile creation with validation
- Boat details extraction & storage
- Journey planning with multiple legs (can involve 5-10 legs)
- Each leg requires analysis of activities, risks, locations
- Tool execution (database writes, geocoding, image processing)

**Prospect Onboarding**:
- Experience level assessment
- Skills evaluation
- Risk level matching
- Journey leg analysis & matching

**Database Operations Within AI Loop**:
- Insert profile data (RLS checks)
- Insert boat data (with image processing)
- Insert journey/legs (with location validation)
- Geocoding queries
- Query existing data for context

### 2. Why Claude API Streams Help

When using streaming responses:
- Client receives first tokens within milliseconds
- Full response continues in background
- No need to wait for complete AI generation before returning
- Vercel function timeout applies to the entire operation, but streaming allows incremental delivery

### 3. Current Architecture

The current synchronous approach:
1. Client sends message
2. Server calls `ownerChat()` or `prospectChat()`
3. AI service calls Claude API (via `callAI()`)
4. Claude generates complete response (can take 30-60+ seconds)
5. Service processes tool calls if any
6. Service returns complete response
7. **All of this must complete within 60 seconds or timeout occurs**

---

## Proposed Solutions

### **Solution 1: Increase maxDuration (QUICKEST FIX)**

**Implementation**: Change `maxDuration = 60` to `maxDuration = 120` or higher.

**Pros**:
- ✅ Simplest implementation (2-line change)
- ✅ Immediate relief for most use cases
- ✅ No client-side changes needed
- ✅ No architectural changes

**Cons**:
- ❌ Vercel Pro plan limited to 60 seconds max (requires Enterprise plan for 900 seconds)
- ❌ Higher duration = higher cost per function invocation
- ❌ Still vulnerable to extremely long AI operations
- ❌ Doesn't scale well as dataset grows (more complex queries = slower)

**Vercel Plan Limits**:
- Hobby: 10 seconds max
- Pro: 60 seconds max
- Enterprise: Up to 600 seconds (or 900 with config)

**Recommendation for Current Plan**: This is NOT viable on Pro plan since 60 seconds is already the maximum.

---

### **Solution 2: Implement Streaming Responses (BEST FOR UX)**

**Implementation**: Convert API endpoints to stream AI responses in real-time instead of returning complete responses.

**How It Works**:
1. Client sends message
2. Server starts streaming Claude's response immediately
3. Client receives tokens as they arrive (within milliseconds)
4. Tool calls are streamed progressively
5. Entire function can still take 60+ seconds, but user sees progress immediately

**Code Changes Required**:

**Option A: Server-Side Streaming (Recommended)**
```typescript
// In route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Use streaming instead of waiting for complete response
    const reader = await ownerChatStream(supabase, {
      // ... request params
    });
    
    // Return streaming response
    return new NextResponse(reader.getReader(), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    // Error handling
  }
}
```

**Option B: Use Vercel's Response.Body Streaming**
```typescript
// Stream chunks to client as AI generates them
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    try {
      const stream = await Anthropic.messages.stream({
        model: 'claude-opus-4-6',
        messages: [...],
        stream: true,
      });
      
      for await (const chunk of stream) {
        controller.enqueue(
          encoder.encode(JSON.stringify(chunk) + '\n')
        );
      }
    } catch (error) {
      controller.error(error);
    } finally {
      controller.close();
    }
  },
});
```

**Client-Side Updates Required**:
```typescript
// In useOwnerChat hook or similar
const response = await fetch('/api/ai/owner/chat', {
  method: 'POST',
  body: JSON.stringify({ message, ... }),
});

const reader = response.body?.getReader();
if (reader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = new TextDecoder().decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        const event = JSON.parse(line);
        // Update UI with streamed content
        setPartialResponse(prev => prev + event.content);
      }
    }
  }
}
```

**Pros**:
- ✅ Best user experience (immediate visual feedback)
- ✅ Vercel function can run full 60 seconds while streaming
- ✅ User doesn't wait for complete AI response
- ✅ Works within Pro plan limits
- ✅ Shows thinking/reasoning as it happens

**Cons**:
- ❌ Requires client-side streaming implementation
- ❌ More complex error handling (error mid-stream)
- ❌ Tool execution feedback harder to implement
- ❌ Requires refactoring of AI service layer

**Complexity**: HIGH (2-3 days of work)

---

### **Solution 3: Implement Message Queue + Background Processing**

**Implementation**: Accept message immediately, queue AI processing backend, return tracking ID.

**How It Works**:
1. Client sends message
2. Server validates, creates job record in database
3. Returns immediately with `jobId` and polling URL
4. Client polls `/api/ai/owner/chat/status/{jobId}` for updates
5. Background worker processes AI chat
6. Returns complete response when ready

**Code Structure**:
```typescript
// POST - Accept and queue
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Create job in database
  const { data: job } = await supabase
    .from('ai_chat_jobs')
    .insert({
      status: 'pending',
      request_data: body,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  
  // Queue background job (using Vercel Cron, Bull, or similar)
  await queueAIJob(job.id);
  
  return NextResponse.json({
    jobId: job.id,
    statusUrl: `/api/ai/owner/chat/status/${job.id}`,
    pollIntervalMs: 1000,
  });
}

// GET - Check status
export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  const { data: job } = await supabase
    .from('ai_chat_jobs')
    .select('status, response_data, error')
    .eq('id', params.jobId)
    .single();
  
  return NextResponse.json({
    status: job.status,
    response: job.response_data,
    error: job.error,
  });
}
```

**Client-Side**:
```typescript
const response = await fetch('/api/ai/owner/chat', {
  method: 'POST',
  body: JSON.stringify({ message, ... }),
});

const { jobId, pollIntervalMs } = await response.json();

// Poll for completion
let completed = false;
while (!completed) {
  await new Promise(r => setTimeout(r, pollIntervalMs));
  const status = await fetch(`/api/ai/owner/chat/status/${jobId}`).then(r => r.json());
  
  if (status.status === 'completed') {
    completed = true;
    return status.response;
  } else if (status.status === 'failed') {
    throw new Error(status.error);
  }
  // Show loading spinner...
}
```

**Background Worker** (using Vercel Cron or similar):
```typescript
// cron job or separate service
export async function processAIChatJob(jobId: string) {
  try {
    const job = await getJobFromDB(jobId);
    const response = await ownerChat(supabase, job.request_data);
    
    await updateJobInDB(jobId, {
      status: 'completed',
      response_data: response,
    });
  } catch (error) {
    await updateJobInDB(jobId, {
      status: 'failed',
      error: error.message,
    });
  }
}
```

**Pros**:
- ✅ No timeout limit on actual processing (job runs separately)
- ✅ Scales horizontally (multiple workers)
- ✅ Works within Vercel Pro plan
- ✅ Better resource utilization
- ✅ Can handle queue prioritization

**Cons**:
- ❌ Complex architecture (job queue, workers, polling)
- ❌ Latency before work starts (job processing delay)
- ❌ Client must implement polling UI
- ❌ Database overhead for tracking jobs
- ❌ Operational complexity (monitoring, dead-letter queues)

**Complexity**: VERY HIGH (4-5 days of work + infrastructure setup)

---

### **Solution 4: Hybrid Approach - Streaming + Background Processing**

**Implementation**: Stream AI response while processing tool calls in background.

**How It Works**:
1. Client sends message
2. AI processes and streams response to client immediately
3. Tool execution happens in background (doesn't block response)
4. Client receives continued updates via WebSocket or polling

**This Is Complex** but provides best of both:
- Immediate user feedback
- No timeout constraints
- Clean streaming experience

**Complexity**: VERY HIGH (requires WebSocket infrastructure)

---

### **Solution 5: Optimize AI Implementation (FUNDAMENTAL APPROACH)**

**Implementation**: Reduce AI operation time through optimization.

**Optimization Strategies**:

1. **Reduce Context Size**:
   - Limit conversation history to last 5 messages (current: 15)
   - Cache frequently needed lookups (regions, skills, etc.)
   - Pre-compute region geocoding data

2. **Make Tool Calls Faster**:
   - Batch database operations
   - Use SELECT before INSERT to avoid RLS errors
   - Implement caching layer for geocoding

3. **Reduce AI Iterations**:
   - Limit MAX_TOOL_ITERATIONS (current: 10)
   - Provide better constraints to reduce tool calling loops

4. **Use Faster Models for Steps**:
   - Use Claude Haiku for profile validation
   - Use Claude Opus only for complex reasoning
   - Implement multi-model strategy

5. **Pre-generate Common Responses**:
   - Cache common "next step" prompts for each journey stage
   - Reduce need for AI to generate from scratch

**Example Optimization**:
```typescript
// Before: 15 messages, 10 iterations = slower
const response = await ownerChat(supabase, {
  conversationHistory: body.conversationHistory.slice(-15), // Was using all
  // ... rest of params
});

// After: 5 messages, 6 iterations = faster
const optimizedHistory = body.conversationHistory.slice(-5);
const response = await ownerChat(supabase, {
  conversationHistory: optimizedHistory,
  MaxToolIterations: 6, // Reduced from 10
  // ... rest of params
});
```

**Pros**:
- ✅ Permanent solution (improves for all users)
- ✅ Reduces server costs
- ✅ Reduces latency even when within timeout
- ✅ No architectural changes required

**Cons**:
- ❌ Requires profiling to identify bottlenecks
- ❌ May impact response quality
- ❌ Requires careful testing

**Complexity**: MEDIUM (2-3 days analysis + implementation)

---

## Comparison Matrix

| Solution | Pros | Cons | Effort | Timeline | Cost Impact |
|----------|------|------|--------|----------|------------|
| **1. Increase maxDuration** | Simplest | Only Pro: 60s limit | 30 min | Immediate | ↑ None on Pro |
| **2. Streaming** | Best UX | Client changes needed | HIGH | 2-3 days | ✅ None |
| **3. Job Queue** | Scalable | Very complex | VERY HIGH | 4-5 days | ↑ Moderate |
| **4. Streaming + Queue** | Ultimate UX | Most complex | VERY HIGH | 5-7 days | ↑ Moderate |
| **5. Optimize AI** | Permanent fix | Requires profiling | MEDIUM | 2-3 days | ↓ Lower |

---

## Vercel Plan Details

**Current Plan Assumption: Pro Plan** (since that's standard for production apps)

| Plan | Max Duration | Max Invocations | Cost |
|------|-------------|-----------------|------|
| Hobby | 10 seconds | Limited | Free |
| Pro | 60 seconds | Unlimited | $20/month |
| Enterprise | 600+ seconds | Custom | Custom pricing |

**Key Constraint**: Pro plan is **locked at 60-second maximum**. This cannot be increased without upgrading to Enterprise.

---

## Recommendations by Scenario

### **If Responses Usually Complete Within 60 Seconds**:
→ Skip most solutions. Implement **Solution 5 (Optimize AI)** to ensure reliability and reduce costs.

### **If Some Responses Take 60-90 Seconds**:
→ Implement **Solution 2 (Streaming)** for best UX. Or upgrade to **Enterprise plan** if budget allows.

### **If Responses Regularly Exceed 90 Seconds**:
→ Implement **Solution 2 (Streaming) + Solution 5 (Optimize)** together for:
- Immediate user feedback (streaming)
- Reduced timeout risk (optimization)

### **For Future Scalability**:
→ Plan for **Solution 3 or 4 (Job Queue)** when onboarding complexity increases or user volume grows.

---

## Recommended Implementation Path

**Phase 1 (Immediate - 1 day)**: 
- Implement **Solution 5**: Reduce history to 5 messages, limit iterations to 6
- Add timeout logging to identify which operations actually timeout
- Profile real-world response times

**Phase 2 (If Phase 1 Insufficient - 3 days)**:
- Implement **Solution 2**: Streaming responses
- Keep optimization from Phase 1
- Test with complex journeys

**Phase 3 (Future - Only If Needed)**:
- Implement **Solution 3**: Job queue for scalability
- Consider model-switching for optimization

---

## Questions to Answer Before Implementation

1. **What's the actual timeout rate?** (Measure in production logs)
2. **Which operations are slowest?** (Profile AI service)
3. **Is plan upgrade possible?** (Vercel Enterprise for extended timeout)
4. **What's acceptable latency?** (Streaming acceptable, or need instant?)
5. **Is operational complexity acceptable?** (Job queue adds overhead)

---

## Monitoring & Metrics

**Add Tracking**:
```typescript
const startTime = Date.now();
const response = await ownerChat(supabase, params);
const duration = Date.now() - startTime;

logger.info('[Performance] Owner chat completed', { 
  duration,
  isNearTimeout: duration > 50000, // Flag if near 60s limit
  hasToolCalls: response.toolCalls?.length || 0,
});
```

**Track These Metrics**:
- Total response time per message
- Time to first token (TFT) from AI
- Tool execution time
- Database query time
- % of requests near timeout (>50s)
